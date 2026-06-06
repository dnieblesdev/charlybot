// Economy Repository — Direct Prisma access with distributed locks
// Follows SDD design: Phase 7 (Economy domain — most complex)
// All function signatures remain identical; only implementation changes.

import {
  prisma,
  BOT_LOCK_TTL,
  ValidationError,
  NotFoundError,
  InsufficientFundsError,
  CooldownError,
  LockContentionError,
  assertMoneyAmount,
  assertNonNegativeMoneyAmount,
  toMoneyAmount,
  toNonNegativeMoneyAmount,
} from "@charlybot/shared";
import { randomUUID } from "crypto";
import {
  withDistributedLock,
  economyUserLockKey,
  transferLockKey,
  rouletteGameLockKey,
  cooldownLockKey,
} from "@charlybot/shared";
import { getValkeyClient } from "../../infrastructure/valkey";
import logger from "../../utils/logger";
import type {
  IUserEconomy,
  IGlobalBank,
  IEconomyConfig,
  Leaderboard,
  RouletteGame,
  RouletteBet,
} from "@charlybot/shared";

interface GuildWriteClient {
  guild: {
    upsert(args: {
      where: { guildId: string };
      update: Record<string, never>;
      create: { guildId: string };
    } | object): Promise<unknown>;
  };
}

async function ensureGuildExists(client: GuildWriteClient, guildId: string): Promise<void> {
  await client.guild.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });
}

function normalizePositiveMoneyAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("amount", "must be positive finite number");
  }

  const normalizedAmount = toMoneyAmount(amount);
  if (normalizedAmount <= 0) {
    throw new ValidationError("amount", "must round to a positive whole amount");
  }

  return normalizedAmount;
}

function normalizeOptionalMoneyAmount(amount: number | undefined): number | undefined {
  return amount === undefined ? undefined : toMoneyAmount(amount);
}

function normalizeOptionalIntegerMoneyAmount(
  field: string,
  amount: number | undefined,
): number | undefined {
  if (amount === undefined) {
    return undefined;
  }

  try {
    return assertMoneyAmount(amount);
  } catch {
    throw new ValidationError(field, "must be a finite whole amount");
  }
}

function normalizeOptionalPositiveIntegerMoneyAmount(
  field: string,
  amount: number | undefined,
): number | undefined {
  const normalizedAmount = normalizeOptionalIntegerMoneyAmount(field, amount);

  if (normalizedAmount === undefined) {
    return undefined;
  }

  if (normalizedAmount <= 0) {
    throw new ValidationError(field, "must be a positive whole amount");
  }

  return normalizedAmount;
}

function normalizeOptionalNullableNonNegativeIntegerMoneyAmount(
  field: string,
  amount: number | null | undefined,
): number | null | undefined {
  if (amount === undefined || amount === null) {
    return amount;
  }

  try {
    return assertNonNegativeMoneyAmount(amount);
  } catch {
    throw new ValidationError(field, "must be a non-negative finite whole amount");
  }
}

function normalizeOptionalNonNegativeMoneyAmount(
  field: string,
  amount: number | undefined,
): number | undefined {
  if (amount === undefined) {
    return undefined;
  }

  try {
    return toNonNegativeMoneyAmount(amount);
  } catch {
    throw new ValidationError(field, "must be a non-negative finite whole amount");
  }
}

function normalizeOptionalPositiveMoneyAmount(amount: number | undefined): number | undefined {
  return amount === undefined ? undefined : normalizePositiveMoneyAmount(amount);
}

function normalizeEconomyUserData<T extends Partial<IUserEconomy>>(data: T): T {
  return {
    ...data,
    pocket: normalizeOptionalNonNegativeMoneyAmount("pocket", data.pocket),
    totalEarned: normalizeOptionalNonNegativeMoneyAmount("totalEarned", data.totalEarned),
    totalLost: normalizeOptionalNonNegativeMoneyAmount("totalLost", data.totalLost),
  } as T;
}

function normalizeGlobalBankData<T extends Partial<IGlobalBank>>(data: T): T {
  return {
    ...data,
    bank: normalizeOptionalNonNegativeMoneyAmount("bank", data.bank),
  } as T;
}

function normalizeLeaderboardData<T extends Partial<Leaderboard>>(data: T): T {
  return {
    ...data,
    totalMoney: normalizeOptionalIntegerMoneyAmount("totalMoney", data.totalMoney),
  } as T;
}

