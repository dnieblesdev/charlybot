import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { GuildMusicConfigSchema } from "@charlybot/shared";
import { z } from "zod";
import { logRouteError } from "../utils/logRouteError";
import { authMiddleware } from "../middleware/authMiddleware";
import { guildAccessMiddleware } from "../middleware/guildAccessMiddleware";

const router = new Hono();

// Apply auth + guild access middleware to all routes
router.use("/*", authMiddleware);
router.use("/*", guildAccessMiddleware);

// GET /api/v1/music/queues/:guildId
router.get("/queues/:guildId", async (c) => {
  const guildId = c.req.param("guildId");
  const logger = c.get("logger");

  try {
    const queue = await prisma.musicQueue.findUnique({
      where: { guildId },
      include: {
        items: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (!queue) {
      return c.json({ error: "Music queue not found" }, 404);
    }

    return c.json(queue);
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", guild_id: guildId, operation: "fetch_music_queue" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/v1/music/config/:guildId
router.get("/config/:guildId", async (c) => {
  const guildId = c.req.param("guildId");
  const logger = c.get("logger");

  try {
    const config = await prisma.guildMusicConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return c.json({ error: "Music config not found" }, 404);
    }

    return c.json(config);
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", guild_id: guildId, operation: "fetch_music_config" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PUT /api/v1/music/config/:guildId
router.put("/config/:guildId", zValidator("json", GuildMusicConfigSchema.strict().partial()), async (c) => {
  const guildId = c.req.param("guildId");
  const data = c.req.valid("json");
  const logger = c.get("logger");

  try {
    const config = await prisma.guildMusicConfig.upsert({
      where: { guildId },
      update: data,
      create: { guildId, ...data },
    });

    return c.json(config);
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "config_update_failed", guild_id: guildId, operation: "update_music_config" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
