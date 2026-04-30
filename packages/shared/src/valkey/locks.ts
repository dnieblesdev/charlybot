// Distributed Lock Helpers — reusable across bot and API
// These functions accept IValkeyClient as explicit parameter instead of
// calling getValkeyClient() internally, making them usable from any context.

import { randomUUID } from "crypto";
import { type IValkeyClient, type ValkeyLogger } from "./types.ts";
import { loadValkeyConfig, createValkeyKeys } from "./index.ts";
import { TTL } from "./constants.ts";

/**
 * Acquire a distributed lock for an operation.
 * Uses UUID for ownership to prevent accidental release by other processes.
 * Returns the ownerId (UUID string) if acquired, null if not.
 */
export async function acquireDistributedLock(
  valkey: IValkeyClient,
  domain: string,
  resourceId: string,
  ttlSeconds: number = TTL.LOCK_DEFAULT,
  logger?: ValkeyLogger,
): Promise<string | null> {
  try {
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
    logger?.warn("Failed to acquire distributed lock", {
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
  valkey: IValkeyClient,
  domain: string,
  resourceId: string,
  ownerId: string,
  logger?: ValkeyLogger,
): Promise<void> {
  try {
    const config = loadValkeyConfig();
    const keys = createValkeyKeys(config);
    const lockKey = keys.lock(domain, resourceId);

    await valkey.releaseLock(lockKey, ownerId);
  } catch (err) {
    logger?.warn("Failed to release distributed lock", {
      domain,
      resourceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Execute a function with a distributed lock.
 * Automatically acquires and releases the lock.
 * Throws if lock cannot be acquired after maxRetries.
 */
export async function withDistributedLock<T>(
  valkey: IValkeyClient,
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

  return await valkey.withLock(lockKey, ttlSeconds, ownerId, fn, maxRetries);
}

// =============================================================================
// Domain-specific lock key generators (pure functions, no dependencies)
// =============================================================================

/**
 * Lock key for a user's economy operations in a guild.
 */
export function economyUserLockKey(guildId: string, userId: string): string {
  return `economy:user:${guildId}:${userId}`;
}

/**
 * Lock key for a transfer operation between two users.
 * Sorts user IDs to ensure same key regardless of who initiates.
 */
export function transferLockKey(
  guildId: string,
  fromUserId: string,
  toUserId: string,
): string {
  const sortedUsers = [fromUserId, toUserId].sort();
  return `economy:transfer:${guildId}:${sortedUsers[0]}:${sortedUsers[1]}`;
}

/**
 * Lock key for music queue operations in a guild.
 */
export function musicQueueLockKey(guildId: string): string {
  return `music:queue:${guildId}`;
}

/**
 * Lock key for roulette game processing (prevents concurrent result processing).
 */
export function rouletteGameLockKey(guildId: string, gameId: number): string {
  return `economy:roulettegame:${guildId}:${gameId}`;
}

/**
 * Lock key for cooldown operations (prevents concurrent cooldown claims).
 */
export function cooldownLockKey(
  guildId: string,
  userId: string,
  type: string,
): string {
  return `economy:cooldown:${guildId}:${userId}:${type}`;
}
