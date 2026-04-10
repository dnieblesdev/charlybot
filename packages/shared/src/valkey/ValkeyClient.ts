// ValkeyClient implementation using ioredis (Valkey-compatible)
// Follows SDD design with circuit breaker, timeouts, retries

import Redis, { type Redis as RedisType } from 'ioredis';
import {
  type ValkeyConfig,
  type ValkeyStreamEntry,
  type ValkeyPendingEntry,
  type IValkeyClient,
  type ValkeyLogger,
  type CircuitState,
  CIRCUIT_BREAKER_CONFIG,
  RETRY_CONFIG,
} from './types.ts';

// Helper type for xreadgroup result
type XReadGroupMessage = [id: string, fields: [string, string][]];
type XReadGroupResult = [streamKey: string, messages: XReadGroupMessage[]][];

export class ValkeyClient implements IValkeyClient {
  private redis: Redis | null = null;
  private config: ValkeyConfig;
  private logger: ValkeyLogger | null = null;
  private subscribers = new Map<string, Set<(payload: object) => void>>();
  
  // Track if global message listener is already set up
  private messageListenerSetUp = false;

  // Circuit breaker state
  private circuitState: CircuitState = 'closed';
  private circuitErrorCount = 0;
  private circuitOpenedAt = 0;

  // Single-flight per process
  private inflight = new Map<string, Promise<unknown>>();

  constructor(config: ValkeyConfig, logger?: ValkeyLogger) {
    this.config = config;
    this.logger = logger ?? null;
  }

  // =============================================================================
  // Lifecycle
  // =============================================================================

