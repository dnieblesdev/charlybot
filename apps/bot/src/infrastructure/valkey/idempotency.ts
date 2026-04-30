// Idempotency guard for Discord interactions
// Two-layer: local Set (same-process, sub-ms) + Valkey acquireLock (distributed, atomic)
// Fail-open: if Valkey is unavailable, allows execution with local Set as secondary guard

import { getValkeyClient } from "./index";
import { loadValkeyConfig, createValkeyKeys, TTL } from "@charlybot/shared";
import logger from "../../utils/logger";

// Local in-memory set for same-process deduplication (sub-millisecond)
const processingLocal = new Set<string>();

// TTL for Valkey lock (5 minutes — Discord retries happen within seconds)
const IDEMPOTENCY_TTL = TTL.CACHE_SHORT; // 300 seconds

/**
 * Check if an interaction has already been processed.
 * Layer 1: Local Set (blocks same-process retries instantly)
 * Layer 2: Valkey acquireLock (blocks cross-process retries, distributed)
 *
 * Fail-open: if Valkey is unreachable, allows the interaction to proceed.
 * The local Set still provides same-process protection.
 */
export async function isDuplicateInteraction(interactionId: string): Promise<boolean> {
  // Layer 1: Local in-memory check (sub-millisecond, no I/O)
  if (processingLocal.has(interactionId)) {
    logger.debug("Idempotency: duplicate detected in local set", { interactionId });
    return true;
  }

  // Layer 2: Valkey distributed lock (atomic SET NX EX)
  try {
    const valkey = getValkeyClient();
    const config = loadValkeyConfig();
    const keys = createValkeyKeys(config);
    const key = keys.cache("idempotency", interactionId);

    const acquired = await valkey.acquireLock(key, IDEMPOTENCY_TTL);

    if (!acquired) {
      // Lock not acquired — could be:
      // A) Genuine retry (key exists in Valkey from first execution)
      // B) Valkey is down (FallbackWrapper returns false on fail-deny)
      if (!valkey.isConnected()) {
        // Valkey is down → fail-open, use local Set only
        processingLocal.add(interactionId);
        logger.warn("Idempotency: Valkey unavailable, failing open", { interactionId });
        return false;
      }
      // Genuine retry → block it
      logger.debug("Idempotency: duplicate detected in Valkey", { interactionId });
      return true;
    }

    // Lock acquired → first time seeing this interaction
    processingLocal.add(interactionId);
    return false;
  } catch (error) {
    // Unexpected error → fail-open
    processingLocal.add(interactionId);
    logger.warn("Idempotency: error checking duplicate, failing open", {
      interactionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Periodic cleanup of the local in-memory set.
 * Called every 5 minutes to prevent memory leaks.
 * Interaction IDs are Snowflakes and never reused, so clearing is safe.
 */
function cleanupLocalIdempotency(): void {
  const before = processingLocal.size;
  processingLocal.clear();
  if (before > 0) {
    logger.debug(`Idempotency: cleaned up ${before} entries from local set`);
  }
}

// Periodic GC every 5 minutes
setInterval(cleanupLocalIdempotency, 5 * 60 * 1000);