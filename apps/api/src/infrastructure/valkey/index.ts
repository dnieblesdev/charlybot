// Valkey provider for API - singleton lifecycle
// Follows SDD design: Phase 5

import { createValkeyClient, createValkeyFallbackWrapper, loadValkeyConfig, type IValkeyClient, type IFallbackCache } from '@charlybot/shared';
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
