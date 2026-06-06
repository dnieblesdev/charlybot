import { beforeEach, describe, expect, it, vi } from "vitest";
import * as shared from "@charlybot/shared";

vi.mock("../../src/infrastructure/valkey", () => ({
  getValkeyClient: vi.fn(() => ({
    acquireLock: vi.fn().mockResolvedValue(true),
    releaseLock: vi.fn().mockResolvedValue(true),
    isConnected: vi.fn(() => true),
  })),
}));

const EconomyRepo = await import("../../src/config/repositories/EconomyRepo.js");
const { ValidationError } = shared;

const prismaMock = shared.prisma as unknown as {
  guild: { upsert: ReturnType<typeof vi.fn> };
  userEconomy: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  globalBank: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  leaderboard: {
    upsert: ReturnType<typeof vi.fn>;
  };
  rouletteBet: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  rouletteGame: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("EconomyRepo money persistence hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(shared, "withDistributedLock").mockImplementation(
      async (_valkey, _namespace, _key, callback) => await callback(),
    );
    prismaMock.guild.upsert.mockResolvedValue({ guildId: "guild-1" });
  });

  it("ensures the guild exists and rounds money fields when creating an economy user", async () => {
    prismaMock.userEconomy.create.mockImplementation(async ({ data }) => data);

    const created = await EconomyRepo.createEconomyUser("guild-1", {
      userId: "user-1",
      guildId: "guild-1",
      username: "User",
      pocket: 12.6,
      totalEarned: 2.4,
      totalLost: 0,
      inJail: false,
    });

    expect(prismaMock.guild.upsert).toHaveBeenCalledWith({
      where: { guildId: "guild-1" },
      update: {},
      create: { guildId: "guild-1" },
    });
    expect(prismaMock.userEconomy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        guildId: "guild-1",
        pocket: 13,
        totalEarned: 2,
        totalLost: 0,
      }),
    });
    expect(created.pocket).toBe(13);
    expect(created.totalEarned).toBe(2);
  });

  it("rounds deposits before pocket and bank persistence", async () => {
    prismaMock.userEconomy.findUnique.mockResolvedValue({
      userId: "user-1",
      guildId: "guild-1",
      pocket: 50,
      totalEarned: 0,
      totalLost: 0,
    });
    prismaMock.globalBank.findUnique.mockResolvedValue({
      userId: "user-1",
      username: "User",
      bank: 2,
    });
    prismaMock.userEconomy.update.mockResolvedValue({ pocket: 37 });
    prismaMock.globalBank.update.mockResolvedValue({ bank: 15 });

    const result = await EconomyRepo.atomicDeposit("user-1", "guild-1", "User", 12.6);

    expect(prismaMock.userEconomy.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pocket: 37 } }),
    );
    expect(prismaMock.globalBank.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { bank: 15 } }),
    );
    expect(result.user.pocket).toBe(37);
    expect(result.bank.bank).toBe(15);
  });

  it("ensures the guild exists before creating a missing withdraw user and rounds the persisted amount", async () => {
    prismaMock.globalBank.findUnique.mockResolvedValue({
      userId: "user-1",
      username: "User",
      bank: 25,
    });
    prismaMock.userEconomy.findUnique.mockResolvedValueOnce(null);
    prismaMock.userEconomy.create.mockResolvedValue({
      userId: "user-1",
      guildId: "guild-1",
      username: "User",
      pocket: 0,
      totalEarned: 0,
      totalLost: 0,
      inJail: false,
    });
    prismaMock.globalBank.update.mockResolvedValue({ bank: 17 });
    prismaMock.userEconomy.update.mockResolvedValue({ pocket: 8 });

    const result = await EconomyRepo.atomicWithdraw("user-1", "guild-1", "User", 7.5);

    expect(prismaMock.guild.upsert).toHaveBeenCalledWith({
      where: { guildId: "guild-1" },
      update: {},
      create: { guildId: "guild-1" },
    });
    expect(prismaMock.userEconomy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ guildId: "guild-1", pocket: 0 }),
    });
    expect(prismaMock.globalBank.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { bank: 17 } }),
    );
    expect(prismaMock.userEconomy.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pocket: 8 } }),
    );
    expect(result.bank.bank).toBe(17);
    expect(result.user.pocket).toBe(8);
  });

  it("rounds roulette bets before deducting pocket balance and persisting the bet", async () => {
    prismaMock.userEconomy.findUnique.mockResolvedValue({
      userId: "user-1",
      guildId: "guild-1",
      pocket: 100,
      totalEarned: 0,
      totalLost: 5,
    });
    prismaMock.userEconomy.update.mockResolvedValue({ pocket: 87, totalLost: 18 });
    prismaMock.rouletteBet.create.mockImplementation(async ({ data }) => ({ id: 1, ...data }));

    const result = await EconomyRepo.atomicPlaceBet(
      "user-1",
      "guild-1",
      10,
      12.6,
      "color",
      "red",
    );

    expect(prismaMock.userEconomy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pocket: 87, totalLost: 18 },
      }),
    );
    expect(prismaMock.rouletteBet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 13, gameId: 10, guildId: "guild-1" }),
    });
    expect(result.amount).toBe(13);
  });

  it("ensures the guild exists and preserves signed integer leaderboard totals before upsert", async () => {
    prismaMock.leaderboard.upsert.mockImplementation(async ({ create, update }) => ({
      userId: "user-1",
      guildId: "guild-1",
      username: "User",
      joinedServerAt: new Date("2026-06-06T00:00:00.000Z"),
      ...create,
      ...update,
    }));

    const result = await EconomyRepo.upsertLeaderboard("guild-1", {
      userId: "user-1",
      guildId: "guild-1",
      username: "User",
      totalMoney: -12,
      joinedServerAt: new Date("2026-06-06T00:00:00.000Z"),
    });

    expect(prismaMock.guild.upsert).toHaveBeenCalledWith({
      where: { guildId: "guild-1" },
      update: {},
      create: { guildId: "guild-1" },
    });
    expect(prismaMock.leaderboard.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ totalMoney: -12 }),
        create: expect.objectContaining({ totalMoney: -12, guildId: "guild-1" }),
      }),
    );
    expect(result.totalMoney).toBe(-12);
  });

  it("rejects decimal signed leaderboard totals instead of rounding them", async () => {
    await expect(
      EconomyRepo.upsertLeaderboard("guild-1", {
        userId: "user-1",
        guildId: "guild-1",
        username: "User",
        totalMoney: -12.6,
        joinedServerAt: new Date("2026-06-06T00:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(prismaMock.leaderboard.upsert).not.toHaveBeenCalled();
  });

  it("validates roulette bet updates before persisting them", async () => {
    prismaMock.rouletteBet.update.mockImplementation(async ({ data }) => ({ id: 1, ...data }));

    await expect(
      EconomyRepo.updateRouletteBet("guild-1", 1, {
        amount: 10.2,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      EconomyRepo.updateRouletteBet("guild-1", 1, {
        winAmount: -1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const updated = await EconomyRepo.updateRouletteBet("guild-1", 1, {
      amount: 10,
      winAmount: null,
      result: "lose",
    });

    expect(prismaMock.rouletteBet.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        amount: 10,
        winAmount: null,
        result: "lose",
      }),
    });
    expect(updated.winAmount).toBeNull();
  });

  it("rejects negative values for non-negative money fields instead of silently rounding them", async () => {
    await expect(
      EconomyRepo.createEconomyUser("guild-1", {
        userId: "user-1",
        guildId: "guild-1",
        username: "User",
        pocket: -0.4,
        totalEarned: 0,
        totalLost: 0,
        inJail: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      EconomyRepo.updateGlobalBank("guild-1", "user-1", {
        bank: -1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      EconomyRepo.placeRouletteBet("guild-1", 10, {
        userId: "user-1",
        guildId: "guild-1",
        amount: 20,
        betType: "color",
        betValue: "red",
        winAmount: -2,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(prismaMock.userEconomy.create).not.toHaveBeenCalled();
    expect(prismaMock.globalBank.update).not.toHaveBeenCalled();
    expect(prismaMock.rouletteBet.create).not.toHaveBeenCalled();
  });

  it("processes spinning roulette games and persists integer payouts", async () => {
    const game = {
      id: 10,
      guildId: "guild-1",
      status: "spinning",
      bets: [
        {
          id: 101,
          userId: "user-1",
          guildId: "guild-1",
          amount: 13,
          betType: "color",
          betValue: "red",
        },
        {
          id: 102,
          userId: "user-2",
          guildId: "guild-1",
          amount: 5,
          betType: "color",
          betValue: "green",
        },
      ],
    };

    prismaMock.rouletteGame.findUnique.mockResolvedValue(game);
    prismaMock.rouletteBet.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));
    prismaMock.userEconomy.update.mockImplementation(async ({ where, data }) => ({
      userId: where.userId_guildId.userId,
      guildId: where.userId_guildId.guildId,
      ...data,
    }));
    prismaMock.rouletteGame.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...game,
      ...data,
    }));

    const result = await EconomyRepo.atomicProcessRouletteResults(10, "guild-1", 7, "red");

    expect(result).toEqual({
      gameId: 10,
      results: [
        { betId: 101, userId: "user-1", won: true, winAmount: 26 },
        { betId: 102, userId: "user-2", won: false, winAmount: 0 },
      ],
    });
    expect(prismaMock.rouletteBet.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: { result: "win", winAmount: 26 },
    });
    expect(prismaMock.userEconomy.update).toHaveBeenCalledWith({
      where: { userId_guildId: { userId: "user-1", guildId: "guild-1" } },
      data: {
        pocket: { increment: 26 },
        totalEarned: { increment: 26 },
      },
    });
    expect(prismaMock.rouletteGame.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        status: "finished",
        winningNumber: 7,
        winningColor: "red",
        endTime: expect.any(Date),
      }),
    });
  });

  it("rejects processing roulette games that are already finished", async () => {
    prismaMock.rouletteGame.findUnique.mockResolvedValue({
      id: 10,
      guildId: "guild-1",
      status: "finished",
      bets: [],
    });

    await expect(
      EconomyRepo.atomicProcessRouletteResults(10, "guild-1", 7, "red"),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      EconomyRepo.atomicProcessRouletteResults(10, "guild-1", 7, "red"),
    ).rejects.toThrow(/already processed/);

    expect(prismaMock.rouletteBet.update).not.toHaveBeenCalled();
    expect(prismaMock.userEconomy.update).not.toHaveBeenCalled();
    expect(prismaMock.rouletteGame.update).not.toHaveBeenCalled();
  });
});
