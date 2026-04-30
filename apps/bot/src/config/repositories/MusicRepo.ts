import { prisma, MAX_QUEUE_SIZE } from "@charlybot/shared";
import logger from "../../utils/logger";
import type { IMusicQueue, IMusicQueueItem, IGuildMusicConfig } from "@charlybot/shared";
import type { IMusicRepository } from "../../domain/ports/IMusicRepository";
import { withDistributedLock, musicQueueLockKey } from "@charlybot/shared/valkey";
import { getValkeyClient } from "../../infrastructure/valkey/index.ts";

/**
 * Obtiene la cola de música para un guild, incluyendo sus items.
 */
export async function getMusicQueue(guildId: string): Promise<IMusicQueue | null> {
  try {
    const queue = await prisma.musicQueue.findUnique({
      where: { guildId },
      include: {
        items: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (!queue) return null;

    // Map to IMusicQueue interface
    return {
      id: queue.id,
      guildId: queue.guildId,
      currentSongId: queue.currentSongId,
      isPlaying: queue.isPlaying,
      isPaused: queue.isPaused,
      volume: queue.volume,
      loopMode: queue.loopMode as "none" | "song" | "queue",
      lastSeek: queue.lastSeek,
      updatedAt: queue.updatedAt,
      createdAt: queue.createdAt,
      items: queue.items.map((item) => ({
        id: item.id,
        queueId: item.queueId,
        title: item.title,
        url: item.url,
        duration: item.duration ?? 0,
        thumbnail: item.thumbnail,
        position: item.position,
        requesterId: item.requesterId,
        requesterName: item.requesterName,
        createdAt: item.createdAt,
      })),
    };
  } catch (error) {
    logger.error("Error fetching music queue via Prisma", {
      error: error instanceof Error ? error.message : String(error),
      guildId,
    });
    throw error;
  }
}

/**
 * Agrega un track a la cola de música del guild.
 */
export async function addToMusicQueue(
  guildId: string,
  track: Omit<IMusicQueueItem, "id" | "queueId" | "position" | "createdAt">
): Promise<IMusicQueueItem> {
  try {
    // Distributed lock prevents concurrent adds from bypassing MAX_QUEUE_SIZE
    const newItem = await withDistributedLock(
      getValkeyClient(),
      "music",
      musicQueueLockKey(guildId),
      async () => {
        // Atomic transaction: find/create queue + count + create item
        return prisma.$transaction(async (tx) => {
          let queue = await tx.musicQueue.findUnique({
            where: { guildId },
          });

          if (!queue) {
            queue = await tx.musicQueue.create({
              data: { guildId },
            });
          }

          // Get current items count to check capacity
          const itemCount = await tx.musicQueueItem.count({
            where: { queueId: queue.id },
          });

          // Check capacity before inserting
          if (itemCount >= MAX_QUEUE_SIZE) {
            throw new Error(`Queue limit of ${MAX_QUEUE_SIZE} reached`);
          }

          return tx.musicQueueItem.create({
            data: {
              title: track.title,
              url: track.url,
              duration: track.duration,
              thumbnail: track.thumbnail,
              requesterId: track.requesterId,
              requesterName: track.requesterName,
              queueId: queue.id,
              position: itemCount,
            },
          });
        });
      },
    );

    logger.info("Track added to music queue via Prisma", {
      guildId,
      title: track.title,
      position: newItem.position,
    });

    return {
      id: newItem.id,
      queueId: newItem.queueId,
      title: newItem.title,
      url: newItem.url,
      duration: newItem.duration ?? 0,
      thumbnail: newItem.thumbnail,
      position: newItem.position,
      requesterId: newItem.requesterId,
      requesterName: newItem.requesterName,
      createdAt: newItem.createdAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(`Queue limit of ${MAX_QUEUE_SIZE} reached`)) {
      throw error;
    }
    logger.error("Error adding track to music queue via Prisma", {
      error: message,
      guildId,
      track,
    });
    throw error;
  }
}

/**
 * Remueve un track de la cola en una posición específica.
 */
export async function removeFromMusicQueue(
  guildId: string,
  position: number
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const queue = await tx.musicQueue.findUnique({
        where: { guildId },
      });

      if (!queue) {
        throw new Error("Queue not found");
      }

      const itemToDelete = await tx.musicQueueItem.findFirst({
        where: { queueId: queue.id, position },
      });

      if (!itemToDelete) {
        throw new Error("Item not found at this position");
      }

      // Delete the item
      await tx.musicQueueItem.delete({
        where: { id: itemToDelete.id },
      });

      // Reorder remaining items
      await tx.$executeRaw`
        UPDATE MusicQueueItem 
        SET position = position - 1 
        WHERE queueId = ${queue.id} AND position > ${position}
      `;
    });

    logger.info("Track removed from music queue via Prisma", {
      guildId,
      position,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Queue not found" || message === "Item not found at this position") {
      throw error;
    }
    logger.error("Error removing track from music queue via Prisma", {
      error: message,
      guildId,
      position,
    });
    throw error;
  }
}

/**
 * Limpia todos los items de la cola de música del guild.
 */
export async function clearMusicQueue(guildId: string): Promise<void> {
  try {
    const queue = await prisma.musicQueue.findUnique({
      where: { guildId },
    });

    if (!queue) {
      throw new Error("Queue not found");
    }

    await prisma.musicQueueItem.deleteMany({
      where: { queueId: queue.id },
    });

    logger.info("Music queue cleared via Prisma", { guildId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Queue not found") {
      throw error;
    }
    logger.error("Error clearing music queue via Prisma", {
      error: message,
      guildId,
    });
    throw error;
  }
}

/**
 * Actualiza los settings de la cola (volume, loopMode, isPlaying, isPaused).
 */
export async function updateMusicQueueSettings(
  guildId: string,
  settings: Partial<Omit<IMusicQueue, "id" | "guildId" | "items" | "updatedAt" | "createdAt">>
): Promise<IMusicQueue> {
  try {
    const queue = await prisma.musicQueue.upsert({
      where: { guildId },
      update: settings,
      create: {
        ...settings,
        guildId,
      } as any,
    });

    logger.info("Music queue settings updated via Prisma", {
      guildId,
      settings,
    });

    // Fetch full queue with items
    const fullQueue = await prisma.musicQueue.findUnique({
      where: { guildId },
      include: {
        items: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (!fullQueue) {
      throw new Error("Queue not found after upsert");
    }

    return {
      id: fullQueue.id,
      guildId: fullQueue.guildId,
      currentSongId: fullQueue.currentSongId,
      isPlaying: fullQueue.isPlaying,
      isPaused: fullQueue.isPaused,
      volume: fullQueue.volume,
      loopMode: fullQueue.loopMode as "none" | "song" | "queue",
      lastSeek: fullQueue.lastSeek,
      updatedAt: fullQueue.updatedAt,
      createdAt: fullQueue.createdAt,
      items: fullQueue.items.map((item) => ({
        id: item.id,
        queueId: item.queueId,
        title: item.title,
        url: item.url,
        duration: item.duration ?? 0,
        thumbnail: item.thumbnail,
        position: item.position,
        requesterId: item.requesterId,
        requesterName: item.requesterName,
        createdAt: item.createdAt,
      })),
    };
  } catch (error) {
    logger.error("Error updating music queue settings via Prisma", {
      error: error instanceof Error ? error.message : String(error),
      guildId,
      settings,
    });
    throw error;
  }
}

/**
 * Obtiene la configuración de música del guild.
 */
export async function getMusicConfig(guildId: string): Promise<IGuildMusicConfig | null> {
  try {
    const config = await prisma.guildMusicConfig.findUnique({
      where: { guildId },
    });

    if (!config) return null;

    return {
      id: config.id,
      guildId: config.guildId,
      defaultVolume: config.defaultVolume,
      autoCleanup: config.autoCleanup,
      maxQueueSize: config.maxQueueSize,
      updatedAt: config.updatedAt,
      createdAt: config.createdAt,
    };
  } catch (error) {
    logger.error("Error fetching music config via Prisma", {
      error: error instanceof Error ? error.message : String(error),
      guildId,
    });
    throw error;
  }
}

/**
 * Crea o actualiza la configuración de música del guild.
 */
export async function upsertMusicConfig(
  guildId: string,
  config: Partial<Omit<IGuildMusicConfig, "id" | "guildId" | "updatedAt" | "createdAt">>
): Promise<IGuildMusicConfig> {
  try {
    const result = await prisma.guildMusicConfig.upsert({
      where: { guildId },
      update: config,
      create: {
        ...config,
        guildId,
      } as any,
    });

    logger.info("Music config upserted via Prisma", {
      guildId,
      defaultVolume: result.defaultVolume,
    });

    return {
      id: result.id,
      guildId: result.guildId,
      defaultVolume: result.defaultVolume,
      autoCleanup: result.autoCleanup,
      maxQueueSize: result.maxQueueSize,
      updatedAt: result.updatedAt,
      createdAt: result.createdAt,
    };
  } catch (error) {
    logger.error("Error upserting music config via Prisma", {
      error: error instanceof Error ? error.message : String(error),
      guildId,
      config,
    });
    throw error;
  }
}

// ============================================================================
// PrismaMusicAdapter - implements IMusicRepository for backward compatibility
// ============================================================================

import type { GuildMusicConfig, MusicQueue, MusicQueueItem } from "@charlybot/shared";

/**
 * Adapter that implements IMusicRepository using direct Prisma calls.
 * Used by QueueManagementService to replace HttpMusicAdapter.
 */
export class PrismaMusicAdapter implements IMusicRepository {
  async getQueue(guildId: string): Promise<IMusicQueue | null> {
    return getMusicQueue(guildId);
  }

  async addToQueue(
    guildId: string,
    track: Omit<IMusicQueueItem, "id" | "queueId" | "position" | "createdAt">
  ): Promise<IMusicQueueItem> {
    return addToMusicQueue(guildId, track);
  }

  async removeFromQueue(guildId: string, position: number): Promise<void> {
    return removeFromMusicQueue(guildId, position);
  }

  async clearQueue(guildId: string): Promise<void> {
    return clearMusicQueue(guildId);
  }

  async updateSettings(
    guildId: string,
    settings: Partial<Omit<IMusicQueue, "id" | "guildId" | "items" | "updatedAt" | "createdAt">>
  ): Promise<IMusicQueue> {
    return updateMusicQueueSettings(guildId, settings);
  }

  async getConfig(guildId: string): Promise<IGuildMusicConfig | null> {
    return getMusicConfig(guildId);
  }

  async upsertConfig(
    guildId: string,
    config: Partial<Omit<IGuildMusicConfig, "id" | "guildId" | "updatedAt" | "createdAt">>
  ): Promise<IGuildMusicConfig> {
    return upsertMusicConfig(guildId, config);
  }
}