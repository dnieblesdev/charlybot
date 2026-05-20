import { prisma } from "@charlybot/shared";
import logger from "../../utils/logger";
import type { IAntiSpamHistory, IAntiSpamPattern, IAntiSpamAction } from "@charlybot/shared/schemas/antispam";

/**
 * Create a new anti-spam history record.
 */
export async function create(data: {
  guildId: string;
  userId: string;
  pattern: IAntiSpamPattern;
  action: IAntiSpamAction;
  reason?: string;
}): Promise<IAntiSpamHistory> {
  try {
    const record = await prisma.antiSpamHistory.create({
      data: {
        guildId: data.guildId,
        userId: data.userId,
        pattern: data.pattern,
        action: data.action,
        reason: data.reason ?? null,
      },
    });

    logger.info("AntiSpamHistory created", {
      guildId: record.guildId,
      userId: record.userId,
      pattern: record.pattern,
    });

    return {
      id: record.id,
      guildId: record.guildId,
      userId: record.userId,
      pattern: record.pattern as IAntiSpamPattern,
      action: record.action as IAntiSpamAction,
      reason: record.reason ?? null,
      createdAt: record.createdAt ?? undefined,
    };
  } catch (error) {
    logger.error("Error creating AntiSpamHistory", {
      error: error instanceof Error ? error.message : String(error),
      guildId: data.guildId,
      userId: data.userId,
    });
    throw error;
  }
}

/**
 * Count anti-spam history records for a user in a guild since a given date.
 * Used for escalation tracking.
 */
export async function countRecentByUser(
  guildId: string,
  userId: string,
  since: Date,
): Promise<number> {
  try {
    const count = await prisma.antiSpamHistory.count({
      where: {
        guildId,
        userId,
        createdAt: {
          gte: since,
        },
      },
    });

    return count;
  } catch (error) {
    logger.error("Error counting recent AntiSpamHistory", {
      error: error instanceof Error ? error.message : String(error),
      guildId,
      userId,
      since,
    });
    throw error;
  }
}

/**
 * Get recent anti-spam history records for a user in a guild.
 * Ordered by createdAt descending.
 */
export async function getRecentByUser(
  guildId: string,
  userId: string,
  since: Date,
  limit: number = 10,
): Promise<IAntiSpamHistory[]> {
  try {
    const records = await prisma.antiSpamHistory.findMany({
      where: {
        guildId,
        userId,
        createdAt: {
          gte: since,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return records.map((record): IAntiSpamHistory => ({
      id: record.id,
      guildId: record.guildId,
      userId: record.userId,
      pattern: record.pattern as IAntiSpamPattern,
      action: record.action as IAntiSpamAction,
      reason: record.reason ?? null,
      createdAt: record.createdAt ?? undefined,
    }));
  } catch (error) {
    logger.error("Error getting recent AntiSpamHistory", {
      error: error instanceof Error ? error.message : String(error),
      guildId,
      userId,
      since,
    });
    throw error;
  }
}