/**
 * Economy test infrastructure - factories and helpers for HTTP integration tests.
 * Follows the guilds.test.ts pattern: app.fetch() + X-API-Key header.
 */

import { prisma } from "@charlybot/shared";
import { generateTestId as _generateTestId } from "../helpers/factories";
import app from "../../src/index";

// Re-export generateTestId for convenience
export const generateTestId = _generateTestId;

// Re-export API_KEY from setup for convenience
export const API_KEY = "charly_secret_key";

/**
 * Default test guild for economy tests.
 */
export const TEST_GUILD = {
  ID: "test-guild-economy",
  NAME: "Test Economy Guild",
};

/**
 * Default economy config values.
 */
export const DEFAULT_ECONOMY_CONFIG = {
  startingMoney: 1000,
  workMinAmount: 100,
  workMaxAmount: 300,
  workCooldown: 300000,
  crimeCooldown: 900000,
  robCooldown: 1800000,
  crimeMultiplier: 3,
  jailTimeWork: 30,
  jailTimeRob: 45,
};

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a test user economy record.
 * Uses prisma directly (no transaction wrapper) for HTTP test setup.
 */
export async function createTestUserEconomy(
  guildId: string,
  userId: string,
  overrides?: Partial<{
    username: string;
    pocket: number;
    totalEarned: number;
    totalLost: number;
    inJail: boolean;
  }>
) {
  return prisma.userEconomy.create({
    data: {
      userId,
      guildId,
      username: overrides?.username ?? "TestUser",
      pocket: overrides?.pocket ?? 1000,
      totalEarned: overrides?.totalEarned ?? 0,
      totalLost: overrides?.totalLost ?? 0,
      inJail: overrides?.inJail ?? false,
    },
  });
}

/**
 * Create a test global bank record.
 * Uses prisma directly for HTTP test setup.
 */
export async function createTestBank(
  userId: string,
  overrides?: Partial<{
    username: string;
    bank: number;
  }>
) {
  return prisma.globalBank.create({
    data: {
      userId,
      username: overrides?.username ?? "TestUser",
      bank: overrides?.bank ?? 0,
    },
  });
}

/**
 * Create a test economy config record.
 * Uses prisma directly for HTTP test setup.
 * Uses upsert to handle multiple tests with the same guildId.
 */
export async function createTestEconomyConfig(
  guildId: string,
  overrides?: Partial<{
    startingMoney: number;
    workMinAmount: number;
    workMaxAmount: number;
    workCooldown: number;
    crimeCooldown: number;
    robCooldown: number;
    crimeMultiplier: number;
    jailTimeWork: number;
    jailTimeRob: number;
    rouletteChannelId: string | null;
  }>
) {
  return prisma.economyConfig.upsert({
    where: { guildId },
    update: {},
    create: {
      guildId,
      startingMoney: overrides?.startingMoney ?? DEFAULT_ECONOMY_CONFIG.startingMoney,
      workMinAmount: overrides?.workMinAmount ?? DEFAULT_ECONOMY_CONFIG.workMinAmount,
      workMaxAmount: overrides?.workMaxAmount ?? DEFAULT_ECONOMY_CONFIG.workMaxAmount,
      workCooldown: overrides?.workCooldown ?? DEFAULT_ECONOMY_CONFIG.workCooldown,
      crimeCooldown: overrides?.crimeCooldown ?? DEFAULT_ECONOMY_CONFIG.crimeCooldown,
      robCooldown: overrides?.robCooldown ?? DEFAULT_ECONOMY_CONFIG.robCooldown,
      crimeMultiplier: overrides?.crimeMultiplier ?? DEFAULT_ECONOMY_CONFIG.crimeMultiplier,
      jailTimeWork: overrides?.jailTimeWork ?? DEFAULT_ECONOMY_CONFIG.jailTimeWork,
      jailTimeRob: overrides?.jailTimeRob ?? DEFAULT_ECONOMY_CONFIG.jailTimeRob,
      rouletteChannelId: overrides?.rouletteChannelId ?? null,
    },
  });
}

/**
 * Create a test leaderboard entry.
 * Uses prisma directly for HTTP test setup.
 */
