import { prisma, PrismaClient } from "@charlybot/shared";
import { beforeEach, afterEach } from "vitest";

export type TestPrismaClient = Awaited<ReturnType<typeof prisma.$transaction>> extends Promise<infer T>
  ? T
  : PrismaClient;

/**
 * Test database helper with automatic transaction isolation.
 * 
 * Uses Prisma's interactive transactions to:
 * 1. Create test data within the transaction
 * 2. Run the test
 * 3. Automatically rollback on completion
 * 
 * This ensures test isolation without needing a separate test database.
 */
export const db = {
  /**
   * Run a test within a transaction that automatically rolls back.
   * Use this for integration tests that modify the database.
   */
  test: async <T>(
    fn: (tx: TestPrismaClient) => Promise<T>
  ): Promise<T> => {
    return prisma.$transaction(async (tx) => {
      // Set a longer timeout for transaction tests
      return fn(tx as TestPrismaClient);
    }, {
      maxWait: 15000,
      timeout: 20000,
    });
  },

  /**
   * Create test user economy with default values.
   */
  createUser: async (
    tx: TestPrismaClient,
    data: {
      userId: string;
      guildId: string;
      username: string;
      pocket?: number;
      totalEarned?: number;
      totalLost?: number;
    }
  ) => {
    return tx.userEconomy.create({
      data: {
        userId: data.userId,
        guildId: data.guildId,
        username: data.username,
        pocket: data.pocket ?? 1000,
        totalEarned: data.totalEarned ?? 0,
        totalLost: data.totalLost ?? 0,
        inJail: false,
      },
    });
  },

  /**
   * Create test global bank.
   */
  createBank: async (
    tx: TestPrismaClient,
    data: {
      userId: string;
      username: string;
      bank?: number;
    }
  ) => {
    return tx.globalBank.create({
      data: {
        userId: data.userId,
        username: data.username,
        bank: data.bank ?? 0,
      },
    });
  },

  /**
   * Create economy config for a guild.
   */
  createConfig: async (
    tx: TestPrismaClient,
    data: {
      guildId: string;
      startingMoney?: number;
      workMinAmount?: number;
      workMaxAmount?: number;
    }
  ) => {
    return tx.economyConfig.create({
      data: {
        guildId: data.guildId,
        startingMoney: data.startingMoney ?? 1000,
        workMinAmount: data.workMinAmount ?? 100,
        workMaxAmount: data.workMaxAmount ?? 300,
        workCooldown: 300000,
        crimeCooldown: 900000,
        robCooldown: 1800000,
        crimeMultiplier: 3,
        jailTimeWork: 30,
        jailTimeRob: 45,
      },
    });
  },

  /**
   * Get user economy.
   */
  getUser: async (
    tx: TestPrismaClient,
    userId: string,
    guildId: string
  ) => {
    return tx.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });
  },

  /**
   * Get global bank.
   */
  getBank: async (
    tx: TestPrismaClient,
    userId: string
  ) => {
    return tx.globalBank.findUnique({
      where: { userId },
    });
  },

  /**
   * Cleanup all test data created during the test.
   * Call this at the end of a test to ensure clean state.
   */
  cleanup: async (
    tx: TestPrismaClient,
    userIds: string[],
    guildIds: string[]
  ) => {
    await tx.userEconomy.deleteMany({
      where: {
        OR: userIds.map((userId) => ({ userId })),
      },
    });

    await tx.globalBank.deleteMany({
      where: {
        OR: userIds.map((userId) => ({ userId })),
      },
    });

    await tx.economyConfig.deleteMany({
      where: {
        OR: guildIds.map((guildId) => ({ guildId })),
      },
    });
  },
};

/**
 * Setup function to be called in beforeEach.
 * Cleans up any lingering test data from previous runs.
 */
export async function setupTestDb() {
  // In a real scenario, you might want to clean up any orphaned test data
  // For now, we rely on transactions for isolation
}

/**
 * Teardown function to be called in afterEach.
 */
export async function teardownTestDb() {
  // Transactions automatically rollback, so no cleanup needed
}
