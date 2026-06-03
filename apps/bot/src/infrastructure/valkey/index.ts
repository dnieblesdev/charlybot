// Valkey provider for Bot - singleton lifecycle
// Follows SDD design: Phase 4

import {
  createValkeyClient,
  createValkeyFallbackWrapper,
  loadValkeyConfig,
  type IValkeyClient,
  type IFallbackCache,
} from "@charlybot/shared";
import logger from "../../utils/logger";
import { memoryCache } from "../cache/MemoryCache";

export * from "./rate-limit.ts";

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
    error: (msg, meta) => logger.error(meta ?? {}, msg),
    warn: (msg, meta) => logger.warn(meta ?? {}, msg),
    info: (msg, meta) => logger.info(meta ?? {}, msg),
    debug: (msg, meta) => logger.debug(meta ?? {}, msg),
  });

  // Wrap with fallback
  valkeyClient = createValkeyFallbackWrapper(client, {
    fallback: {
      get: async <T>(key: string) => memoryCache.get(key) as T | undefined,
      set: async <T>(key: string, value: T, ttlSeconds: number) =>
        memoryCache.set(key, value, ttlSeconds * 1000),
      del: async (key: string) => memoryCache.invalidate(key),
    } as IFallbackCache,
    logger: {
      error: (msg, meta) => logger.error(meta ?? {}, msg),
      warn: (msg, meta) => logger.warn(meta ?? {}, msg),
      info: (msg, meta) => logger.info(meta ?? {}, msg),
      debug: (msg, meta) => logger.debug(meta ?? {}, msg),
    },
  });

  try {
    await valkeyClient.connect();
    logger.info(
      {
        host: config.host,
        port: config.port,
        hasFallback: true,
      },
      "Valkey client initialized with fallback"
    );
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to connect to Valkey, using fallback only"
    );
    // valkeyClient is already configured with fallback, so it's usable
  }

  return valkeyClient;
}

/**
 * Get the Valkey client instance
 */
export function getValkeyClient(): IValkeyClient {
  if (!valkeyClient) {
    throw new Error(
      "Valkey client not initialized. Call initializeValkey() first."
    );
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
    logger.info("Valkey client disconnected");
  }
}
