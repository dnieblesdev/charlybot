import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@charlybot/shared";
import { createTestBank, createTestUserEconomy, createTestEconomyConfig, cleanupEconomyData, API_KEY, TEST_GUILD, generateTestId } from "./setup";
import app from "../../src/index";

describe("GET /api/v1/economy/bank/:userId", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S3.1: should return bank when bank record exists", async () => {
    const userId = generateTestId("bank-get");
    const username = "BankUser";

    // Setup: create bank record
    await createTestBank(userId, { username, bank: 5000 });

    // Act: GET bank
    const res = await app.fetch(
      new Request(`/api/v1/economy/bank/${userId}`, {
        method: "GET",
        headers: { "X-API-Key": API_KEY_VALID },
      })
    );

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json() as { userId?: string; bank?: number; username?: string };
    expect(body.userId).toBe(userId);
    expect(body.bank).toBe(5000);
    expect(body.username).toBe(username);
  });

  it("S3.2: should return 404 when bank does not exist", async () => {
    const nonExistentUserId = generateTestId("non-existent-bank");

    // Act: GET non-existent bank
    const res = await app.fetch(
      new Request(`/api/v1/economy/bank/${nonExistentUserId}`, {
        method: "GET",
        headers: { "X-API-Key": API_KEY_VALID },
      })
    );

    // Assert
    expect(res.status).toBe(404);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("Global bank not found");
  });
});

describe("POST /api/v1/economy/bank", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S3.3: should create new bank record", async () => {
    const userId = generateTestId("bank-create");
    const username = "NewBankUser";

    // Act: POST new bank
    const res = await app.fetch(
      new Request("/api/v1/economy/bank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          username,
          bank: 1000,
        }),
      })
    );

    // Assert
    expect(res.status).toBe(201);
    const body = await res.json() as { userId?: string; bank?: number };
    expect(body.userId).toBe(userId);
    expect(body.bank).toBe(1000);
  });

  it("S3.4: should return 400 when required fields are missing", async () => {
    // Act: POST without userId
    const res = await app.fetch(
      new Request("/api/v1/economy/bank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          username: "Test",
          bank: 1000,
        }),
      })
    );

    // Assert
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/economy/bank/:userId", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S3.5: should update bank when bank exists", async () => {
    const userId = generateTestId("bank-patch");
    const username = "BankUser";

    // Setup: create bank record
    await createTestBank(userId, { username, bank: 5000 });

    // Act: PATCH bank with new vault
    const res = await app.fetch(
      new Request(`/api/v1/economy/bank/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          bank: 8000,
        }),
      })
    );

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json() as { bank?: number };
    expect(body.bank).toBe(8000);
  });

  it("S3.6: should return 500 when updating non-existent bank", async () => {
    const nonExistentUserId = generateTestId("non-existent-bank-patch");

    // Act: PATCH non-existent bank
    const res = await app.fetch(
      new Request(`/api/v1/economy/bank/${nonExistentUserId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          bank: 1000,
        }),
      })
    );

    // Assert: route returns 500 on Prisma not-found error
    expect(res.status).toBe(500);
  });
});

describe("Bank API - Authentication", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S7.5: should return 401 when no API key is provided for GET", async () => {
    const userId = generateTestId("bank-no-auth");

    // Act: GET without X-API-Key header
    const res = await app.fetch(
      new Request(`/api/v1/economy/bank/${userId}`, {
        method: "GET",
      })
    );

    // Assert
    expect(res.status).toBe(401);
  });

  it("should return 401 when no API key is provided for POST", async () => {
    const userId = generateTestId("bank-post-no-auth");

    // Act: POST without X-API-Key header
    const res = await app.fetch(
      new Request("/api/v1/economy/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, username: "Test", bank: 100 }),
      })
    );

    // Assert
    expect(res.status).toBe(401);
  });
});