// Result types for atomic operations
export interface TransferResult {
  success: boolean;
  fromUser: IUserEconomy;
  toUser: IUserEconomy;
}

export interface DepositResult {
  success: boolean;
  user: IUserEconomy;
  bank: IGlobalBank;
}

export interface WithdrawResult {
  success: boolean;
  bank: IGlobalBank;
  user: IUserEconomy;
}

// =============================================================================
// User Economy CRUD
// =============================================================================

export async function getEconomyUser(
  guildId: string,
  userId: string,
): Promise<IUserEconomy | null> {
  return await prisma.userEconomy.findUnique({
    where: { userId_guildId: { userId, guildId } },
  });
}

export async function createEconomyUser(
  guildId: string,
  data: IUserEconomy,
): Promise<IUserEconomy> {
  await ensureGuildExists(prisma, guildId);

  return await prisma.userEconomy.create({
    data: { ...normalizeEconomyUserData(data), guildId },
  });
}

export async function updateEconomyUser(
  guildId: string,
  userId: string,
  data: Partial<IUserEconomy>,
): Promise<IUserEconomy> {
  return await prisma.userEconomy.update({
    where: { userId_guildId: { userId, guildId } },
    data: normalizeEconomyUserData(data),
  });
}

// =============================================================================
// Global Bank CRUD
// =============================================================================

export async function getGlobalBank(
  guildId: string,
  userId: string,
): Promise<IGlobalBank | null> {
  // Note: API routes use /bank/:userId (no guildId in path)
  return await prisma.globalBank.findUnique({
    where: { userId },
  });
}

export async function createGlobalBank(
  guildId: string,
  data: IGlobalBank,
): Promise<IGlobalBank> {
  return await prisma.globalBank.create({
    data: normalizeGlobalBankData(data),
  });
}

export async function updateGlobalBank(
  guildId: string,
  userId: string,
  data: Partial<IGlobalBank>,
): Promise<IGlobalBank> {
  return await prisma.globalBank.update({
    where: { userId },
    data: normalizeGlobalBankData(data),
  });
}

// =============================================================================
// Economy Config CRUD
// =============================================================================

export async function getEconomyConfig(
  guildId: string,
): Promise<IEconomyConfig | null> {
  return await prisma.economyConfig.findUnique({
    where: { guildId },
  });
}

export async function createEconomyConfig(
  guildId: string,
  data: IEconomyConfig,
): Promise<IEconomyConfig> {
  await ensureGuildExists(prisma, guildId);

  return await prisma.economyConfig.create({
    data: { ...data, guildId },
  });
}

export async function updateEconomyConfig(
  guildId: string,
  data: Partial<IEconomyConfig>,
): Promise<IEconomyConfig> {
  return await prisma.economyConfig.update({
    where: { guildId },
    data,
  });
}

// =============================================================================
// Leaderboard CRUD
// =============================================================================

export async function getLeaderboard(
  guildId: string,
  limit: number = 10,
): Promise<Leaderboard[]> {
  const data = await prisma.leaderboard.findMany({
    where: { guildId },
    orderBy: [{ totalMoney: "desc" }, { joinedServerAt: "asc" }],
    take: limit,
  });
  return data;
}

export async function getLeaderboardEntry(
  guildId: string,
  userId: string,
): Promise<Leaderboard | null> {
  return await prisma.leaderboard.findUnique({
    where: { userId_guildId: { userId, guildId } },
  });
}

export async function upsertLeaderboard(
  guildId: string,
  data: Partial<Leaderboard>,
): Promise<Leaderboard> {
  await ensureGuildExists(prisma, guildId);

  const normalizedData = normalizeLeaderboardData(data);
  const { userId, guildId: _gid, ...rest } = normalizedData as Leaderboard & { userId: string };

  return await prisma.leaderboard.upsert({
    where: { userId_guildId: { userId, guildId } },
    update: rest,
    create: {
      userId,
      guildId,
      ...rest,
      joinedServerAt: (rest as Partial<Leaderboard> & { joinedServerAt?: Date }).joinedServerAt || new Date(),
    },
  });
}

export async function getUserPosition(
  guildId: string,
  userId: string,
): Promise<number | null> {
  const userEntry = await prisma.leaderboard.findUnique({
    where: { userId_guildId: { userId, guildId } },
  });

  if (!userEntry) return null;

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

  return usersAhead + 1;
}

