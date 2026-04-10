// Valkey provider for Bot - singleton lifecycle
// Follows SDD design: Phase 4

import { createValkeyClient, createValkeyFallbackWrapper, loadValkeyConfig, type IValkeyClient, type IFallbackCache } from '@charlybot/shared';
import logger from '../../utils/logger';
import { memoryCache } from '../api/MemoryCache';

// Singleton instance
let valkeyClient: IValkeyClient | null = null;

/**
 * Initialize Valkey client with fallback to MemoryCache
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
    fallback: {
      get: async <T>(key: string) => memoryCache.get(key) as T | undefined,
      set: async <T>(key: string, value: T, ttlSeconds: number) => memoryCache.set(key, value, ttlSeconds * 1000),
      del: async (key: string) => memoryCache.invalidate(key),
    } as IFallbackCache,
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
