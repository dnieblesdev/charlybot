// Idempotency guard for Discord interactions
// Two-layer: local Set (same-process, sub-ms) + Valkey acquireLock (distributed, atomic)
// Fail-open: if Valkey is unavailable, allows execution with local Set as secondary guard
//
// TIMEOUT: Valkey acquireLock MUST return within IDEMPOTENCY_VALKEY_TIMEOUT_MS (250ms).
// Discord interactions have a 3-second window to ACK. If Valkey is slow, we MUST fail open
// rather than let the interaction token expire. A slow Valkey is NOT a security concern —
// Discord retries use the same interaction ID, and the local Set catches same-process replays.

import { getValkeyClient } from "./index";
import { loadValkeyConfig, createValkeyKeys, TTL } from "@charlybot/shared";
import logger from "../../utils/logger";

// Local in-memory set for same-process deduplication (sub-millisecond)
const processingLocal = new Set<string>();

// TTL for Valkey lock (5 minutes — Discord retries happen within seconds)
const IDEMPOTENCY_TTL = TTL.CACHE_SHORT; // 300 seconds

// Hard timeout for the Valkey call — must leave room for deferReply within Discord's 3-second window
const IDEMPOTENCY_VALKEY_TIMEOUT_MS = 250;

/**
 * Check if an interaction has already been processed.
 * Layer 1: Local Set (blocks same-process retries instantly)
 * Layer 2: Valkey acquireLock (blocks cross-process retries, distributed)
 *
 * Fail-open: if Valkey is unreachable or slow, allows the interaction to proceed.
 * The local Set still provides same-process protection.
 */
export async function isDuplicateInteraction(interactionId: string): Promise<boolean> {
  // Layer 1: Local in-memory check (sub-millisecond, no I/O)
  if (processingLocal.has(interactionId)) {
    logger.debug("Idempotency: duplicate detected in local set", { interactionId });
    return true;
  }

  // Layer 2: Valkey distributed lock (atomic SET NX EX) — with hard timeout
  try {
    const valkey = getValkeyClient();
    const config = loadValkeyConfig();
    const keys = createValkeyKeys(config);
    const key = keys.cache("idempotency", interactionId);

    const lockResult = await Promise.race([
      valkey.acquireLock(key, IDEMPOTENCY_TTL),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), IDEMPOTENCY_VALKEY_TIMEOUT_MS)),
    ]);

    if (lockResult === "timeout") {
      // Valkey did not respond in time — fail open to not risk the 3-second Discord window
      processingLocal.add(interactionId);
      logger.warn("Idempotency: Valkey acquireLock timed out, failing open", {
        interactionId,
        timeoutMs: IDEMPOTENCY_VALKEY_TIMEOUT_MS,
      });
      return false;
    }

    if (!lockResult) {
      // Lock not acquired — this is a genuine retry (key exists in Valkey from first execution)
      // Block the interaction. The error/exception path below handles Valkey being truly unreachable.
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

/**
 * Remove an interaction ID from the local processing set.
 * Call this after an interaction finishes processing (success or error).
 */
export function clearInteractionId(interactionId: string): void {
  processingLocal.delete(interactionId);
}