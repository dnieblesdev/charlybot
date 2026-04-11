// Audit log cache utilities for message delete correlation
// Caches audit log entry IDs to prevent duplicate processing

import { getValkeyClient } from './index';
import { createValkeyKeys, loadValkeyConfig } from '@charlybot/shared';
import type { IValkeyClient } from '@charlybot/shared';

// TTL constants for audit log caching (in seconds)
const AUDIT_CACHE_TTL = {
  /** Last entry ID cache - short TTL to handle rapid deletions */
  LAST_ENTRY_ID: 10,
  /** Processed entry ID cache - longer TTL to prevent re-processing */
  PROCESSED_ENTRY: 300, // 5 minutes
} as const;

// Initialize Valkey keys with config
const valkeyKeys = createValkeyKeys(loadValkeyConfig());

/**
 * Check if an audit log entry has already been processed
 * @param guildId - The guild ID
 * @param entryId - The audit log entry ID to check
 * @returns true if already processed, false otherwise
 */
export async function wasProcessed(guildId: string, entryId: string): Promise<boolean> {
  try {
    const client = getValkeyClient();
    const key = valkeyKeys.auditLogProcessedEntryId(guildId, entryId);
    const result = await client.get<string>(key);
    return result !== undefined;
  } catch {
    // Fallback: treat as not processed if cache fails
    return false;
  }
}

/**
 * Mark an audit log entry as processed
 * @param guildId - The guild ID
 * @param entryId - The audit log entry ID to mark
 * @param ttlSeconds - TTL for the cache entry (defaults to 5 minutes)
 */
export async function markProcessed(
  guildId: string,
  entryId: string,
  ttlSeconds: number = AUDIT_CACHE_TTL.PROCESSED_ENTRY,
): Promise<void> {
  try {
    const client = getValkeyClient();
    const key = valkeyKeys.auditLogProcessedEntryId(guildId, entryId);
    await client.set(key, '1', ttlSeconds);
  } catch {
    // Silent fail - don't block processing if cache fails
  }
}

/**
 * Get the cached last audit log entry ID for a guild
 * @param guildId - The guild ID
 * @returns The cached entry ID or null if not found
 */
export async function getLastEntryId(guildId: string): Promise<string | null> {
  try {
    const client = getValkeyClient();
    const key = valkeyKeys.auditLogLastEntryId(guildId);
    const result = await client.get<string>(key);
    return result ?? null;
  } catch {
    return null;
  }
}

/**
 * Set the last audit log entry ID for a guild
 * @param guildId - The guild ID
 * @param entryId - The audit log entry ID to cache
 * @param ttlSeconds - TTL for the cache entry (defaults to 10 seconds)
 */
export async function setLastEntryId(
  guildId: string,
  entryId: string,
  ttlSeconds: number = AUDIT_CACHE_TTL.LAST_ENTRY_ID,
): Promise<void> {
  try {
    const client = getValkeyClient();
    const key = valkeyKeys.auditLogLastEntryId(guildId);
    await client.set(key, entryId, ttlSeconds);
  } catch {
    // Silent fail - don't block processing if cache fails
  }
}

/**
 * Check if we should fetch audit logs (entry ID changed or no cache)
 * @param guildId - The guild ID
 * @param currentEntryId - The current/latest audit log entry ID
 * @returns true if we should fetch, false if we can skip
 */
export async function shouldFetchAuditLogs(
  guildId: string,
  currentEntryId: string,
): Promise<boolean> {
  const cachedEntryId = await getLastEntryId(guildId);
  return cachedEntryId !== currentEntryId;
}