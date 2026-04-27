import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@charlybot/shared";
import { createTestUserEconomy, createTestEconomyConfig, cleanupEconomyData, API_KEY, TEST_GUILD, generateTestId } from "./setup";
import app from "../../src/index";

describe("GET /api/v1/economy/user/:guildId/:userId", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S2.1: should return user economy when user exists", async () => {
    const userId = generateTestId("user-economy-get");
    const username = "TestUser";

    // Setup: create user economy
    await createTestUserEconomy(TEST_GUILD.ID, userId, { username, pocket: 500 });

    // Act: GET user economy
    const res = await app.fetch(
      new Request(`/api/v1/economy/user/${TEST_GUILD.ID}/${userId}`, {
        method: "GET",
        headers: { "X-API-Key": API_KEY_VALID },
      })
    );

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json() as { userId?: string; guildId?: string; pocket?: number; username?: string };
    expect(body.userId).toBe(userId);
    expect(body.guildId).toBe(TEST_GUILD.ID);
    expect(body.pocket).toBe(500);
    expect(body.username).toBe(username);
  });

  it("S2.2: should return 404 when user does not exist", async () => {
    const nonExistentUserId = generateTestId("non-existent-user");

    // Act: GET non-existent user economy
    const res = await app.fetch(
      new Request(`/api/v1/economy/user/${TEST_GUILD.ID}/${nonExistentUserId}`, {
        method: "GET",
        headers: { "X-API-Key": API_KEY_VALID },
      })
    );

    // Assert
    expect(res.status).toBe(404);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("User economy not found");
  });

  it("S2.3: should return 401 when no API key is provided", async () => {
    const userId = generateTestId("user-economy-no-auth");

    // Act: GET without X-API-Key header
    const res = await app.fetch(
      new Request(`/api/v1/economy/user/${TEST_GUILD.ID}/${userId}`, {
        method: "GET",
      })
    );

    // Assert
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/economy/user", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S2.4: should create new user economy", async () => {
    const userId = generateTestId("user-economy-create");
    const username = "NewUser";

    // Act: POST new user economy
    const res = await app.fetch(
      new Request("/api/v1/economy/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          username,
          pocket: 1000,
        }),
      })
    );

    // Assert
    expect(res.status).toBe(201);
    const body = await res.json() as { userId?: string; guildId?: string; pocket?: number };
    expect(body.userId).toBe(userId);
    expect(body.guildId).toBe(TEST_GUILD.ID);
    expect(body.pocket).toBe(1000);
  });

  it("S2.5: should return 400 when required fields are missing", async () => {
    // Act: POST without guildId
    const res = await app.fetch(
      new Request("/api/v1/economy/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId: "some-user",
          username: "Test",
        }),
      })
    );

    // Assert
    expect(res.status).toBe(400);
  });

  it("S2.6: should return 400 when data types are invalid", async () => {
    // Act: POST with invalid pocket type
    const res = await app.fetch(
      new Request("/api/v1/economy/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId: "some-user",
          guildId: TEST_GUILD.ID,
          username: "Test",
          pocket: "not-a-number",
        }),
      })
    );

    // Assert
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/economy/user/:guildId/:userId", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S2.7: should update user economy when user exists", async () => {
    const userId = generateTestId("user-economy-patch");
    const username = "TestUser";

    // Setup: create user economy
    await createTestUserEconomy(TEST_GUILD.ID, userId, { username, pocket: 500 });

    // Act: PATCH user economy with new balance
    const res = await app.fetch(
      new Request(`/api/v1/economy/user/${TEST_GUILD.ID}/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          pocket: 1500,
        }),
      })
    );

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json() as { pocket?: number };
    expect(body.pocket).toBe(1500);
  });

  it("S2.8: should return 500 when updating non-existent user", async () => {
    const nonExistentUserId = generateTestId("non-existent-patch");

    // Act: PATCH non-existent user
    const res = await app.fetch(
      new Request(`/api/v1/economy/user/${TEST_GUILD.ID}/${nonExistentUserId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          pocket: 1000,
        }),
      })
    );

    // Assert: route returns 500 on Prisma not-found error
    expect(res.status).toBe(500);
  });

  it("S2.9: should return 400 when patch data has wrong type for pocket", async () => {
    const userId = generateTestId("user-economy-patch-invalid");

    // Setup: create user economy
    await createTestUserEconomy(TEST_GUILD.ID, userId, { username: "Test", pocket: 500 });

    // Act: PATCH with string instead of number for pocket
    const res = await app.fetch(
      new Request(`/api/v1/economy/user/${TEST_GUILD.ID}/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          pocket: "not-a-number",
        }),
      })
    );

    // Assert: Zod validation should fail because pocket must be number
    expect(res.status).toBe(400);
  });
});