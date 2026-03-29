import type { TestPrismaClient } from "../helpers/db";

/**
 * Test fixture factory for economy tests.
 * Provides reusable test data generators.
 */

// Constants for test data
export const TEST_GUILD = {
  ID: "test-guild-123",
  NAME: "Test Server",
};

export const TEST_USERS = {
  SENDER: {
    ID: "sender-user-456",
    USERNAME: "TestSender",
  },
  RECEIVER: {
    ID: "receiver-user-789",
    USERNAME: "TestReceiver",
  },
  RICH_USER: {
    ID: "rich-user-999",
    USERNAME: "RichUser",
  },
  POOR_USER: {
    ID: "poor-user-000",
    USERNAME: "PoorUser",
  },
} as const;

export const DEFAULT_STARTING_MONEY = 1000;

/**
 * Create a basic user economy with default values.
 */
export async function createTestUser(
  tx: TestPrismaClient,
  overrides: {
    userId: string;
    guildId?: string;
    username?: string;
    pocket?: number;
    totalEarned?: number;
    totalLost?: number;
  }
) {
  const guildId = overrides.guildId ?? TEST_GUILD.ID;
  const username = overrides.username ?? "TestUser";

  return tx.userEconomy.create({
    data: {
      userId: overrides.userId,
      guildId,
      username,
      pocket: overrides.pocket ?? DEFAULT_STARTING_MONEY,
      totalEarned: overrides.totalEarned ?? 0,
      totalLost: overrides.totalLost ?? 0,
      inJail: false,
    },
  });
}

/**
 * Create a user with a lot of money for testing edge cases.
 */
export async function createRichUser(tx: TestPrismaClient, userId: string = TEST_USERS.RICH_USER.ID) {
  return createTestUser(tx, {
    userId,
    username: "RichUser",
    pocket: 100000,
    totalEarned: 100000,
  });
}

/**
 * Create a user with no money.
 */
export async function createPoorUser(tx: TestPrismaClient, userId: string = TEST_USERS.POOR_USER.ID) {
  return createTestUser(tx, {
    userId,
    username: "PoorUser",
    pocket: 0,
    totalEarned: 0,
  });
}

/**
 * Create a standard test user with default money.
 */
export async function createStandardUser(
  tx: TestPrismaClient,
  userId: string,
  username: string,
  guildId: string = TEST_GUILD.ID,
  pocket: number = DEFAULT_STARTING_MONEY
) {
  return createTestUser(tx, {
    userId,
    guildId,
    username,
    pocket,
  });
}

/**
 * Create global bank for a user.
 */
export async function createTestBank(
  tx: TestPrismaClient,
  userId: string,
  username: string = "TestUser",
  bank: number = 0
) {
  return tx.globalBank.create({
    data: {
      userId,
      username,
      bank,
    },
  });
}

/**
 * Create a bank with a lot of money.
 */
export async function createRichBank(tx: TestPrismaClient, userId: string = TEST_USERS.RICH_USER.ID) {
  return createTestBank(tx, userId, "RichUser", 50000);
}

/**
 * Create economy config for a guild.
 */
export async function createTestConfig(
  tx: TestPrismaClient,
  guildId: string = TEST_GUILD.ID,
  config?: {
    startingMoney?: number;
    workMinAmount?: number;
    workMaxAmount?: number;
  }
) {
  return tx.economyConfig.create({
    data: {
      guildId,
      startingMoney: config?.startingMoney ?? DEFAULT_STARTING_MONEY,
      workMinAmount: config?.workMinAmount ?? 100,
      workMaxAmount: config?.workMaxAmount ?? 300,
      workCooldown: 300000,
      crimeCooldown: 900000,
      robCooldown: 1800000,
      crimeMultiplier: 3,
      jailTimeWork: 30,
      jailTimeRob: 45,
    },
  });
}

/**
 * Generate a unique test user ID to avoid conflicts.
 */
export function generateTestUserId(prefix: string = "user"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique guild ID for test isolation.
 */
export function generateTestGuildId(prefix: string = "guild"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
