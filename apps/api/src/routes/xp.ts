import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { UserXPSchema, XPConfigSchema, LevelRoleSchema, XPIncrementSchema } from "@charlybot/shared";
import logger from "../utils/logger";
import { guildAccessMiddleware } from "../middleware/guildAccessMiddleware";

const router = new Hono();

// Apply guild access middleware to all guild-scoped routes
router.use("/config/:guildId", guildAccessMiddleware);
router.use("/level-roles/:guildId", guildAccessMiddleware);
router.use("/leaderboard/:guildId", guildAccessMiddleware);
router.use("/:guildId/:userId", guildAccessMiddleware);

// --- XP Config (MUST be before /:guildId/:userId to avoid route collision) ---

// GET /api/v1/xp/config/:guildId
router.get("/config/:guildId", async (c) => {
  const { guildId } = c.req.param();

  try {
    const config = await prisma.xPConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return c.json({ error: "XP config not found" }, 404);
    }

    return c.json(config);
  } catch (error) {
    logger.error(`Error fetching XP config for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/xp/config
router.post("/config", zValidator("json", XPConfigSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    const config = await prisma.xPConfig.create({
      data,
    });

    return c.json(config, 201);
  } catch (error) {
    logger.error(`Error creating XP config`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/xp/config/:guildId
router.patch("/config/:guildId", zValidator("json", XPConfigSchema.partial()), async (c) => {
  const { guildId } = c.req.param();
  const data = c.req.valid("json");

  try {
    const config = await prisma.xPConfig.update({
      where: { guildId },
      data,
    });

    return c.json(config);
  } catch (error) {
    logger.error(`Error updating XP config for ${guildId}`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// --- Level Roles (also before /:guildId/:userId) ---

// GET /api/v1/xp/level-roles/:guildId
router.get("/level-roles/:guildId", async (c) => {
  const { guildId } = c.req.param();

  try {
    const levelRoles = await prisma.levelRole.findMany({
      where: { guildId },
      orderBy: { level: "asc" },
    });

    return c.json(levelRoles);
  } catch (error) {
    logger.error(`Error fetching level roles for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/xp/level-roles
router.post("/level-roles", zValidator("json", LevelRoleSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    const levelRole = await prisma.levelRole.create({
      data,
    });

    return c.json(levelRole, 201);
  } catch (error) {
    logger.error(`Error creating level role`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/v1/xp/level-roles/:guildId/:level
router.delete("/level-roles/:guildId/:level", async (c) => {
  const { guildId, level } = c.req.param();
  const levelInt = Number.parseInt(level, 10);

  try {
    await prisma.levelRole.delete({
      where: { guildId_level: { guildId, level: levelInt } },
    });

    return c.json({ message: "Level role deleted" });
  } catch (error: any) {
    if (error.code === "P2025") {
      return c.json({ error: "Level role not found" }, 404);
    }
    logger.error(`Error deleting level role for ${guildId} at level ${levelInt}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// --- Leaderboard (also before /:guildId/:userId) ---

// GET /api/v1/xp/leaderboard/:guildId
router.get("/leaderboard/:guildId", async (c) => {
  const { guildId } = c.req.param();
  const page = Math.max(1, parseInt(c.req.query("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "20")));
  const skip = (page - 1) * limit;

  try {
    const [data, total] = await Promise.all([
      prisma.userXP.findMany({
        where: { guildId },
        orderBy: [{ xp: "desc" }, { lastMessageAt: "asc" }],
        skip,
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
    logger.error(`Error fetching XP leaderboard for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// --- User XP (MUST be last — uses wildcard /:guildId/:userId) ---

// GET /api/v1/xp/:guildId/:userId
router.get("/:guildId/:userId", async (c) => {
  const { guildId, userId } = c.req.param();

  try {
    const userXP = await prisma.userXP.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });

    if (!userXP) {
      return c.json({ error: "User XP not found" }, 404);
    }

    return c.json(userXP);
  } catch (error) {
    logger.error(`Error fetching user XP for ${userId} in ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/xp - Upsert user XP (legacy - valor absoluto)
router.post("/", zValidator("json", UserXPSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    const userXP = await prisma.userXP.upsert({
      where: { userId_guildId: { userId: data.userId, guildId: data.guildId } },
      update: data,
      create: data,
    });

    return c.json(userXP, 201);
  } catch (error) {
    logger.error(`Error upserting user XP`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/xp/increment - Incremento atómico de XP (evita race conditions)
router.post("/increment", zValidator("json", XPIncrementSchema), async (c) => {
  const { userId, guildId, username, xpIncrement, nivel, lastMessageAt } = c.req.valid("json");

  try {
    // Usa incremento atómico de Prisma: xp: { increment: N }
    const userXP = await prisma.userXP.upsert({
      where: { userId_guildId: { userId, guildId } },
      update: {
        xp: { increment: xpIncrement },
        nivel,
        username,
        lastMessageAt,
      },
      create: {
        userId,
        guildId,
        username,
        xp: xpIncrement,
        nivel,
        lastMessageAt,
      },
    });

    return c.json(userXP, 201);
  } catch (error) {
    logger.error(`Error incrementing user XP`, { error, userId, guildId, xpIncrement });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