export async function removeFromLeaderboard(
  guildId: string,
  userId: string,
): Promise<void> {
  await prisma.leaderboard.delete({
    where: { userId_guildId: { userId, guildId } },
  });
}

// =============================================================================
// Roulette CRUD
// =============================================================================

export async function createRouletteGame(
  guildId: string,
  data: Partial<RouletteGame>,
): Promise<RouletteGame> {
  await ensureGuildExists(prisma, guildId);

  return await prisma.rouletteGame.create({
    data: { ...data, guildId } as any,
  });
}

export async function getActiveRouletteGame(
  guildId: string,
  channelId: string,
): Promise<RouletteGame | null> {
  return await prisma.rouletteGame.findFirst({
    where: { channelId, status: "waiting" },
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
  }) as unknown as RouletteGame | null;
}

export async function getRouletteGame(
  guildId: string,
  gameId: number,
): Promise<RouletteGame> {
  return await prisma.rouletteGame.findUnique({
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
  }) as unknown as RouletteGame;
}

export async function updateRouletteGame(
  guildId: string,
  gameId: number,
  data: Partial<RouletteGame>,
): Promise<RouletteGame> {
  return await prisma.rouletteGame.update({
    where: { id: gameId },
    data: data as any,
  }) as unknown as RouletteGame;
}

export async function deleteRouletteGame(
  guildId: string,
  gameId: number,
): Promise<void> {
  // Delete bets first (foreign key)
  await prisma.rouletteBet.deleteMany({ where: { gameId } });
  await prisma.rouletteGame.delete({ where: { id: gameId } });
}

export async function placeRouletteBet(
  guildId: string,
  gameId: number,
  data: Partial<RouletteBet>,
): Promise<RouletteBet> {
  await ensureGuildExists(prisma, guildId);

  return await prisma.rouletteBet.create({
    data: {
      ...data,
      amount: normalizeOptionalPositiveMoneyAmount(data.amount),
      winAmount: normalizeOptionalNonNegativeMoneyAmount("winAmount", data.winAmount ?? undefined),
      gameId,
      guildId,
    } as any,
  }) as unknown as RouletteBet;
}

export async function updateRouletteBet(
  guildId: string,
  betId: number,
  data: Partial<RouletteBet>,
): Promise<RouletteBet> {
  return await prisma.rouletteBet.update({
    where: { id: betId },
    data: {
      ...data,
      amount: normalizeOptionalPositiveIntegerMoneyAmount("amount", data.amount),
      winAmount: normalizeOptionalNullableNonNegativeIntegerMoneyAmount("winAmount", data.winAmount),
    } as any,
  }) as unknown as RouletteBet;
}

// =============================================================================
// Atomic Operations — distributed locks + Prisma transactions
// =============================================================================

export async function atomicTransfer(
  fromUserId: string,
  toUserId: string,
  guildId: string,
  amount: number,
  fromUsername: string,
  toUsername: string,
): Promise<TransferResult> {
  const normalizedAmount = normalizePositiveMoneyAmount(amount);
  const valkey = getValkeyClient();
  const lockKey = transferLockKey(guildId, fromUserId, toUserId);

  const result = await withDistributedLock(
    valkey,
    'economy',
    lockKey,
    async () => {
      return await prisma.$transaction(async (tx) => {
        // Get both users
        const [fromUser, toUser] = await Promise.all([
          tx.userEconomy.findUnique({
            where: { userId_guildId: { userId: fromUserId, guildId } },
          }),
          tx.userEconomy.findUnique({
            where: { userId_guildId: { userId: toUserId, guildId } },
          }),
        ]);

        if (!fromUser || !toUser) {
          throw new NotFoundError("UserEconomy", `${fromUserId} or ${toUserId}`);
        }

        if (fromUser.pocket < normalizedAmount) {
          throw new InsufficientFundsError(fromUserId, normalizedAmount, fromUser.pocket);
        }

        // Atomic update for both users
        const [updatedFrom, updatedTo] = await Promise.all([
          tx.userEconomy.update({
            where: { userId_guildId: { userId: fromUserId, guildId } },
            data: {
              pocket: fromUser.pocket - normalizedAmount,
              totalLost: fromUser.totalLost + normalizedAmount,
            },
          }),
          tx.userEconomy.update({
            where: { userId_guildId: { userId: toUserId, guildId } },
            data: {
              pocket: toUser.pocket + normalizedAmount,
              totalEarned: toUser.totalEarned + normalizedAmount,
            },
          }),
        ]);

        logger.info(
          `Atomic transfer: ${normalizedAmount} from ${fromUserId} to ${toUserId} in guild ${guildId}`,
        );

        return { fromUser: updatedFrom, toUser: updatedTo };
      });
    },
    BOT_LOCK_TTL.TRANSFER,
  );

  return {
    success: true,
    fromUser: result.fromUser,
    toUser: result.toUser,
  };
}

