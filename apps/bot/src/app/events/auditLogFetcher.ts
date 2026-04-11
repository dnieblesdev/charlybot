// Audit log fetcher for message delete correlation
// Fetches Discord audit logs and correlates with deleted messages

import { AuditLogEvent, type Guild } from 'discord.js';
import logger from '../../utils/logger';

/** Result of audit log correlation */
export interface AuditLogCorrelation {
  executor: {
    id: string;
    tag: string | null;
    avatarURL?: string;
  } | null;
  isSelfDelete: boolean;
  entryId: string;
  timestamp: Date;
}

/**
 * Wait for audit logs to populate (Discord async delay)
 */
async function waitForAuditLogs(): Promise<void> {
  // Wait 500ms for audit logs to be available
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Find the executor who deleted a message by correlating audit logs
 * 
 * @param guild - The Discord guild
 * @param channelId - The channel where the message was deleted
 * @param targetUserId - The ID of the message author (target)
 * @param deletedAt - Approximate time when the message was deleted
 * @returns Correlation result or null if no match found
 */
export async function findMessageDeleteExecutor(
  guild: Guild,
  channelId: string,
  targetUserId: string,
  deletedAt: Date,
): Promise<AuditLogCorrelation | null> {
  try {
    // Wait for audit logs to populate
    await waitForAuditLogs();

    // Fetch recent audit logs for message deletions
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MessageDelete,
      limit: 5,
    });

    if (!auditLogs || auditLogs.entries.size === 0) {
      logger.debug('No audit log entries found for message deletion', {
        guildId: guild.id,
        channelId,
        targetUserId,
      });
      return null;
    }

    // Find matching entry by channel, target, and timestamp
    // Timestamp window: 5 seconds
    const timestampWindow = 5000;
    const minTime = new Date(deletedAt.getTime() - timestampWindow);
    const maxTime = new Date(deletedAt.getTime() + timestampWindow);

    for (const entry of auditLogs.entries.values()) {
      // Check if entry is within timestamp window
      if (!entry.createdAt || entry.createdAt < minTime || entry.createdAt > maxTime) {
        continue;
      }

      // Check if target matches (the message author)
      if (entry.target?.id !== targetUserId) {
        continue;
      }

      // Check if channel matches via extra
      const extraChannelId = (entry as unknown as { extra?: { channel?: { id?: string } } }).extra?.channel?.id;
      if (extraChannelId !== channelId) {
        continue;
      }

      // Found matching entry - extract executor info
      const executor = entry.executor;
      const isSelfDelete = executor?.id === targetUserId;

      logger.debug('Matched audit log entry to message deletion', {
        guildId: guild.id,
        entryId: entry.id,
        executorId: executor?.id,
        targetId: targetUserId,
        isSelfDelete,
      });

      return {
        executor: executor
          ? {
              id: executor.id,
              tag: executor.tag,
              avatarURL: executor.displayAvatarURL({ size: 256 }),
            }
          : null,
        isSelfDelete,
        entryId: entry.id,
        timestamp: entry.createdAt,
      };
    }

    // No matching entry found within window
    logger.debug('No matching audit log entry found for message deletion', {
      guildId: guild.id,
      channelId,
      targetUserId,
      deletedAt: deletedAt.toISOString(),
    });

    return null;
  } catch (error) {
    // Handle Discord API errors gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('Missing Access')) {
      logger.warn('Missing audit log permissions in guild', {
        guildId: guild.id,
      });
    } else if (errorMessage.includes('Rate limit')) {
      logger.warn('Rate limited when fetching audit logs', {
        guildId: guild.id,
      });
    } else {
      logger.error('Error fetching audit logs', {
        guildId: guild.id,
        error: errorMessage,
      });
    }

    // Return null instead of throwing - graceful degradation
    return null;
  }
}