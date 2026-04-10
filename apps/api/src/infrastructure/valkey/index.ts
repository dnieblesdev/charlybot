// Valkey provider for API - singleton lifecycle
// Follows SDD design: Phase 5

import { createValkeyClient, createValkeyFallbackWrapper, loadValkeyConfig, type IValkeyClient, type IFallbackCache } from '@charlybot/shared';
import logger from '../../utils/logger';

// Simple in-memory fallback for API (since it doesn't have MemoryCache like bot)
class ApiMemoryFallback implements IFallbackCache {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
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