export async function atomicDeposit(
  userId: string,
  guildId: string,
  username: string,
  amount: number,
): Promise<DepositResult> {
  const normalizedAmount = normalizePositiveMoneyAmount(amount);
  const valkey = getValkeyClient();
  // Global bank is keyed ONLY by userId, so we need a global lock.
  // We also lock the per-guild user row to avoid races with other pocket operations.
  const bankLockKey = `economy:bank:${userId}`;
  const userLockKey = economyUserLockKey(guildId, userId);

  const result = await withDistributedLock(
    valkey,
    'economy',
    bankLockKey,
    async () => {
      return await withDistributedLock(
        valkey,
        'economy',
        userLockKey,
        async () => {
          return await prisma.$transaction(async (tx) => {
            const user = await tx.userEconomy.findUnique({
              where: { userId_guildId: { userId, guildId } },
            });

            if (!user || user.pocket < normalizedAmount) {
              throw new InsufficientFundsError(userId, normalizedAmount, user?.pocket ?? 0);
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

            // Atomic update
            const [updatedUser, updatedBank] = await Promise.all([
              tx.userEconomy.update({
                where: { userId_guildId: { userId, guildId } },
                data: { pocket: user.pocket - normalizedAmount },
              }),
              tx.globalBank.update({
                where: { userId },
                data: { bank: bank.bank + normalizedAmount },
              }),
            ]);

            logger.info(`Atomic deposit: ${normalizedAmount} from user ${userId} to global bank`);

            return { user: updatedUser, bank: updatedBank };
          });
        },
        BOT_LOCK_TTL.TRANSFER,
      );
    },
    BOT_LOCK_TTL.TRANSFER,
  );

  return {
    success: true,
    user: result.user,
    bank: result.bank,
  };
}

export async function atomicWithdraw(
  userId: string,
  guildId: string,
  username: string,
  amount: number,
): Promise<WithdrawResult> {
  const normalizedAmount = normalizePositiveMoneyAmount(amount);
  const valkey = getValkeyClient();
  // Global bank is keyed ONLY by userId, so we need a global lock.
  // We also lock the per-guild user row to avoid races with other pocket operations.
  const bankLockKey = `economy:bank:${userId}`;
  const userLockKey = economyUserLockKey(guildId, userId);

  const result = await withDistributedLock(
    valkey,
    'economy',
    bankLockKey,
    async () => {
      return await withDistributedLock(
        valkey,
        'economy',
        userLockKey,
        async () => {
          return await prisma.$transaction(async (tx) => {
            // Get global bank first
            const bank = await tx.globalBank.findUnique({
              where: { userId },
            });

            if (!bank || bank.bank < normalizedAmount) {
              throw new InsufficientFundsError(userId, normalizedAmount, bank?.bank ?? 0);
            }

            // Get or create user economy
            let user = await tx.userEconomy.findUnique({
              where: { userId_guildId: { userId, guildId } },
            });

            if (!user) {
              await ensureGuildExists(tx as unknown as GuildWriteClient, guildId);

              user = await tx.userEconomy.create({
                data: {
                  userId,
                  guildId,
                  username,
                  pocket: 0,
                  totalEarned: 0,
                  totalLost: 0,
                  inJail: false,
                },
              });
            }

            // Atomic update
            const [updatedBank, updatedUser] = await Promise.all([
              tx.globalBank.update({
                where: { userId },
                data: { bank: bank.bank - normalizedAmount },
              }),
              tx.userEconomy.update({
                where: { userId_guildId: { userId, guildId } },
                data: { pocket: user.pocket + normalizedAmount },
              }),
            ]);

            logger.info(`Atomic withdraw: ${normalizedAmount} from global bank to user ${userId}`);

            return { bank: updatedBank, user: updatedUser };
          });
        },
        BOT_LOCK_TTL.TRANSFER,
      );
    },
    BOT_LOCK_TTL.TRANSFER,
  );

  return {
    success: true,
    bank: result.bank,
    user: result.user,
  };
}

export async function atomicAddPocket(
  userId: string,
  guildId: string,
  amount: number,
  cooldownType?: "work" | "crime" | "rob",
): Promise<IUserEconomy> {
  const normalizedAmount = normalizePositiveMoneyAmount(amount);
  const valkey = getValkeyClient();
  const lockKey = economyUserLockKey(guildId, userId);

  const result = await withDistributedLock(
    valkey,
    'economy',
    lockKey,
    async () => {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.userEconomy.findUnique({
          where: { userId_guildId: { userId, guildId } },
        });

        if (!user) throw new NotFoundError("UserEconomy", userId);

        // If cooldownType is provided, atomically check and claim the cooldown
        if (cooldownType) {
          const config = await tx.economyConfig.findUnique({ where: { guildId } });
          const cooldownMs =
            cooldownType === "work"
              ? config?.workCooldown ?? 300000
              : cooldownType === "crime"
                ? config?.crimeCooldown ?? 900000
                : config?.robCooldown ?? 1800000;

          const lastUsed =
            cooldownType === "work"
              ? user.lastWork
              : cooldownType === "crime"
                ? user.lastCrime
                : user.lastRob;

          if (lastUsed) {
            const elapsed = Date.now() - new Date(lastUsed).getTime();
            if (elapsed < cooldownMs) {
              const remaining = cooldownMs - elapsed;
              throw new CooldownError(userId, cooldownType, remaining);
            }
          }
        }

        // Build update data
        const updateData: any = {
          pocket: user.pocket + normalizedAmount,
          totalEarned: user.totalEarned + normalizedAmount,
        };

        // Claim cooldown if requested
        if (cooldownType === "work") updateData.lastWork = new Date();
        else if (cooldownType === "crime") updateData.lastCrime = new Date();
        else if (cooldownType === "rob") updateData.lastRob = new Date();

        const updated = await tx.userEconomy.update({
          where: { userId_guildId: { userId, guildId } },
          data: updateData,
        });

        return updated;
      });
    },
    BOT_LOCK_TTL.TRANSFER,
  );

  return result;
}