  async connect(): Promise<void> {
    if (this.redis) return;

this.redis = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      connectTimeout: this.config.connectTimeoutMs ?? 5000,
      commandTimeout: this.config.commandTimeoutMs ?? 2000,
      // ioredis handles retries via retryStrategy; we control max retry delay ourselves
      retryStrategy: (retries) => {
        if (retries >= RETRY_CONFIG.maxRetries) {
          return null; // Stop retrying
        }
        return RETRY_CONFIG.baseDelayMs * Math.pow(2, retries);
      },
      lazyConnect: true,
      // Explicitly disable built-in retry to avoid double-retry logic
      maxRetriesPerRequest: 0,
      // Enable family flag for IPv6
      family: 4,
      // Keep pool of connections
      keepAlive: 15000,
    });

    this.redis.on('error', (err) => {
      this.logger?.error('Valkey connection error', { error: err.message });
      this.recordError();
    });

    this.redis.on('connect', () => {
      this.logger?.debug('Valkey connected');
    });

    await this.redis.connect();
  }

  async disconnect(): Promise<void> {
    if (!this.redis) return;

    // Unsubscribe all
    for (const [channel, handlers] of this.subscribers) {
      await this.redis.unsubscribe(channel);
      this.subscribers.delete(channel);
    }

    await this.redis.quit();
    this.redis = null;
    this.logger?.debug('Valkey disconnected');
  }

  isConnected(): boolean {
    return this.redis?.status === 'ready';
  }

  // =============================================================================
  // Cache Operations
  // =============================================================================

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.checkCircuit()) {
      throw new Error('Valkey circuit breaker is open');
    }

    try {
      const value = await this.redis!.get(key);
      if (value === null) return undefined;
      return JSON.parse(value) as T;
    } catch (err) {
      this.recordError();
      throw err;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.checkCircuit()) {
      throw new Error('Valkey circuit breaker is open');
    }

    try {
      await this.redis!.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      this.recordError();
      throw err;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.checkCircuit()) {
      throw new Error('Valkey circuit breaker is open');
    }

    try {
      await this.redis!.del(key);
    } catch (err) {
      this.recordError();
      throw err;
    }
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number,
  ): Promise<T> {
    // Single-flight: if already fetching, wait for it
    const inflightKey = key;
    const existing = this.inflight.get(inflightKey);
    if (existing) {
      return existing as Promise<T>;
    }

    // Start single-flight
    const promise = (async () => {
      try {
        // Try cache first
        const cached = await this.get<T>(key);
        if (cached !== undefined) {
          return cached;
        }

        // Fetch and cache
        const value = await fetchFn();
        await this.set(key, value, ttlSeconds);
        return value;
      } finally {
        this.inflight.delete(inflightKey);
      }
    })();

    this.inflight.set(inflightKey, promise);
    return promise;
  }

  // =============================================================================
  // Pub/Sub
  // =============================================================================

  async publish(channel: string, payload: object): Promise<void> {
    try {
      await this.redis?.publish(channel, JSON.stringify(payload));
    } catch (err) {
      this.logger?.warn('Valkey publish failed', { channel, error: err });
      // Fire-and-forget per design
    }
  }

  subscribe(channel: string, handler: (payload: object) => void): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
      // Actually subscribe to Redis channel only on first subscriber
      this.redis?.subscribe(channel).catch((err) => {
        this.logger?.error('Valkey subscribe failed', { channel, error: err.message });
      });
    }

    this.subscribers.get(channel)!.add(handler);

    // Install global message listener only once - dispatches to all channels
    if (this.redis && !this.messageListenerSetUp) {
      this.redis.on('message', (ch, message) => {
        const channelHandlers = this.subscribers.get(ch);
        if (channelHandlers && channelHandlers.size > 0) {
          try {
            const payload = JSON.parse(message);
            channelHandlers.forEach((h) => h(payload));
          } catch (err) {
            this.logger?.warn('Failed to parse pubsub message', { channel: ch, error: err });
          }
        }
      });
      this.messageListenerSetUp = true;
    }

    return () => {
      const handlers = this.subscribers.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscribers.delete(channel);
          this.redis?.unsubscribe(channel).catch((err) => {
            this.logger?.warn('Valkey unsubscribe failed', { channel, error: err.message });
          });
        }
      }
    };
  }

  // =============================================================================
  // Streams
  // =============================================================================

  async streamAdd(
    stream: string,
    fields: Record<string, string>,
    maxLen?: number,
  ): Promise<string> {
    const args = [...Object.entries(fields).flat()];
    if (maxLen !== undefined) {
      args.push('MAXLEN', String(maxLen));
    }

    return (await this.redis!.xadd(stream, '*', ...args)) as string;
  }

  async streamRead(
    stream: string,
    consumerGroup: string,
    consumer: string,
    count: number = 10,
  ): Promise<ValkeyStreamEntry[]> {
    return this.streamReadGroup(stream, consumerGroup, consumer, count, 5000);
  }

  async streamReadGroup(
    stream: string,
    consumerGroup: string,
    consumer: string,
    count: number = 10,
    blockMs: number = 5000,
  ): Promise<ValkeyStreamEntry[]> {
    // xreadgroup: '>' means "only new messages not yet acknowledged"
    const onlyNew = String.fromCharCode(62); // '>' = char code 62
    const resultArr = await this.redis!.xreadgroup(
      'GROUP',
      consumerGroup,
      consumer,
      'COUNT',
      count,
      'BLOCK',
      blockMs,
      'STREAMS',
      stream,
      onlyNew,
    );

    if (!resultArr) return [];

    // Parse result structure defensively
    const typedResult = resultArr as unknown as Array<[
      string,
      Array<[string, [string, string][]]>
    ]>;
    if (!typedResult) return [];

    const entries: ValkeyStreamEntry[] = [];
    for (const [, messages] of typedResult) {
      for (const [id, fields] of messages) {
        entries.push({
          id,
          fields: Object.fromEntries(fields),
        });
      }
    }

    return entries;
  }

  async streamAck(
    stream: string,
    consumerGroup: string,
    messageIds: string[],
  ): Promise<void> {
    if (messageIds.length === 0) return;
    await this.redis!.xack(stream, consumerGroup, ...messageIds);
  }

  async streamClaim(
    stream: string,
    consumerGroup: string,
    minIdleMs: number,
    messageIds: string[],
    consumer: string,
  ): Promise<ValkeyStreamEntry[]> {
    if (messageIds.length === 0) return [];

    const result = await this.redis!.xclaim(
      stream,
      consumerGroup,
      consumer,
      minIdleMs,
      ...messageIds,
    );

    // xclaim returns array of [id, [field, value, ...]] entries
    const entries: ValkeyStreamEntry[] = result.map((entry: unknown) => {
      const [id, fields] = entry as [string, [string, string][]];
      return {
        id,
        fields: Object.fromEntries(fields),
      };
    });

    return entries;
  }

  async streamCreateGroup(
    stream: string,
    consumerGroup: string,
    start: string = '$',
  ): Promise<void> {
    try {
      await this.redis!.xgroup('CREATE', stream, consumerGroup, start, 'MKSTREAM');
    } catch (err: unknown) {
      // BUSYGROUP: Consumer group already exists - idempotent
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('BUSYGROUP')) {
        return;
      }
      throw err;
    }
  }

  async streamPending(
    stream: string,
    consumerGroup: string,
    start: string = '-',
    end: string = '+',
    count: number = 100,
  ): Promise<ValkeyPendingEntry[]> {
    const result = await this.redis!.xpending(
      stream,
      consumerGroup,
      start,
      end,
      count,
    ) as Array<{
      id: string;
      consumer: string;
      timeSinceDelivered: number;
      deliveryCount: number;
    }> | null;
    if (!result || result.length === 0) return [];

    return result.map((entry) => ({
      id: entry.id,
      consumer: entry.consumer,
      timeSinceDelivered: entry.timeSinceDelivered,
      deliveryCount: entry.deliveryCount,
    }));
  }

  // =============================================================================
  // Rate Limiting
  // =============================================================================

  async rateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    try {
      const result = await this.redis!.incr(key);
      if (result === 1) {
        await this.redis!.expire(key, windowSeconds);
      }
      return result <= limit;
    } catch (err) {
      this.logger?.error('Valkey rateLimit failed', { key, error: err });
      // Fail-open per design
      return true;
    }
  }

  // =============================================================================
  // Locks
  // =============================================================================

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.redis!.set(
        key,
        process.pid.toString(),
        'EX',
        ttlSeconds,
        'NX',
      );
      return result === 'OK';
    } catch (err) {
      this.logger?.warn('Valkey acquireLock failed', { key, error: err });
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    try {
      await this.redis!.del(key);
    } catch (err) {
      this.logger?.warn('Valkey releaseLock failed', { key, error: err });
    }
  }

  // =============================================================================
  // Set operations (for guild stream registry)
  // =============================================================================

  async setAdd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis!.sadd(key, ...members);
    } catch (err) {
      this.logger?.warn('Valkey setAdd failed', { key, error: err });
      return 0;
    }
  }

  async setMembers(key: string): Promise<string[]> {
    try {
      return await this.redis!.smembers(key);
    } catch (err) {
      this.logger?.warn('Valkey setMembers failed', { key, error: err });
      return [];
    }
  }

  async setRemove(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis!.srem(key, ...members);
    } catch (err) {
      this.logger?.warn('Valkey setRemove failed', { key, error: err });
      return 0;
    }
  }

  async setIsMember(key: string, member: string): Promise<boolean> {
    try {
      return await this.redis!.sismember(key, member) === 1;
    } catch (err) {
      this.logger?.warn('Valkey setIsMember failed', { key, member, error: err });
      return false;
    }
  }

  // =============================================================================
  // Sorted Set operations (for guild stream registry with TTL)
  // =============================================================================

  async sortedSetAdd(key: string, score: number, member: string): Promise<number> {
    try {
      return await this.redis!.zadd(key, score, member);
    } catch (err) {
      this.logger?.warn('Valkey sortedSetAdd failed', { key, member, error: err });
      return 0;
    }
  }

  async sortedSetRemove(key: string, member: string): Promise<number> {
    try {
      return await this.redis!.zrem(key, member);
    } catch (err) {
      this.logger?.warn('Valkey sortedSetRemove failed', { key, member, error: err });
      return 0;
    }
  }

  async sortedSetRangeByScore(
    key: string,
    min: number,
    max: number,
    limit?: number,
  ): Promise<string[]> {
    try {
      if (limit) {
        return await this.redis!.zrangebyscore(key, min, max, 'LIMIT', 0, limit);
      }
      return await this.redis!.zrangebyscore(key, min, max);
    } catch (err) {
      this.logger?.warn('Valkey sortedSetRangeByScore failed', { key, error: err });
      return [];
    }
  }

  async sortedSetRemoveByScore(key: string, max: number): Promise<number> {
    try {
      return await this.redis!.zremrangebyscore(key, '-inf', max);
    } catch (err) {
      this.logger?.warn('Valkey sortedSetRemoveByScore failed', { key, error: err });
      return 0;
    }
  }

  // =============================================================================
  // Circuit Breaker
  // =============================================================================

  private checkCircuit(): boolean {
    if (this.circuitState === 'closed') return true;

    const now = Date.now();
    if (this.circuitState === 'open') {
      if (now - this.circuitOpenedAt > CIRCUIT_BREAKER_CONFIG.openDurationMs) {
        this.circuitState = 'half-open';
        this.logger?.info('Valkey circuit half-open');
        return true;
      }
      return false;
    }

    // half-open: allow one request
    return true;
  }

  private recordError(): void {
    this.circuitErrorCount++;
    const now = Date.now();

    if (this.circuitErrorCount >= CIRCUIT_BREAKER_CONFIG.errorThreshold) {
      this.circuitState = 'open';
      this.circuitOpenedAt = now;
      this.logger?.warn('Valkey circuit opened', {
        errors: this.circuitErrorCount,
        windowMs: CIRCUIT_BREAKER_CONFIG.errorWindowMs,
      });
    }
  }

  private recordSuccess(): void {
    this.circuitErrorCount = 0;
    this.circuitState = 'closed';
  }
}

/**
 * Creates a new ValkeyClient instance.
 */
export function createValkeyClient(
  config: ValkeyConfig,
  logger?: ValkeyLogger,
): ValkeyClient {
  return new ValkeyClient(config, logger);
}