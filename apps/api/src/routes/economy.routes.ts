import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { EconomyConfigSchema } from "@charlybot/shared";
import { z } from "zod";
import logger from "../utils/logger";
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
    logger.error(`Error fetching economy leaderboard for guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/v1/economy/config/:guildId
router.get("/config/:guildId", async (c) => {
  const guildId = c.req.param("guildId");

  try {
    const config = await prisma.economyConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return c.json({ error: "Economy config not found" }, 404);
    }

    return c.json(config);
  } catch (error) {
    logger.error(`Error fetching economy config for guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/economy/config/:guildId
router.patch("/config/:guildId", zValidator("json", EconomyConfigSchema.strict().partial()), async (c) => {
  const guildId = c.req.param("guildId");
  const data = c.req.valid("json");

  try {
    const config = await prisma.economyConfig.upsert({
      where: { guildId },
      update: data,
      create: { guildId, ...data },
    });

    return c.json(config);
  } catch (error) {
    logger.error(`Error updating economy config for guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