export async function atomicSubtractPocket(
  userId: string,
  guildId: string,
  amount: number,
  cooldownType?: "work" | "crime" | "rob",
): Promise<IUserEconomy> {
  const normalizedAmount = normalizePositiveMoneyAmount(amount);
  const valkey = getValkeyClient();
  const lockKey = economyUserLockKey(guildId, userId);

  const result = await withDistributedLock(
    valkey,
    'economy',
    lockKey,
    async () => {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.userEconomy.findUnique({
          where: { userId_guildId: { userId, guildId } },
        });

        if (!user) throw new NotFoundError("UserEconomy", userId);

        // Check insufficient funds
        if (user.pocket < normalizedAmount) {
          throw new InsufficientFundsError(userId, normalizedAmount, user.pocket);
        }

        // If cooldownType is provided, atomically check and claim the cooldown
        if (cooldownType) {
          const config = await tx.economyConfig.findUnique({ where: { guildId } });
          const cooldownMs =
            cooldownType === "work"
              ? config?.workCooldown ?? 300000
              : cooldownType === "crime"
                ? config?.crimeCooldown ?? 900000
                : config?.robCooldown ?? 1800000;

          const lastUsed =
            cooldownType === "work"
              ? user.lastWork
              : cooldownType === "crime"
                ? user.lastCrime
                : user.lastRob;

          if (lastUsed) {
            const elapsed = Date.now() - new Date(lastUsed).getTime();
            if (elapsed < cooldownMs) {
              const remaining = cooldownMs - elapsed;
              throw new CooldownError(userId, cooldownType, remaining);
            }
          }
        }

        const updateData: any = {
          pocket: user.pocket - normalizedAmount,
          totalLost: user.totalLost + normalizedAmount,
        };

        if (cooldownType === "work") updateData.lastWork = new Date();
        else if (cooldownType === "crime") updateData.lastCrime = new Date();
        else if (cooldownType === "rob") updateData.lastRob = new Date();

        const updated = await tx.userEconomy.update({
          where: { userId_guildId: { userId, guildId } },
          data: updateData,
        });

        return updated;
      });
    },
    BOT_LOCK_TTL.TRANSFER,
  );

  return result;
}

