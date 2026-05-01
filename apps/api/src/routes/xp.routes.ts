import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { XPConfigSchema } from "@charlybot/shared";
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

// GET /api/v1/xp/leaderboard/:guildId?limit=100
router.get("/leaderboard/:guildId", async (c) => {
  const guildId = c.req.param("guildId");
  const { page, limit } = PaginationSchema.parse(c.req.query());

  try {
    const [data, total] = await Promise.all([
      prisma.userXP.findMany({
        where: { guildId },
        orderBy: { xp: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userXP.count({ where: { guildId } }),
    ]);

    return c.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error(`Error fetching XP leaderboard for guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/v1/xp/level-roles/:guildId
router.get("/level-roles/:guildId", async (c) => {
  const guildId = c.req.param("guildId");

  try {
    const roles = await prisma.levelRole.findMany({
      where: { guildId },
      orderBy: { level: "asc" },
    });

    return c.json(roles);
  } catch (error) {
    logger.error(`Error fetching level roles for guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/v1/xp/:guildId/:userId — user XP + economy data
router.get("/:guildId/:userId", async (c) => {
  const { guildId, userId } = c.req.param();

  try {
    const [userXP, userEconomy] = await Promise.all([
      prisma.userXP.findUnique({
        where: { userId_guildId: { userId, guildId } },
      }),
      prisma.userEconomy.findUnique({
        where: { userId_guildId: { userId, guildId } },
      }),
    ]);

    if (!userXP) {
      return c.json({ error: "User XP not found" }, 404);
    }

    return c.json({
      xp: userXP,
      economy: userEconomy,
    });
  } catch (error) {
    logger.error(`Error fetching XP and economy for user ${userId} in guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
