import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { prisma } from "@charlybot/shared";
import { createTestUserEconomy, createTestBank, createTestEconomyConfig, cleanupEconomyData, API_KEY, TEST_GUILD, generateTestId } from "./setup";
import app from "../../src/index";

describe("POST /api/v1/economy/deposit - Atomic Deposit", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    // Create test config for the guild
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S1.1: should successfully deposit money to global bank (happy path)", async () => {
    const userId = generateTestId("depositor");
    const username = "Depositor";
    const depositAmount = 500;

    // Setup: create user with pocket money
    await createTestUserEconomy(TEST_GUILD.ID, userId, {
      username,
      pocket: 1000,
    });
    await createTestBank(userId, { username, bank: 100 });

    // Act: deposit via HTTP
    const res = await app.fetch(
      new Request("/api/v1/economy/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          username,
          amount: depositAmount,
        }),
      })
    );

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json() as { success?: boolean; user?: { pocket: number }; bank?: { bank: number } };
    expect(body.success).toBe(true);
    expect(body.user?.pocket).toBe(500); // 1000 - 500
    expect(body.bank?.bank).toBe(600); // 100 + 500

    // Verify final state in DB
    const updatedUser = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    const updatedBank = await prisma.globalBank.findUnique({
      where: { userId },
    });
    expect(updatedUser?.pocket).toBe(500);
    expect(updatedBank?.bank).toBe(600);
  });

  it("S1.2: should fail deposit with insufficient funds in pocket", async () => {
    const userId = generateTestId("poor-depositor");
    const username = "PoorDepositor";
    const depositAmount = 500;

    // Setup: create user with only 100 in pocket
    await createTestUserEconomy(TEST_GUILD.ID, userId, {
      username,
      pocket: 100,
    });

    // Act: attempt deposit via HTTP
    const res = await app.fetch(
      new Request("/api/v1/economy/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          username,
          amount: depositAmount,
        }),
      })
    );

    // Assert: should return 400 error
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("Insufficient funds in pocket");
  });

  it("S1.1b: should create new bank if it doesn't exist when depositing", async () => {
    const userId = generateTestId("new-depositor");
    const username = "NewDepositor";
    const depositAmount = 300;

    // Setup: create user with pocket money (no bank exists yet)
    await createTestUserEconomy(TEST_GUILD.ID, userId, {
      username,
      pocket: 1000,
    });
    // Note: NOT creating a bank record - route should create it automatically

    // Act: deposit via HTTP
    const res = await app.fetch(
      new Request("/api/v1/economy/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          username,
          amount: depositAmount,
        }),
      })
    );

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json() as { success?: boolean; bank?: { bank: number } };
    expect(body.success).toBe(true);
    expect(body.bank?.bank).toBe(300); // new bank created with deposit amount

    // Verify user's pocket decreased
    const updatedUser = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    expect(updatedUser?.pocket).toBe(700); // 1000 - 300

    // Verify bank was created in DB
    const newBank = await prisma.globalBank.findUnique({
      where: { userId },
    });
    expect(newBank).not.toBeNull();
    expect(newBank?.bank).toBe(300);
  });

  it("S1.9: should return 401 when no API key is provided", async () => {
    const userId = generateTestId("depositor-no-auth");
    const username = "DepositorNoAuth";

    // Setup: create user with pocket money
    await createTestUserEconomy(TEST_GUILD.ID, userId, {
      username,
      pocket: 1000,
    });

    // Act: deposit WITHOUT X-API-Key header
    const res = await app.fetch(
      new Request("/api/v1/economy/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // No X-API-Key header
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          username,
          amount: 100,
        }),
      })
    );

    // Assert: should return 401
    expect(res.status).toBe(401);
  });

  it("S1.10: should return 401 when invalid API key is provided", async () => {
    const userId = generateTestId("depositor-invalid-key");
    const username = "DepositorInvalidKey";

    // Setup: create user with pocket money
    await createTestUserEconomy(TEST_GUILD.ID, userId, {
      username,
      pocket: 1000,
    });

    // Act: deposit with wrong API key
    const res = await app.fetch(
      new Request("/api/v1/economy/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "wrong-api-key",
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          username,
          amount: 100,
        }),
      })
    );

    // Assert: should return 401
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/economy/deposit - Zod Validation", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S1.2 (validation): should return 400 when amount is missing", async () => {
    const userId = generateTestId("depositor-missing-amount");

    // Act: deposit with missing amount field
    const res = await app.fetch(
      new Request("/api/v1/economy/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          username: "TestUser",
          // amount is missing
        }),
      })
    );

    // Assert: should return 400 due to Zod validation failure
    expect(res.status).toBe(400);
  });

  it("S1.2 (validation): should return 400 when amount is zero or negative", async () => {
    const userId = generateTestId("depositor-zero-amount");

    // Act: deposit with amount = 0
    const res = await app.fetch(
      new Request("/api/v1/economy/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          username: "TestUser",
          amount: 0,
        }),
      })
    );

    // Assert: Zod schema requires positive number, so 0 should fail
    expect(res.status).toBe(400);

    // Test negative amount
    const res2 = await app.fetch(
      new Request("/api/v1/economy/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          username: "TestUser",
          amount: -100,
        }),
      })
    );

    expect(res2.status).toBe(400);
  });
});