export async function atomicClaimCooldown(
  userId: string,
  guildId: string,
  type: "work" | "crime" | "rob",
  cooldownMs: number,
): Promise<{ success: boolean; user: IUserEconomy }> {
  const valkey = getValkeyClient();
  const lockKey = economyUserLockKey(guildId, userId);

  const result = await withDistributedLock(
    valkey,
    'economy',
    lockKey,
    async () => {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.userEconomy.findUnique({
          where: { userId_guildId: { userId, guildId } },
        });

        if (!user) throw new NotFoundError("UserEconomy", userId);

        const lastUsed =
          type === "work" ? user.lastWork : type === "crime" ? user.lastCrime : user.lastRob;

        if (lastUsed) {
          const elapsed = Date.now() - new Date(lastUsed).getTime();
          if (elapsed < cooldownMs) {
            const remaining = cooldownMs - elapsed;
            throw new CooldownError(userId, type, remaining);
          }
        }

        const updateData: any = {};
        if (type === "work") updateData.lastWork = new Date();
        else if (type === "crime") updateData.lastCrime = new Date();
        else if (type === "rob") updateData.lastRob = new Date();

        const updated = await tx.userEconomy.update({
          where: { userId_guildId: { userId, guildId } },
          data: updateData,
        });

        return updated;
      });
    },
    BOT_LOCK_TTL.TRANSFER,
  );

  return { success: true, user: result };
}

// =============================================================================
// Atomic Roulette Operations
// =============================================================================

export async function atomicPlaceBet(
  userId: string,
  guildId: string,
  gameId: number,
  amount: number,
  betType: "color" | "number",
  betValue: string,
): Promise<RouletteBet> {
  const normalizedAmount = normalizePositiveMoneyAmount(amount);
  const valkey = getValkeyClient();
  const lockKey = economyUserLockKey(guildId, userId);

  const result = await withDistributedLock(
    valkey,
    'economy',
    lockKey,
    async () => {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.userEconomy.findUnique({
          where: { userId_guildId: { userId, guildId } },
        });

        if (!user) throw new NotFoundError("UserEconomy", userId);
        if (user.pocket < normalizedAmount) {
          throw new InsufficientFundsError(userId, normalizedAmount, user.pocket);
        }

        // Deduct money
        await tx.userEconomy.update({
          where: { userId_guildId: { userId, guildId } },
          data: {
            pocket: user.pocket - normalizedAmount,
            totalLost: user.totalLost + normalizedAmount,
          },
        });

        // Create bet
        const bet = await tx.rouletteBet.create({
          data: { gameId, userId, guildId, amount: normalizedAmount, betType, betValue },
        });

        return bet;
      });
    },
    BOT_LOCK_TTL.TRANSFER,
  );

  return result as unknown as RouletteBet;
}

