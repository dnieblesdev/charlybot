import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@charlybot/shared";
import { createTestUserEconomy, createTestBank, createTestEconomyConfig, cleanupEconomyData, API_KEY, TEST_GUILD, generateTestId } from "./setup";
import app from "../../src/index";

describe("POST /api/v1/economy/withdraw - Atomic Withdraw", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    // Create test config for the guild
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S1.3: should successfully withdraw money from global bank (happy path)", async () => {
    const userId = generateTestId("withdrawer");
    const username = "Withdrawer";
    const withdrawAmount = 300;

    // Setup: create user with small pocket and bank with money
    await createTestUserEconomy(TEST_GUILD.ID, userId, {
      username,
      pocket: 100,
    });
    await createTestBank(userId, { username, bank: 1000 });

    // Act: withdraw via HTTP
    const res = await app.fetch(
      new Request("/api/v1/economy/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          username,
          amount: withdrawAmount,
        }),
      })
    );

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json() as { success?: boolean; bank?: { bank: number }; user?: { pocket: number } };
    expect(body.success).toBe(true);
    expect(body.bank?.bank).toBe(700); // 1000 - 300
    expect(body.user?.pocket).toBe(400); // 100 + 300

    // Verify final state in DB
    const updatedBank = await prisma.globalBank.findUnique({
      where: { userId },
    });
    const updatedUser = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    expect(updatedBank?.bank).toBe(700);
    expect(updatedUser?.pocket).toBe(400);
  });

  it("S1.4: should fail withdraw with insufficient funds in bank", async () => {
    const userId = generateTestId("poor-withdrawer");
    const username = "PoorWithdrawer";
    const withdrawAmount = 500;

    // Setup: create user with small pocket and bank with only 100
    await createTestUserEconomy(TEST_GUILD.ID, userId, {
      username,
      pocket: 100,
    });
    await createTestBank(userId, { username, bank: 100 });

    // Act: attempt withdraw via HTTP
    const res = await app.fetch(
      new Request("/api/v1/economy/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          username,
          amount: withdrawAmount,
        }),
      })
    );

    // Assert: should return 400 error
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("Insufficient funds in bank");
  });

  it("S1.3b: should create new user economy and credit starting money plus withdrawn amount", async () => {
    const userId = generateTestId("new-user-withdraw");
    const username = "NewUserWithdraw";
    const withdrawAmount = 500;

    // Setup: create bank with money but NO user economy record
    await createTestBank(userId, { username, bank: 1000 });
    // Note: NOT creating a user economy record - route should create it

    // Act: withdraw via HTTP
    const res = await app.fetch(
      new Request("/api/v1/economy/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          username,
          amount: withdrawAmount,
        }),
      })
    );

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json() as { success?: boolean; user?: { pocket: number } };
    expect(body.success).toBe(true);
    // User should be created with startingMoney (1000) + withdrawn amount (500) = 1500
    expect(body.user?.pocket).toBe(1500);

    // Verify bank decreased
    const updatedBank = await prisma.globalBank.findUnique({
      where: { userId },
    });
    expect(updatedBank?.bank).toBe(500); // 1000 - 500

    // Verify user was created in DB with correct pocket
    const newUser = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    expect(newUser).not.toBeNull();
    expect(newUser?.pocket).toBe(1500);
  });

  it("S7.2: should return 401 when invalid API key is provided", async () => {
    const userId = generateTestId("withdrawer-invalid-key");
    const username = "WithdrawerInvalidKey";

    // Setup: create user with small pocket and bank with money
    await createTestUserEconomy(TEST_GUILD.ID, userId, {
      username,
      pocket: 100,
    });
    await createTestBank(userId, { username, bank: 1000 });

    // Act: withdraw with wrong API key
    const res = await app.fetch(
      new Request("/api/v1/economy/withdraw", {
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

describe("POST /api/v1/economy/withdraw - Zod Validation", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S1.2 (validation): should return 400 when amount is missing", async () => {
    const userId = generateTestId("withdrawer-missing-amount");

    // Act: withdraw with missing amount field
    const res = await app.fetch(
      new Request("/api/v1/economy/withdraw", {
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
    const userId = generateTestId("withdrawer-zero-amount");

    // Act: withdraw with amount = 0
    const res = await app.fetch(
      new Request("/api/v1/economy/withdraw", {
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
      new Request("/api/v1/economy/withdraw", {
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