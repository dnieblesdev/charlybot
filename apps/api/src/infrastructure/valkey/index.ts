// Valkey provider for API - singleton lifecycle
// Follows SDD design: Phase 5

import { createValkeyClient, createValkeyFallbackWrapper, loadValkeyConfig, createValkeyKeys, type IValkeyClient, type IFallbackCache, TTL } from '@charlybot/shared';
import { randomUUID } from 'crypto';
import logger from '../../utils/logger';

// LRU Entry with creation timestamp for eviction
interface LRUCacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

/**
 * LRU Map with max size and TTL eviction
 * Evicts oldest entries when maxSize is exceeded
 */
class LRUCacheMap<T> {
  private cache = new Map<string, LRUCacheEntry<T>>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 1000, defaultTtlSeconds = 300) {
    this.maxSize = maxSize;
    this.ttlMs = defaultTtlSeconds * 1000;
  }

  setMaxSize(size: number): void {
    this.maxSize = size;
    this.evictIfNeeded();
  }

  setDefaultTTL(ttlSeconds: number): void {
    this.ttlMs = ttlSeconds * 1000;
  }

  private evictOldest(): void {
    // Find oldest entry by createdAt
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.cache.delete(oldestKey);
    }
  }

  private evictIfNeeded(): void {
    while (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  async get(key: string): Promise<T | undefined> {
    this.cleanExpired();
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    // Move to end (most recently used) - for optional LRU ordering
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.evictIfNeeded();
    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.ttlMs;
    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + ttl,
      createdAt: now,
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  // Stats for monitoring
  getSize(): number {
    return this.cache.size;
  }

  getMaxSize(): number {
    return this.maxSize;
  }
}

// Simple in-memory fallback for API with LRU eviction
class ApiMemoryFallback implements IFallbackCache {
  private cache = new LRUCacheMap<unknown>(1000, 300); // max 1000 entries, 5 min default TTL

  async get<T>(key: string): Promise<T | undefined> {
    return this.cache.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.cache.set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }
}

const apiFallback = new ApiMemoryFallback();

// Singleton instance
let valkeyClient: IValkeyClient | null = null;

/**
 * Initialize Valkey client with fallback to in-memory cache
 */
export async function initializeValkey(): Promise<IValkeyClient> {
  if (valkeyClient) {
    return valkeyClient;
  }

  const config = loadValkeyConfig();

  // Create the raw client
  const client = createValkeyClient(config, {
    error: (msg, meta) => logger.error(msg, meta),
    warn: (msg, meta) => logger.warn(msg, meta),
    info: (msg, meta) => logger.info(msg, meta),
    debug: (msg, meta) => logger.debug(msg, meta),
  });

  // Wrap with fallback
  valkeyClient = createValkeyFallbackWrapper(client, {
    fallback: apiFallback,
    logger: {
      error: (msg, meta) => logger.error(msg, meta),
      warn: (msg, meta) => logger.warn(msg, meta),
      info: (msg, meta) => logger.info(msg, meta),
      debug: (msg, meta) => logger.debug(msg, meta),
    },
  });

  try {
    await valkeyClient.connect();
    logger.info('Valkey client initialized with fallback', {
      host: config.host,
      port: config.port,
      hasFallback: true,
    });
  } catch (error) {
    logger.warn('Failed to connect to Valkey, using fallback only', {
      error: error instanceof Error ? error.message : String(error),
    });
    // valkeyClient is already configured with fallback, so it's usable
  }

  return valkeyClient;
}

/**
 * Get the Valkey client instance
 */
export function getValkeyClient(): IValkeyClient {
  if (!valkeyClient) {
    throw new Error('Valkey client not initialized. Call initializeValkey() first.');
  }
  return valkeyClient;
}

/**
 * Disconnect Valkey client
 */
export async function shutdownValkey(): Promise<void> {
  if (valkeyClient) {
    await valkeyClient.disconnect();
    valkeyClient = null;
    logger.info('Valkey client disconnected');
  }
}

// =============================================================================
// Distributed Lock Helpers for API operations
// =============================================================================

/**
 * Acquire a distributed lock for an operation.
 * Uses UUID for ownership to prevent accidental release by other processes.
 */
export async function acquireDistributedLock(
  domain: string,
  resourceId: string,
  ttlSeconds: number = TTL.LOCK_DEFAULT,
): Promise<string | null> {
  try {
    const valkey = getValkeyClient();
    const config = loadValkeyConfig();
    const keys = createValkeyKeys(config);
    const lockKey = keys.lock(domain, resourceId);
    const ownerId = randomUUID();

    const acquired = await valkey.acquireLock(lockKey, ttlSeconds, ownerId);
    if (!acquired) {
      return null;
    }

    return ownerId;
  } catch (err) {
    logger.warn('Failed to acquire distributed lock', {
      domain,
      resourceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Release a distributed lock.
 * Only releases if the ownerId matches (prevents releasing locks held by others).
 */
export async function releaseDistributedLock(
  domain: string,
  resourceId: string,
  ownerId: string,
): Promise<void> {
  try {
    const valkey = getValkeyClient();
    const config = loadValkeyConfig();
    const keys = createValkeyKeys(config);
    const lockKey = keys.lock(domain, resourceId);

    await valkey.releaseLock(lockKey, ownerId);
  } catch (err) {
    logger.warn('Failed to release distributed lock', {
      domain,
      resourceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Execute a function with a distributed lock.
 * Automatically acquires and releases the lock.
 */
export async function withDistributedLock<T>(
  domain: string,
  resourceId: string,
  fn: () => Promise<T>,
  ttlSeconds: number = TTL.LOCK_DEFAULT,
  maxRetries: number = 3,
): Promise<T> {
  const config = loadValkeyConfig();
  const keys = createValkeyKeys(config);
  const lockKey = keys.lock(domain, resourceId);
  const ownerId = randomUUID();

  const valkey = getValkeyClient();
  return await valkey.withLock(lockKey, ttlSeconds, ownerId, fn, maxRetries);
}

// Domain-specific lock helpers for economy operations

/**
 * Lock key for a user's economy operations in a guild
 */
export function economyUserLockKey(guildId: string, userId: string): string {
  return `economy:user:${guildId}:${userId}`;
}

/**
 * Lock key for a transfer operation between two users
 */
export function transferLockKey(guildId: string, fromUserId: string, toUserId: string): string {
  // Sort user IDs to ensure same key regardless of who initiates
  const sortedUsers = [fromUserId, toUserId].sort();
  return `economy:transfer:${guildId}:${sortedUsers[0]}:${sortedUsers[1]}`;
}

/**
 * Lock key for music queue operations in a guild
 */
export function musicQueueLockKey(guildId: string): string {
  return `music:queue:${guildId}`;
}