export async function atomicProcessRouletteResults(
  gameId: number,
  guildId: string,
  winningNumber: number,
  winningColor: string,
): Promise<{ gameId: number; results: Array<{ betId: number; userId: string; won: boolean; winAmount: number }> }> {
  const valkey = getValkeyClient();
  const gameLockKey = rouletteGameLockKey(guildId, gameId);

  // First, get all bets to know which users need locks
  const gameWithBets = await prisma.rouletteGame.findUnique({
    where: { id: gameId },
    include: { bets: true },
  });

  if (!gameWithBets) throw new NotFoundError("RouletteGame", String(gameId));

  // Collect unique userIds, sort to avoid deadlocks
  const userIds = [...new Set(gameWithBets.bets.map((b) => b.userId))].sort();

  // Acquire per-user locks IN ORDER before processing (skip if no bets)
  const userLockKeys = userIds.map((uid) => economyUserLockKey(guildId, uid));

  const lockOwnerId = randomUUID();
  const acquiredUserLockKeys: string[] = [];
  try {
    // Acquire ALL user locks first, hold during transaction
    for (const lockKey of userLockKeys) {
      const acquired = await valkey.acquireLock(lockKey, BOT_LOCK_TTL.TRANSFER, lockOwnerId);
      if (!acquired) {
        // Release any locks we already acquired
        for (const acquiredKey of acquiredUserLockKeys) {
          await valkey.releaseLock(acquiredKey, lockOwnerId);
        }
        throw new LockContentionError("roulette user lock");
      }
      acquiredUserLockKeys.push(lockKey);
    }

    const result = await withDistributedLock(
      valkey,
      'economy',
      gameLockKey,
      async () => {
        return await prisma.$transaction(async (tx) => {
          // Re-fetch game with bets inside transaction
          const game = await tx.rouletteGame.findUnique({
            where: { id: gameId },
            include: { bets: true },
          });

          if (!game) throw new NotFoundError("RouletteGame", String(gameId));
          if (game.status === "finished") {
            throw new ValidationError("game", "already processed");
          }
          if (game.status !== "spinning") {
            throw new ValidationError("game", `invalid status: ${game.status}`);
          }

          // Process each bet
          const results: any[] = [];
          for (const bet of game.bets) {
            const won =
              bet.betType === "color" ? bet.betValue === winningColor : bet.betValue === String(winningNumber);

            const winAmount = won
              ? toMoneyAmount(bet.betValue === "green" ? bet.amount * 14 : bet.amount * 2)
              : 0;

            await tx.rouletteBet.update({
              where: { id: bet.id },
              data: { result: won ? "win" : "lose", winAmount },
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
            data: { status: "finished", winningNumber, winningColor, endTime: new Date() },
          });

          return { gameId, results };
        });
      },
      BOT_LOCK_TTL.TRANSFER,
    );

    return result;
  } finally {
    // Release only the locks that were successfully acquired
    for (const lockKey of acquiredUserLockKeys) {
      await valkey.releaseLock(lockKey, lockOwnerId);
    }
  }
}

export async function atomicCancelRouletteGame(
  gameId: number,
  guildId: string,
): Promise<{ gameId: number; refundedBets: number }> {
  const valkey = getValkeyClient();
  const gameLockKey = rouletteGameLockKey(guildId, gameId);

  // First, get all bets to know which users need locks
  const gameWithBets = await prisma.rouletteGame.findUnique({
    where: { id: gameId },
    include: { bets: true },
  });

  if (!gameWithBets) throw new NotFoundError("RouletteGame", String(gameId));

  // Collect unique userIds, sort to avoid deadlocks
  const userIds = [...new Set(gameWithBets.bets.map((b) => b.userId))].sort();

  // Acquire per-user locks IN ORDER before processing (skip if no bets)
  const userLockKeys = userIds.map((uid) => economyUserLockKey(guildId, uid));

  const lockOwnerId = randomUUID();
  const acquiredUserLockKeys: string[] = [];
  try {
    // Acquire ALL user locks first, hold during transaction
    for (const lockKey of userLockKeys) {
      const acquired = await valkey.acquireLock(lockKey, BOT_LOCK_TTL.TRANSFER, lockOwnerId);
      if (!acquired) {
        // Release any locks we already acquired
        for (const acquiredKey of acquiredUserLockKeys) {
          await valkey.releaseLock(acquiredKey, lockOwnerId);
        }
        throw new LockContentionError("roulette user lock");
      }
      acquiredUserLockKeys.push(lockKey);
    }

    const result = await withDistributedLock(
      valkey,
      'economy',
      gameLockKey,
      async () => {
        return await prisma.$transaction(async (tx) => {
          const game = await tx.rouletteGame.findUnique({
            where: { id: gameId },
            include: { bets: true },
          });

          if (!game) throw new NotFoundError("RouletteGame", String(gameId));
          if (game.status !== "waiting") throw new ValidationError("game", "already processed");

          // Refund all bets
          for (const bet of game.bets) {
            await tx.rouletteBet.update({
              where: { id: bet.id },
              data: { result: "REFUNDED", winAmount: 0 },
            });

            // Get user to safely decrement totalLost
            const user = await tx.userEconomy.findUnique({
              where: { userId_guildId: { userId: bet.userId, guildId } },
            });

            await tx.userEconomy.update({
              where: { userId_guildId: { userId: bet.userId, guildId } },
              data: {
                pocket: { increment: bet.amount },
                totalLost: { decrement: Math.min(bet.amount, user?.totalLost ?? 0) },
              },
            });
          }

          // Cancel game
          await tx.rouletteGame.update({
            where: { id: gameId },
            data: { status: "finished", endTime: new Date() },
          });

          return { gameId, refundedBets: game.bets.length };
        });
      },
      BOT_LOCK_TTL.TRANSFER,
    );

    return result;
  } finally {
    // Release only the locks that were successfully acquired
    for (const lockKey of acquiredUserLockKeys) {
      await valkey.releaseLock(lockKey, lockOwnerId);
    }
  }
}
