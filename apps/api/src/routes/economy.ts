import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma, MAX_LEADERBOARD_LIMIT, BOT_LOCK_TTL } from "@charlybot/shared";
import {
  UserEconomySchema,
  GlobalBankSchema,
  EconomyConfigSchema,
  RouletteGameSchema,
  RouletteBetSchema,
  LeaderboardUpsertSchema,
  TransferSchema,
  DepositSchema,
  WithdrawSchema,
  AddPocketSchema,
  SubtractPocketSchema,
  CooldownClaimSchema,
  AtomicRouletteBetSchema,
  RouletteProcessResultsSchema,
  RouletteCancelGameSchema,
} from "@charlybot/shared";
import logger from "../utils/logger";
import { guildAccessMiddleware } from "../middleware/guildAccessMiddleware";
import { withDistributedLock, transferLockKey, economyUserLockKey, rouletteGameLockKey } from "../infrastructure/valkey";

const router = new Hono();

// Apply guild access middleware to all guild-scoped routes
router.use("/user/:guildId/*", guildAccessMiddleware);
router.use("/config/:guildId", guildAccessMiddleware);
router.use("/leaderboard/:guildId", guildAccessMiddleware);

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
    logger.error(`Error fetching user economy for ${userId} in ${guildId}`, { error: error instanceof Error ? error.message : String(error) });
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
    logger.error(`Error creating user economy`, { error: error instanceof Error ? error.message : String(error) });
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
    logger.error(`Error updating user economy for ${userId} in ${guildId}`, { error: error instanceof Error ? error.message : String(error) });
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
    logger.error(`Error fetching global bank for ${userId}`, { error: error instanceof Error ? error.message : String(error) });
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
    logger.error(`Error creating global bank`, { error: error instanceof Error ? error.message : String(error) });
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
    logger.error(`Error updating global bank for ${userId}`, { error: error instanceof Error ? error.message : String(error) });
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
    logger.error(`Error fetching economy config for ${guildId}`, { error: error instanceof Error ? error.message : String(error) });
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
    logger.error(`Error creating economy config`, { error: error instanceof Error ? error.message : String(error) });
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
    logger.error(`Error updating economy config for ${guildId}`, { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// --- Leaderboard ---

// GET /api/v1/economy/leaderboard/:guildId
router.get("/leaderboard/:guildId", async (c) => {
  const { guildId } = c.req.param();
  const page = Math.max(1, parseInt(c.req.query("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "20")));
  const skip = (page - 1) * limit;

  try {
    const [data, total] = await Promise.all([
      prisma.leaderboard.findMany({
        where: { guildId },
        orderBy: [{ totalMoney: "desc" }, { joinedServerAt: "asc" }],
        skip,
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
    logger.error(`Error fetching leaderboard for ${guildId}`, { error: error instanceof Error ? error.message : String(error) });
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
router.post("/leaderboard/upsert", zValidator("json", LeaderboardUpsertSchema), async (c) => {
  const { userId, guildId, ...rest } = c.req.valid("json");

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
    logger.error(`Error upserting leaderboard entry`, { error: error instanceof Error ? error.message : String(error), userId, guildId });
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

// Strict Zod schemas for roulette PATCH endpoints (prevent mass assignment)
const RouletteGamePatchSchema = z.object({
  status: z.enum(["waiting", "spinning", "finished"]).optional(),
  result: z.string().optional(),
  winningNumber: z.number().int().min(0).max(36).optional(),
});

const RouletteBetPatchSchema = z.object({
  result: z.enum(["win", "lose"]).optional(),
  winAmount: z.number().int().min(0).optional(),
});

// POST /api/v1/economy/roulette/game
router.post("/roulette/game", zValidator("json", RouletteGameSchema), async (c) => {
  const data = c.req.valid("json");
  try {
    const game = await prisma.rouletteGame.create({
      data,
      // Heavy include removed from hot path - only fetch when explicitly needed
    });
    return c.json(game, 201);
  } catch (error) {
    logger.error(`Error creating roulette game: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal error" }, 500);
  }
});

// GET /api/v1/economy/roulette/game/:channelId/active
router.get("/roulette/game/:channelId/active", async (c) => {
  const { channelId } = c.req.param();
  try {
    const game = await prisma.rouletteGame.findFirst({
      where: { channelId, status: "waiting" },
      // Use select instead of include to avoid heavy relation fetch
      select: {
        id: true,
        channelId: true,
        status: true,
        winningNumber: true,
        createdAt: true,
        updatedAt: true,
        bets: {
          select: {
            id: true,
            userId: true,
            guildId: true,
            amount: true,
            betType: true,
            betValue: true,
            result: true,
            winAmount: true,
          },
        },
      },
    });
    if (!game) return c.json({ error: "No active game" }, 404);
    return c.json(game);
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// POST /api/v1/economy/roulette/game/:gameId/bet
router.post("/roulette/game/:gameId/bet", zValidator("json", RouletteBetSchema), async (c) => {
  const gameId = Number(c.req.param("gameId"));
  const data = c.req.valid("json");
  try {
    const bet = await prisma.rouletteBet.create({
      data: { ...data, gameId },
    });
    return c.json(bet, 201);
  } catch (error) {
    logger.error(`Error placing roulette bet for game ${gameId}`, { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: "Internal error" }, 500);
  }
});

// PATCH /api/v1/economy/roulette/game/:gameId
router.patch("/roulette/game/:gameId", zValidator("json", RouletteGamePatchSchema), async (c) => {
  const gameId = Number(c.req.param("gameId"));
  const data = c.req.valid("json");
  try {
    const game = await prisma.rouletteGame.update({
      where: { id: gameId },
      data,
    });
    return c.json(game);
  } catch (error) {
    logger.error(`Error updating roulette game ${gameId}: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal error" }, 500);
  }
});

// GET /api/v1/economy/roulette/game/:gameId
router.get("/roulette/game/:gameId", async (c) => {
  const gameId = Number(c.req.param("gameId"));
  try {
    const game = await prisma.rouletteGame.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        channelId: true,
        status: true,
        winningNumber: true,
        createdAt: true,
        updatedAt: true,
        bets: {
          select: {
            id: true,
            userId: true,
            guildId: true,
            amount: true,
            betType: true,
            betValue: true,
            result: true,
            winAmount: true,
          },
          take: 100,
        },
      },
    });
    if (!game) return c.json({ error: "Not found" }, 404);
    return c.json(game);
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

// PATCH /api/v1/economy/roulette/bet/:betId
router.patch("/roulette/bet/:betId", zValidator("json", RouletteBetPatchSchema), async (c) => {
  const betId = Number(c.req.param("betId"));
  const data = c.req.valid("json");
  try {
    const bet = await prisma.rouletteBet.update({
      where: { id: betId },
      data,
    });
    return c.json(bet);
  } catch (error) {
    logger.error(`Error updating roulette bet ${betId}: ${error instanceof Error ? error.message : String(error)}`);
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

  // Use distributed lock to prevent double-spending
  const lockKey = transferLockKey(guildId, fromUserId, toUserId);

  try {
    const result = await withDistributedLock(
      'economy',
      lockKey,
      async () => {
        return await prisma.$transaction(async (tx) => {
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
      },
      BOT_LOCK_TTL.TRANSFER,
    );

    return c.json({
      success: true,
      fromUser: result.fromUser,
      toUser: result.toUser,
    });
  } catch (error) {
    // Check if it's a lock acquisition failure
    const errorMessage = error instanceof Error ? error.message : "Transfer failed";
    if (errorMessage.includes('Failed to acquire lock')) {
      logger.warn('Transfer rate limited due to concurrent operation', { fromUserId, toUserId, guildId });
      return c.json({ error: "Concurrent transfer in progress. Please try again." }, 429);
    }
    logger.error(`Atomic transfer failed: ${errorMessage}`, { fromUserId, toUserId, guildId, amount });
    return c.json({ error: errorMessage }, 400);
  }
});

// POST /api/v1/economy/deposit - Atomic deposit to global bank
router.post("/deposit", zValidator("json", DepositSchema), async (c) => {
  const { userId, guildId, username, amount } = c.req.valid("json");

  // Use distributed lock to prevent race conditions on user balance
  const lockKey = economyUserLockKey(guildId, userId);

  try {
    const result = await withDistributedLock(
      'economy',
      lockKey,
      async () => {
        return await prisma.$transaction(async (tx) => {
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
      },
      BOT_LOCK_TTL.TRANSFER,
    );

    return c.json({
      success: true,
      user: result.user,
      bank: result.bank,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Deposit failed";
    if (errorMessage.includes('Failed to acquire lock')) {
      logger.warn('Deposit rate limited due to concurrent operation', { userId, guildId });
      return c.json({ error: "Concurrent deposit in progress. Please try again." }, 429);
    }
    logger.error(`Atomic deposit failed: ${errorMessage}`, { userId, guildId, amount });
    return c.json({ error: errorMessage }, 400);
  }
});

// POST /api/v1/economy/withdraw - Atomic withdraw from global bank
router.post("/withdraw", zValidator("json", WithdrawSchema), async (c) => {
  const { userId, guildId, username, amount } = c.req.valid("json");

  // Use distributed lock to prevent race conditions on user balance
  const lockKey = economyUserLockKey(guildId, userId);

  try {
    const result = await withDistributedLock(
      'economy',
      lockKey,
      async () => {
        return await prisma.$transaction(async (tx) => {
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
      },
      BOT_LOCK_TTL.TRANSFER,
    );

    return c.json({
      success: true,
      bank: result.bank,
      user: result.user,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Withdraw failed";
    if (errorMessage.includes('Failed to acquire lock')) {
      logger.warn('Withdraw rate limited due to concurrent operation', { userId, guildId });
      return c.json({ error: "Concurrent withdraw in progress. Please try again." }, 429);
    }
    logger.error(`Atomic withdraw failed: ${errorMessage}`, { userId, guildId, amount });
    return c.json({ error: errorMessage }, 400);
  }
});

// POST /api/v1/economy/atomic-add-pocket - Atomically add to pocket with optional cooldown claim
router.post("/atomic-add-pocket", zValidator("json", AddPocketSchema), async (c) => {
  const { userId, guildId, amount, cooldownType } = c.req.valid("json");
  const lockKey = economyUserLockKey(guildId, userId);

  try {
    const result = await withDistributedLock('economy', lockKey, async () => {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.userEconomy.findUnique({
          where: { userId_guildId: { userId, guildId } },
        });

        if (!user) throw new Error("User not found");

        // If cooldownType is provided, atomically check and claim the cooldown
        if (cooldownType) {
          const config = await tx.economyConfig.findUnique({ where: { guildId } });
          const cooldownMs = cooldownType === 'work' ? (config?.workCooldown ?? 300000)
            : cooldownType === 'crime' ? (config?.crimeCooldown ?? 900000)
            : (config?.robCooldown ?? 1800000);

          const lastUsed = cooldownType === 'work' ? user.lastWork
            : cooldownType === 'crime' ? user.lastCrime
            : user.lastRob;

          if (lastUsed) {
            const elapsed = Date.now() - new Date(lastUsed).getTime();
            if (elapsed < cooldownMs) {
              const remaining = cooldownMs - elapsed;
              throw new Error(`ON_COOLDOWN:${remaining}`);
            }
          }
        }

        // Build update data
        const updateData: any = {
          pocket: user.pocket + amount,
          totalEarned: user.totalEarned + amount,
        };

        // Claim cooldown if requested
        if (cooldownType === 'work') updateData.lastWork = new Date();
        else if (cooldownType === 'crime') updateData.lastCrime = new Date();
        else if (cooldownType === 'rob') updateData.lastRob = new Date();

        const updated = await tx.userEconomy.update({
          where: { userId_guildId: { userId, guildId } },
          data: updateData,
        });

        return updated;
      });
    }, BOT_LOCK_TTL.TRANSFER);

    return c.json(result, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Add pocket failed";
    if (msg.startsWith('ON_COOLDOWN:')) {
      const remaining = parseInt(msg.split(':')[1] ?? '0');
      return c.json({ error: "On cooldown", remainingMs: remaining }, 429);
    }
    if (msg.includes('Failed to acquire lock')) {
      return c.json({ error: "Concurrent operation in progress" }, 429);
    }
    logger.error(`Atomic add-pocket failed: ${msg}`, { userId, guildId, amount });
    return c.json({ error: msg }, 400);
  }
});

// POST /api/v1/economy/atomic-subtract-pocket - Atomically subtract from pocket with optional cooldown claim
router.post("/atomic-subtract-pocket", zValidator("json", SubtractPocketSchema), async (c) => {
  const { userId, guildId, amount, cooldownType } = c.req.valid("json");
  const lockKey = economyUserLockKey(guildId, userId);

  try {
    const result = await withDistributedLock('economy', lockKey, async () => {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.userEconomy.findUnique({
          where: { userId_guildId: { userId, guildId } },
        });

        if (!user) throw new Error("User not found");

        // Check insufficient funds
        if (user.pocket < amount) {
          throw new Error("INSUFFICIENT_FUNDS");
        }

        // If cooldownType is provided, atomically check and claim the cooldown
        if (cooldownType) {
          const config = await tx.economyConfig.findUnique({ where: { guildId } });
          const cooldownMs = cooldownType === 'work' ? (config?.workCooldown ?? 300000)
            : cooldownType === 'crime' ? (config?.crimeCooldown ?? 900000)
            : (config?.robCooldown ?? 1800000);

          const lastUsed = cooldownType === 'work' ? user.lastWork
            : cooldownType === 'crime' ? user.lastCrime
            : user.lastRob;

          if (lastUsed) {
            const elapsed = Date.now() - new Date(lastUsed).getTime();
            if (elapsed < cooldownMs) {
              const remaining = cooldownMs - elapsed;
              throw new Error(`ON_COOLDOWN:${remaining}`);
            }
          }
        }

        const updateData: any = {
          pocket: user.pocket - amount,
          totalLost: user.totalLost + amount,
        };

        if (cooldownType === 'work') updateData.lastWork = new Date();
        else if (cooldownType === 'crime') updateData.lastCrime = new Date();
        else if (cooldownType === 'rob') updateData.lastRob = new Date();

        const updated = await tx.userEconomy.update({
          where: { userId_guildId: { userId, guildId } },
          data: updateData,
        });

        return updated;
      });
    }, BOT_LOCK_TTL.TRANSFER);

    return c.json(result, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Subtract pocket failed";
    if (msg.startsWith('ON_COOLDOWN:')) {
      const remaining = parseInt(msg.split(':')[1] ?? '0');
      return c.json({ error: "On cooldown", remainingMs: remaining }, 429);
    }
    if (msg === 'INSUFFICIENT_FUNDS') {
      return c.json({ error: "Insufficient funds" }, 400);
    }
    if (msg.includes('Failed to acquire lock')) {
      return c.json({ error: "Concurrent operation in progress" }, 429);
    }
    logger.error(`Atomic subtract-pocket failed: ${msg}`, { userId, guildId, amount });
    return c.json({ error: msg }, 400);
  }
});

// POST /api/v1/economy/cooldown/claim - Atomically check and claim a cooldown
router.post("/cooldown/claim", zValidator("json", CooldownClaimSchema), async (c) => {
  const { userId, guildId, type, cooldownMs } = c.req.valid("json");
  const lockKey = economyUserLockKey(guildId, userId);

  try {
    const result = await withDistributedLock('economy', lockKey, async () => {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.userEconomy.findUnique({
          where: { userId_guildId: { userId, guildId } },
        });

        if (!user) throw new Error("User not found");

        const lastUsed = type === 'work' ? user.lastWork
          : type === 'crime' ? user.lastCrime
          : user.lastRob;

        if (lastUsed) {
          const elapsed = Date.now() - new Date(lastUsed).getTime();
          if (elapsed < cooldownMs) {
            const remaining = cooldownMs - elapsed;
            throw new Error(`ON_COOLDOWN:${remaining}`);
          }
        }

        const updateData: any = {};
        if (type === 'work') updateData.lastWork = new Date();
        else if (type === 'crime') updateData.lastCrime = new Date();
        else if (type === 'rob') updateData.lastRob = new Date();

        const updated = await tx.userEconomy.update({
          where: { userId_guildId: { userId, guildId } },
          data: updateData,
        });

        return updated;
      });
    }, BOT_LOCK_TTL.TRANSFER);

    return c.json({ success: true, user: result }, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Cooldown claim failed";
    if (msg.startsWith('ON_COOLDOWN:')) {
      const remaining = parseInt(msg.split(':')[1] ?? '0');
      return c.json({ error: "On cooldown", remainingMs: remaining }, 429);
    }
    if (msg.includes('Failed to acquire lock')) {
      return c.json({ error: "Concurrent operation in progress" }, 429);
    }
    logger.error(`Atomic cooldown claim failed: ${msg}`, { userId, guildId, type });
    return c.json({ error: msg }, 400);
  }
});

// POST /api/v1/economy/roulette/atomic-place-bet - Atomically place bet with fund verification
router.post("/roulette/atomic-place-bet", zValidator("json", AtomicRouletteBetSchema), async (c) => {
  const { userId, guildId, gameId, amount, betType, betValue } = c.req.valid("json");
  const lockKey = economyUserLockKey(guildId, userId);

  try {
    const result = await withDistributedLock('economy', lockKey, async () => {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.userEconomy.findUnique({
          where: { userId_guildId: { userId, guildId } },
        });

        if (!user) throw new Error("User not found");
        if (user.pocket < amount) throw new Error("INSUFFICIENT_FUNDS");

        // Deduct money
        await tx.userEconomy.update({
          where: { userId_guildId: { userId, guildId } },
          data: {
            pocket: user.pocket - amount,
            totalLost: user.totalLost + amount,
          },
        });

        // Create bet
        const bet = await tx.rouletteBet.create({
          data: { gameId, userId, guildId, amount, betType, betValue },
        });

        return bet;
      });
    }, BOT_LOCK_TTL.TRANSFER);

    return c.json(result, 201);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Place bet failed";
    if (msg === 'INSUFFICIENT_FUNDS') {
      return c.json({ error: "Insufficient funds" }, 400);
    }
    if (msg.includes('Failed to acquire lock')) {
      return c.json({ error: "Concurrent operation in progress" }, 429);
    }
    logger.error(`Atomic place-bet failed: ${msg}`, { userId, guildId, gameId });
    return c.json({ error: msg }, 400);
  }
});

// POST /api/v1/economy/roulette/atomic-process - Atomically process all bets for a game
router.post("/roulette/atomic-process", zValidator("json", RouletteProcessResultsSchema), async (c) => {
  const { gameId, guildId, winningNumber, winningColor } = c.req.valid("json");
  const lockKey = rouletteGameLockKey(guildId, gameId);

  try {
    const result = await withDistributedLock('economy', lockKey, async () => {
      return await prisma.$transaction(async (tx) => {
        // Get game with all bets
        const game = await tx.rouletteGame.findUnique({
          where: { id: gameId },
          include: { bets: true },
        });

        if (!game) throw new Error("Game not found");
        if (game.status !== 'waiting') throw new Error("Game already processed");

        // Process each bet
        const results: any[] = [];
        for (const bet of game.bets) {
          const won = bet.betType === 'color'
            ? bet.betValue === winningColor
            : bet.betValue === String(winningNumber);

          const winAmount = won ? (bet.betValue === 'green' ? bet.amount * 14 : bet.amount * 2) : 0;

          await tx.rouletteBet.update({
            where: { id: bet.id },
            data: { result: won ? 'win' : 'lose', winAmount },
          });

          if (won) {
            await tx.userEconomy.update({
              where: { userId_guildId: { userId: bet.userId, guildId } },
              data: {
                pocket: { increment: winAmount },
                totalEarned: { increment: winAmount },
              },
            });
          }

          results.push({ betId: bet.id, userId: bet.userId, won, winAmount });
        }

        // Update game status
        await tx.rouletteGame.update({
          where: { id: gameId },
          data: { status: 'finished', winningNumber, winningColor, endTime: new Date() },
        });

        return { gameId, results };
      });
    }, BOT_LOCK_TTL.TRANSFER);

    return c.json(result, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Process results failed";
    if (msg.includes('Failed to acquire lock')) {
      return c.json({ error: "Concurrent operation in progress" }, 429);
    }
    logger.error(`Atomic roulette process failed: ${msg}`, { gameId, guildId });
    return c.json({ error: msg }, 400);
  }
});

// POST /api/v1/economy/roulette/atomic-cancel - Atomically refund all bets and cancel game
router.post("/roulette/atomic-cancel", zValidator("json", RouletteCancelGameSchema), async (c) => {
  const { gameId, guildId } = c.req.valid("json");
  const lockKey = rouletteGameLockKey(guildId, gameId);

  try {
    const result = await withDistributedLock('economy', lockKey, async () => {
      return await prisma.$transaction(async (tx) => {
        const game = await tx.rouletteGame.findUnique({
          where: { id: gameId },
          include: { bets: true },
        });

        if (!game) throw new Error("Game not found");
        if (game.status !== 'waiting') throw new Error("Game already processed");

        // Refund all bets
        for (const bet of game.bets) {
          await tx.rouletteBet.update({
            where: { id: bet.id },
            data: { result: 'REFUNDED', winAmount: 0 },
          });

          await tx.userEconomy.update({
            where: { userId_guildId: { userId: bet.userId, guildId } },
            data: {
              pocket: { increment: bet.amount },
              totalLost: { decrement: bet.amount },
            },
          });
        }

        // Cancel game
        await tx.rouletteGame.update({
          where: { id: gameId },
          data: { status: 'finished', endTime: new Date() },
        });

        return { gameId, refundedBets: game.bets.length };
      });
    }, BOT_LOCK_TTL.TRANSFER);

    return c.json(result, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Cancel game failed";
    if (msg.includes('Failed to acquire lock')) {
      return c.json({ error: "Concurrent operation in progress" }, 429);
    }
    logger.error(`Atomic roulette cancel failed: ${msg}`, { gameId, guildId });
    return c.json({ error: msg }, 400);
  }
});

export default router;
