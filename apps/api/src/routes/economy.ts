import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { UserEconomySchema, GlobalBankSchema, EconomyConfigSchema } from "@charlybot/shared";
import logger from "../utils/logger";
import { z } from "zod";

const router = new Hono();

// --- Schemas for atomic operations ---

const TransferSchema = z.object({
  fromUserId: z.string(),
  toUserId: z.string(),
  guildId: z.string(),
  amount: z.number().positive(),
  fromUsername: z.string(),
  toUsername: z.string(),
});

const DepositSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  username: z.string(),
  amount: z.number().positive(),
});

const WithdrawSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  username: z.string(),
  amount: z.number().positive(),
});

// --- User Economy ---

// GET /api/v1/economy/user/:guildId/:userId
router.get("/user/:guildId/:userId", async (c) => {
  const { guildId, userId } = c.req.param();

  try {
    const user = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });

    if (!user) {
      return c.json({ error: "User economy not found" }, 404);
    }

    return c.json(user);
  } catch (error) {
    logger.error(`Error fetching user economy for ${userId} in ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/economy/user
router.post("/user", zValidator("json", UserEconomySchema), async (c) => {
  const data = c.req.valid("json");

  try {
    const user = await prisma.userEconomy.create({
      data,
    });

    return c.json(user, 201);
  } catch (error) {
    logger.error(`Error creating user economy`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/economy/user/:guildId/:userId
router.patch("/user/:guildId/:userId", zValidator("json", UserEconomySchema.partial()), async (c) => {
  const { guildId, userId } = c.req.param();
  const data = c.req.valid("json");

  try {
    const user = await prisma.userEconomy.update({
      where: { userId_guildId: { userId, guildId } },
      data,
    });

    return c.json(user);
  } catch (error) {
    logger.error(`Error updating user economy for ${userId} in ${guildId}`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// --- Global Bank ---

// GET /api/v1/economy/bank/:userId
router.get("/bank/:userId", async (c) => {
  const { userId } = c.req.param();

  try {
    const bank = await prisma.globalBank.findUnique({
      where: { userId },
    });

    if (!bank) {
      return c.json({ error: "Global bank not found" }, 404);
    }

    return c.json(bank);
  } catch (error) {
    logger.error(`Error fetching global bank for ${userId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/economy/bank
router.post("/bank", zValidator("json", GlobalBankSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    const bank = await prisma.globalBank.create({
      data,
    });

    return c.json(bank, 201);
  } catch (error) {
    logger.error(`Error creating global bank`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/economy/bank/:userId
router.patch("/bank/:userId", zValidator("json", GlobalBankSchema.partial()), async (c) => {
  const { userId } = c.req.param();
  const data = c.req.valid("json");

  try {
    const bank = await prisma.globalBank.update({
      where: { userId },
      data,
    });

    return c.json(bank);
  } catch (error) {
    logger.error(`Error updating global bank for ${userId}`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// --- Economy Config ---

// GET /api/v1/economy/config/:guildId
router.get("/config/:guildId", async (c) => {
  const { guildId } = c.req.param();

  try {
    const config = await prisma.economyConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return c.json({ error: "Economy config not found" }, 404);
    }

    return c.json(config);
  } catch (error) {
    logger.error(`Error fetching economy config for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/economy/config
router.post("/config", zValidator("json", EconomyConfigSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    const config = await prisma.economyConfig.create({
      data,
    });

    return c.json(config, 201);
  } catch (error) {
    logger.error(`Error creating economy config`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/economy/config/:guildId
router.patch("/config/:guildId", zValidator("json", EconomyConfigSchema.partial()), async (c) => {
  const { guildId } = c.req.param();
  const data = c.req.valid("json");

  try {
    const config = await prisma.economyConfig.update({
      where: { guildId },
      data,
    });

    return c.json(config);
  } catch (error) {
    logger.error(`Error updating economy config for ${guildId}`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// --- Leaderboard ---

// GET /api/v1/economy/leaderboard/:guildId
router.get("/leaderboard/:guildId", async (c) => {
  const { guildId } = c.req.param();
  const limit = Number(c.req.query("limit")) || 10;

  try {
    const leaderboard = await prisma.leaderboard.findMany({
      where: { guildId },
      orderBy: [
        { totalMoney: "desc" },
        { joinedServerAt: "asc" }
      ],
      take: limit,
    });

    return c.json(leaderboard);
  } catch (error) {
    logger.error(`Error fetching leaderboard for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/v1/economy/leaderboard/:guildId/user/:userId
router.get("/leaderboard/:guildId/user/:userId", async (c) => {
  const { guildId, userId } = c.req.param();

  try {
    const entry = await prisma.leaderboard.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });

    if (!entry) return c.json({ error: "Not found" }, 404);
    return c.json(entry);
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// POST /api/v1/economy/leaderboard/upsert
router.post("/leaderboard/upsert", async (c) => {
  const data = await c.req.json();
  const { userId, guildId, ...rest } = data;

  try {
    const entry = await prisma.leaderboard.upsert({
      where: { userId_guildId: { userId, guildId } },
      update: rest,
      create: { 
        userId, 
        guildId, 
        ...rest,
        joinedServerAt: rest.joinedServerAt || new Date(),
      },
    });
    return c.json(entry);
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// GET /api/v1/economy/leaderboard/:guildId/position/:userId
router.get("/leaderboard/:guildId/position/:userId", async (c) => {
  const { guildId, userId } = c.req.param();

  try {
    const userEntry = await prisma.leaderboard.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });

    if (!userEntry) return c.json({ position: null });

    const usersAhead = await prisma.leaderboard.count({
      where: {
        guildId,
        OR: [
          { totalMoney: { gt: userEntry.totalMoney } },
          {
            totalMoney: userEntry.totalMoney,
            joinedServerAt: { lt: userEntry.joinedServerAt },
          },
        ],
      },
    });

    return c.json({ position: usersAhead + 1 });
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// DELETE /api/v1/economy/leaderboard/:guildId/:userId
router.delete("/leaderboard/:guildId/:userId", async (c) => {
  const { guildId, userId } = c.req.param();
  try {
    await prisma.leaderboard.delete({
      where: { userId_guildId: { userId, guildId } },
    });
    return c.json({ message: "Deleted" });
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// --- Roulette ---

// POST /api/v1/economy/roulette/game
router.post("/roulette/game", async (c) => {
  const data = await c.req.json();
  try {
    const game = await prisma.rouletteGame.create({
      data,
      include: { bets: true },
    });
    return c.json(game, 201);
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// GET /api/v1/economy/roulette/game/:channelId/active
router.get("/roulette/game/:channelId/active", async (c) => {
  const { channelId } = c.req.param();
  try {
    const game = await prisma.rouletteGame.findFirst({
      where: { channelId, status: "waiting" },
      include: { bets: true },
    });
    if (!game) return c.json({ error: "No active game" }, 404);
    return c.json(game);
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// POST /api/v1/economy/roulette/game/:gameId/bet
router.post("/roulette/game/:gameId/bet", async (c) => {
  const gameId = Number(c.req.param("gameId"));
  const data = await c.req.json();
  try {
    const bet = await prisma.rouletteBet.create({
      data: { ...data, gameId },
    });
    return c.json(bet, 201);
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// PATCH /api/v1/economy/roulette/game/:gameId
router.patch("/roulette/game/:gameId", async (c) => {
  const gameId = Number(c.req.param("gameId"));
  const data = await c.req.json();
  try {
    const game = await prisma.rouletteGame.update({
      where: { id: gameId },
      data,
      include: { bets: true },
    });
    return c.json(game);
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// GET /api/v1/economy/roulette/game/:gameId
router.get("/roulette/game/:gameId", async (c) => {
  const gameId = Number(c.req.param("gameId"));
  try {
    const game = await prisma.rouletteGame.findUnique({
      where: { id: gameId },
      include: { bets: true },
    });
    if (!game) return c.json({ error: "Not found" }, 404);
    return c.json(game);
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// PATCH /api/v1/economy/roulette/bet/:betId
router.patch("/roulette/bet/:betId", async (c) => {
  const betId = Number(c.req.param("betId"));
  const data = await c.req.json();
  try {
    const bet = await prisma.rouletteBet.update({
      where: { id: betId },
      data,
    });
    return c.json(bet);
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// DELETE /api/v1/economy/roulette/game/:gameId
router.delete("/roulette/game/:gameId", async (c) => {
  const gameId = Number(c.req.param("gameId"));
  try {
    // Delete bets first
    await prisma.rouletteBet.deleteMany({ where: { gameId } });
    await prisma.rouletteGame.delete({ where: { id: gameId } });
    return c.json({ message: "Deleted" });
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// --- Atomic Operations (Race Condition Fix) ---

// POST /api/v1/economy/transfer - Atomic transfer between users
router.post("/transfer", zValidator("json", TransferSchema), async (c) => {
  const { fromUserId, toUserId, guildId, amount, fromUsername, toUsername } = c.req.valid("json");

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get both users in a single transaction
      const [fromUser, toUser] = await Promise.all([
        tx.userEconomy.findUnique({
          where: { userId_guildId: { userId: fromUserId, guildId } },
        }),
        tx.userEconomy.findUnique({
          where: { userId_guildId: { userId: toUserId, guildId } },
        }),
      ]);

      if (!fromUser || !toUser) {
        throw new Error("One or both users not found");
      }

      if (fromUser.pocket < amount) {
        throw new Error("Insufficient funds");
      }

      // Atomic update for both users
      const [updatedFrom, updatedTo] = await Promise.all([
        tx.userEconomy.update({
          where: { userId_guildId: { userId: fromUserId, guildId } },
          data: {
            pocket: fromUser.pocket - amount,
            totalLost: fromUser.totalLost + amount,
          },
        }),
        tx.userEconomy.update({
          where: { userId_guildId: { userId: toUserId, guildId } },
          data: {
            pocket: toUser.pocket + amount,
            totalEarned: toUser.totalEarned + amount,
          },
        }),
      ]);

      logger.info(
        `Atomic transfer: ${amount} from ${fromUserId} to ${toUserId} in guild ${guildId}`,
      );

      return { fromUser: updatedFrom, toUser: updatedTo };
    });

    return c.json({
      success: true,
      fromUser: result.fromUser,
      toUser: result.toUser,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfer failed";
    logger.error(`Atomic transfer failed: ${message}`, { fromUserId, toUserId, guildId, amount });
    return c.json({ error: message }, 400);
  }
});

// POST /api/v1/economy/deposit - Atomic deposit to global bank
router.post("/deposit", zValidator("json", DepositSchema), async (c) => {
  const { userId, guildId, username, amount } = c.req.valid("json");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.userEconomy.findUnique({
        where: { userId_guildId: { userId, guildId } },
      });

      if (!user || user.pocket < amount) {
        throw new Error("Insufficient funds in pocket");
      }

      // Get or create global bank
      let bank = await tx.globalBank.findUnique({
        where: { userId },
      });

      if (!bank) {
        bank = await tx.globalBank.create({
          data: { userId, username, bank: 0 },
        });
      }

      // Atomic update: subtract from pocket, add to bank
      const [updatedUser, updatedBank] = await Promise.all([
        tx.userEconomy.update({
          where: { userId_guildId: { userId, guildId } },
          data: { pocket: user.pocket - amount },
        }),
        tx.globalBank.update({
          where: { userId },
          data: { bank: bank.bank + amount },
        }),
      ]);

      logger.info(`Atomic deposit: ${amount} from user ${userId} to global bank`);

      return { user: updatedUser, bank: updatedBank };
    });

    return c.json({
      success: true,
      user: result.user,
      bank: result.bank,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deposit failed";
    logger.error(`Atomic deposit failed: ${message}`, { userId, guildId, amount });
    return c.json({ error: message }, 400);
  }
});

// POST /api/v1/economy/withdraw - Atomic withdraw from global bank
router.post("/withdraw", zValidator("json", WithdrawSchema), async (c) => {
  const { userId, guildId, username, amount } = c.req.valid("json");

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get global bank first
      const bank = await tx.globalBank.findUnique({
        where: { userId },
      });

      if (!bank || bank.bank < amount) {
        throw new Error("Insufficient funds in bank");
      }

      // Get or create user economy
      let user = await tx.userEconomy.findUnique({
        where: { userId_guildId: { userId, guildId } },
      });

      if (!user) {
        // Get starting money from config
        const config = await tx.economyConfig.findUnique({
          where: { guildId },
        });
        const startingMoney = config?.startingMoney || 1000;

        user = await tx.userEconomy.create({
          data: {
            userId,
            guildId,
            username,
            pocket: startingMoney,
            totalEarned: 0,
            totalLost: 0,
            inJail: false,
          },
        });
      }

      // Atomic update: subtract from bank, add to pocket
      const [updatedBank, updatedUser] = await Promise.all([
        tx.globalBank.update({
          where: { userId },
          data: { bank: bank.bank - amount },
        }),
        tx.userEconomy.update({
          where: { userId_guildId: { userId, guildId } },
          data: { pocket: user.pocket + amount },
        }),
      ]);

      logger.info(`Atomic withdraw: ${amount} from global bank to user ${userId}`);

      return { bank: updatedBank, user: updatedUser };
    });

    return c.json({
      success: true,
      bank: result.bank,
      user: result.user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Withdraw failed";
    logger.error(`Atomic withdraw failed: ${message}`, { userId, guildId, amount });
    return c.json({ error: message }, 400);
  }
});

export default router;
