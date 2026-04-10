// ValkeyFallbackWrapper: wraps IValkeyClient with fallback to IFallbackCache
// Follows SDD design: policy by operation

import {
  type IValkeyClient,
  type IFallbackCache,
  type ValkeyLogger,
  type ValkeyStreamEntry,
  type ValkeyPendingEntry,
} from './types.ts';

export class ValkeyFallbackWrapper implements IValkeyClient {
  private client: IValkeyClient;
  private fallback: IFallbackCache | null = null;
  private logger: ValkeyLogger | null = null;
  private useFallback: boolean = false;

  constructor(
    client: IValkeyClient,
    options?: {
      fallback?: IFallbackCache;
      logger?: ValkeyLogger;
    },
  ) {
    this.client = client;
    this.fallback = options?.fallback ?? null;
    this.logger = options?.logger ?? null;
  }

  // =============================================================================
  // Lifecycle
  // =============================================================================

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.useFallback = false;
    } catch (err) {
      this.logger?.error('Failed to connect to Valkey', {
        error: err instanceof Error ? err.message : String(err),
      });
      this.useFallback = this.fallback !== null;
      if (!this.useFallback) {
        throw err;
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  // =============================================================================
  // Cache Operations (fallback on failure)
  // =============================================================================

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await this.client.get<T>(key);
    } catch (err) {
      this.logger?.warn('Valkey get failed, trying fallback', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      if (this.fallback) {
        return this.fallback.get<T>(key);
      }
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set<T>(key, value, ttlSeconds);
    } catch (err) {
      this.logger?.warn('Valkey set failed, dropping', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      // Silently drop per design
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger?.warn('Valkey del failed, dropping', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      // Silently drop per design
    }
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number,
  ): Promise<T> {
    try {
      return await this.client.getOrSet<T>(key, fetchFn, ttlSeconds);
    } catch (err) {
      this.logger?.warn('Valkey getOrSet failed, trying fallback', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      if (this.fallback) {
        const cached = await this.fallback.get<T>(key);
        if (cached !== undefined) {
          return cached;
        }
        // Fetch and store in fallback
        const value = await fetchFn();
        await this.fallback.set<T>(key, value, ttlSeconds);
        return value;
      }
      // No fallback - try fetchFn directly
      return fetchFn();
    }
  }

  // =============================================================================
  // Pub/Sub (fire-and-forget)
  // =============================================================================

  async publish(channel: string, payload: object): Promise<void> {
    try {
      await this.client.publish(channel, payload);
    } catch (err) {
      this.logger?.warn('Valkey publish failed', {
        channel,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fire-and-forget per design
    }
  }

  subscribe(
    channel: string,
    handler: (payload: object) => void,
  ): () => void {
    return this.client.subscribe(channel, handler);
  }

  // =============================================================================
  // Streams (throw on failure)
  // =============================================================================

  async streamAdd(
    stream: string,
    fields: Record<string, string>,
    maxLen?: number,
  ): Promise<string> {
    return this.client.streamAdd(stream, fields, maxLen);
  }

  async streamRead(
    stream: string,
    consumerGroup: string,
    consumer: string,
    count?: number,
  ): Promise<ValkeyStreamEntry[]> {
    return this.client.streamRead(stream, consumerGroup, consumer, count);
  }

  async streamReadGroup(
    stream: string,
    consumerGroup: string,
    consumer: string,
    count?: number,
    blockMs?: number,
  ): Promise<ValkeyStreamEntry[]> {
    return this.client.streamReadGroup(stream, consumerGroup, consumer, count, blockMs);
  }

  async streamAck(
    stream: string,
    consumerGroup: string,
    messageIds: string[],
  ): Promise<void> {
    return this.client.streamAck(stream, consumerGroup, messageIds);
  }

  async streamClaim(
    stream: string,
    consumerGroup: string,
    minIdleMs: number,
    messageIds: string[],
    consumer: string,
  ): Promise<ValkeyStreamEntry[]> {
    return this.client.streamClaim(
      stream,
      consumerGroup,
      minIdleMs,
      messageIds,
      consumer,
    );
  }

  async streamCreateGroup(
    stream: string,
    consumerGroup: string,
    start?: string,
  ): Promise<void> {
    return this.client.streamCreateGroup(stream, consumerGroup, start);
  }

  async streamPending(
    stream: string,
    consumerGroup: string,
    start?: string,
    end?: string,
    count?: number,
  ): Promise<ValkeyPendingEntry[]> {
    return this.client.streamPending(stream, consumerGroup, start, end, count);
  }

  // =============================================================================
  // Set operations (for guild stream registry)
  // =============================================================================

  async setAdd(key: string, ...members: string[]): Promise<number> {
    return this.client.setAdd(key, ...members);
  }

  async setMembers(key: string): Promise<string[]> {
    return this.client.setMembers(key);
  }

  async setRemove(key: string, ...members: string[]): Promise<number> {
    return this.client.setRemove(key, ...members);
  }

  async setIsMember(key: string, member: string): Promise<boolean> {
    return this.client.setIsMember(key, member);
  }

  // =============================================================================
  // Sorted Set operations (for guild stream registry with TTL)
  // =============================================================================

  async sortedSetAdd(key: string, score: number, member: string): Promise<number> {
    return this.client.sortedSetAdd(key, score, member);
  }

  async sortedSetRemove(key: string, member: string): Promise<number> {
    return this.client.sortedSetRemove(key, member);
  }

  async sortedSetRangeByScore(
    key: string,
    min: number,
    max: number,
    limit?: number,
  ): Promise<string[]> {
    return this.client.sortedSetRangeByScore(key, min, max, limit);
  }

  async sortedSetRemoveByScore(key: string, max: number): Promise<number> {
    return this.client.sortedSetRemoveByScore(key, max);
  }

  // =============================================================================
  // Rate Limiting (fail-open)
  // =============================================================================

  async rateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    try {
      return await this.client.rateLimit(key, limit, windowSeconds);
    } catch (err) {
      this.logger?.error('Valkey rateLimit failed', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fail-open per design
      return true;
    }
  }

  // =============================================================================
  // Locks (fail-deny)
  // =============================================================================

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      return await this.client.acquireLock(key, ttlSeconds);
    } catch (err) {
      this.logger?.warn('Valkey acquireLock failed', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fail-deny per design
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    try {
      await this.client.releaseLock(key);
    } catch (err) {
      this.logger?.warn('Valkey releaseLock failed', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Creates a ValkeyFallbackWrapper wrapping the given client.
 */
export function createValkeyFallbackWrapper(
  client: IValkeyClient,
  options?: {
    fallback?: IFallbackCache;
    logger?: ValkeyLogger;
  },
): ValkeyFallbackWrapper {
  return new ValkeyFallbackWrapper(client, options);
}