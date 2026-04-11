import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma, MAX_QUEUE_SIZE } from "@charlybot/shared";
import { MusicQueueItemSchema, MusicQueueSchema, GuildMusicConfigSchema } from "@charlybot/shared";
import logger from "../utils/logger";
import { getMusicQueueCacheService } from "../services/music-queue-cache.service";

const router = new Hono();

// GET /api/v1/music/queues/:guildId
router.get("/queues/:guildId", async (c) => {
  const guildId = c.req.param("guildId");
  const cacheService = getMusicQueueCacheService();

  try {
    const queue = await cacheService.getQueue(guildId, async () => {
      return prisma.musicQueue.findUnique({
        where: { guildId },
        include: {
          items: {
            orderBy: { position: "asc" },
          },
        },
      });
    });

    if (!queue) {
      return c.json({ error: "Queue not found" }, 404);
    }

    return c.json(queue);
  } catch (error) {
    logger.error(`Error fetching music queue for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/music/queues/:guildId/items (Add to queue)
router.post("/queues/:guildId/items", zValidator("json", MusicQueueItemSchema.omit({ queueId: true, position: true })), async (c) => {
  const guildId = c.req.param("guildId");
  const itemData = c.req.valid("json");
  const cacheService = getMusicQueueCacheService();

  try {
    // Atomic transaction: find/create queue + count + create item
    const newItem = await prisma.$transaction(async (tx) => {
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
          ...itemData,
          queueId: queue.id,
          position: itemCount,
        },
      });
    });

    // Invalidate cache on mutation
    await cacheService.invalidateQueue(guildId);

    return c.json(newItem);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes(`Queue limit of ${MAX_QUEUE_SIZE} reached`)) {
      return c.json({ error: message }, 400);
    }
    logger.error(`Error adding item to queue for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/v1/music/queues/:guildId/items/:position (Remove from queue)
router.delete("/queues/:guildId/items/:position", async (c) => {
  const guildId = c.req.param("guildId");
  const position = parseInt(c.req.param("position"));
  const cacheService = getMusicQueueCacheService();

  if (isNaN(position)) {
    return c.json({ error: "Invalid position" }, 400);
  }

  try {
    const queue = await prisma.musicQueue.findUnique({
      where: { guildId },
    });

    if (!queue) {
      return c.json({ error: "Queue not found" }, 404);
    }

    const itemToDelete = await prisma.musicQueueItem.findFirst({
      where: { queueId: queue.id, position },
    });

    if (!itemToDelete) {
      return c.json({ error: "Item not found at this position" }, 404);
    }

    await prisma.musicQueueItem.delete({
      where: { id: itemToDelete.id },
    });

    // Reorder remaining items
    await prisma.$executeRaw`
      UPDATE MusicQueueItem 
      SET position = position - 1 
      WHERE queueId = ${queue.id} AND position > ${position}
    `;

    // Invalidate cache on mutation
    await cacheService.invalidateQueue(guildId);

    return c.json({ success: true });
  } catch (error) {
    logger.error(`Error removing item from queue for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/v1/music/queues/:guildId/items (Clear queue)
router.delete("/queues/:guildId/items", async (c) => {
  const guildId = c.req.param("guildId");
  const cacheService = getMusicQueueCacheService();

  try {
    const queue = await prisma.musicQueue.findUnique({
      where: { guildId },
    });

    if (!queue) {
      return c.json({ error: "Queue not found" }, 404);
    }

    await prisma.musicQueueItem.deleteMany({
      where: { queueId: queue.id },
    });

    // Invalidate cache on mutation
    await cacheService.invalidateQueue(guildId);

    return c.json({ success: true });
  } catch (error) {
    logger.error(`Error clearing queue for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PUT /api/v1/music/queues/:guildId/settings (Update queue settings)
router.put("/queues/:guildId/settings", zValidator("json", MusicQueueSchema.pick({
  volume: true,
  loopMode: true,
  isPlaying: true,
  isPaused: true,
  lastSeek: true,
  currentSongId: true,
}).partial()), async (c) => {
  const guildId = c.req.param("guildId");
  const settings = c.req.valid("json");

  try {
    const queue = await prisma.musicQueue.upsert({
      where: { guildId },
      update: settings,
      create: {
        ...settings,
        guildId,
      },
    });

    return c.json(queue);
  } catch (error) {
    logger.error(`Error updating queue settings for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/v1/music/config/:guildId (Get music config)
router.get("/config/:guildId", async (c) => {
  const guildId = c.req.param("guildId");

  try {
    const config = await prisma.guildMusicConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return c.json({ error: "Music configuration not found" }, 404);
    }

    return c.json(config);
  } catch (error) {
    logger.error(`Error fetching music config for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PUT /api/v1/music/config/:guildId (Upsert music config)
router.put("/config/:guildId", zValidator("json", GuildMusicConfigSchema.partial()), async (c) => {
  const guildId = c.req.param("guildId");
  const data = c.req.valid("json");

  try {
    const config = await prisma.guildMusicConfig.upsert({
      where: { guildId },
      update: data,
      create: {
        ...data,
        guildId,
      },
    });

    return c.json(config);
  } catch (error) {
    logger.error(`Error updating music config for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
