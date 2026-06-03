import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { EconomyConfigSchema } from "@charlybot/shared";
import { z } from "zod";
import { logRouteError } from "../utils/logRouteError";
import { authMiddleware } from "../middleware/authMiddleware";
import { guildAccessMiddleware } from "../middleware/guildAccessMiddleware";

const router = new Hono();

// Apply auth + guild access middleware to all routes
router.use("/*", authMiddleware);
router.use("/*", guildAccessMiddleware);

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

// GET /api/v1/economy/leaderboard/:guildId?limit=100
router.get("/leaderboard/:guildId", async (c) => {
  const guildId = c.req.param("guildId");
  const { page, limit } = PaginationSchema.parse(c.req.query());
  const logger = c.get("logger");

  try {
    const [data, total] = await Promise.all([
      prisma.leaderboard.findMany({
        where: { guildId },
        orderBy: { totalMoney: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.leaderboard.count({ where: { guildId } }),
    ]);

    return c.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", guild_id: guildId, operation: "fetch_economy_leaderboard" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/v1/economy/config/:guildId
router.get("/config/:guildId", async (c) => {
  const guildId = c.req.param("guildId");
  const logger = c.get("logger");

  try {
    const config = await prisma.economyConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return c.json({ error: "Economy config not found" }, 404);
    }

    return c.json(config);
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", guild_id: guildId, operation: "fetch_economy_config" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/economy/config/:guildId
router.patch("/config/:guildId", zValidator("json", EconomyConfigSchema.strict().partial()), async (c) => {
  const guildId = c.req.param("guildId");
  const data = c.req.valid("json");
  const logger = c.get("logger");

  try {
    const config = await prisma.economyConfig.upsert({
      where: { guildId },
      update: data,
      create: { guildId, ...data },
    });

    return c.json(config);
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "config_update_failed", guild_id: guildId, operation: "update_economy_config" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