export async function createTestLeaderboardEntry(
  guildId: string,
  userId: string,
  overrides?: Partial<{
    username: string;
    totalMoney: number;
    joinedServerAt: Date;
  }>
) {
  return prisma.leaderboard.create({
    data: {
      userId,
      guildId,
      username: overrides?.username ?? "TestUser",
      totalMoney: overrides?.totalMoney ?? 0,
      joinedServerAt: overrides?.joinedServerAt ?? new Date(),
    },
  });
}

// =============================================================================
// Cleanup Functions
// =============================================================================

/**
 * Cleanup all economy-related test data.
 * Call this in afterEach to ensure test isolation.
 */
export async function cleanupEconomyData(guildIds: string[], userIds: string[]) {
  // Clean up in correct order to handle foreign key constraints
  await prisma.leaderboard.deleteMany({
    where: {
      OR: [
        { guildId: { in: guildIds } },
        { userId: { in: userIds } },
      ],
    },
  }).catch(() => { /* ignore */ });

  await prisma.userEconomy.deleteMany({
    where: {
      OR: [
        { guildId: { in: guildIds } },
        { userId: { in: userIds } },
      ],
    },
  }).catch(() => { /* ignore */ });

  await prisma.globalBank.deleteMany({
    where: { userId: { in: userIds } },
  }).catch(() => { /* ignore */ });

  await prisma.economyConfig.deleteMany({
    where: { guildId: { in: guildIds } },
  }).catch(() => { /* ignore */ });
}

/**
 * Cleanup a single user's economy data.
 */
export async function cleanupUserEconomyData(userId: string) {
  await prisma.leaderboard.deleteMany({ where: { userId } }).catch(() => { /* ignore */ });
  await prisma.userEconomy.deleteMany({ where: { userId } }).catch(() => { /* ignore */ });
  await prisma.globalBank.deleteMany({ where: { userId } }).catch(() => { /* ignore */ });
}

/**
 * Cleanup a guild's economy config.
 */
export async function cleanupGuildEconomyConfig(guildId: string) {
  await prisma.economyConfig.deleteMany({ where: { guildId } }).catch(() => { /* ignore */ });
  await prisma.leaderboard.deleteMany({ where: { guildId } }).catch(() => { /* ignore */ });
}

// =============================================================================
// Request Helper
// =============================================================================

/**
 * Helper to make authenticated HTTP requests to the economy API.
 * Normalizes URL and adds X-API-Key header automatically.
 */
export async function request(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
) {
  const url = path.startsWith("/") ? path : `/${path}`;
  
  const requestHeaders: Record<string, string> = {
    "X-API-Key": API_KEY,
    ...headers,
  };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await app.fetch(
    new Request(url, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  );

  return response;
}

/**
 * Make a GET request to the economy API.
 */
export async function get(path: string, headers?: Record<string, string>) {
  return request("GET", path, undefined, headers);
}

/**
 * Make a POST request to the economy API.
 */
export async function post(path: string, body: unknown, headers?: Record<string, string>) {
  return request("POST", path, body, headers);
}

/**
 * Make a PATCH request to the economy API.
 */
export async function patch(path: string, body: unknown, headers?: Record<string, string>) {
  return request("PATCH", path, body, headers);
}

/**
 * Make a DELETE request to the economy API.
 */
export async function del(path: string, headers?: Record<string, string>) {
  return request("DELETE", path, undefined, headers);
}

// =============================================================================
// Valkey Connectivity Check
// =============================================================================

import { initializeValkey, getValkeyClient } from "../../src/infrastructure/valkey";

let valkeyAvailableCache: boolean | null = null;

/**
 * Check if Valkey is available for distributed lock tests.
 * Caches result to avoid repeated connectivity checks.
 */
export async function isValkeyAvailable(): Promise<boolean> {
  if (valkeyAvailableCache !== null) {
    return valkeyAvailableCache;
  }

  try {
    await initializeValkey();
    const client = getValkeyClient();
    valkeyAvailableCache = client.isConnected();
  } catch {
    valkeyAvailableCache = false;
  }

  return valkeyAvailableCache;
}

/**
 * Reset Valkey availability cache.
 * Useful for test suites that need to re-check connectivity.
 */
export function resetValkeyCache() {
  valkeyAvailableCache = null;
}