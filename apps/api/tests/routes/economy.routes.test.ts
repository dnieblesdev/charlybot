import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../../src/index";
import { prisma } from "@charlybot/shared";
import { createTestGuild, cleanupTestGuild, generateTestId } from "../helpers/factories";
import { getAuthCookie } from "../helpers/auth";

describe("Economy API - GET /api/v1/economy/leaderboard/:guildId", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should return 200 with paginated leaderboard data", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/economy/leaderboard/${testGuildId}?page=1&limit=10`, {
        method: "GET",
        headers: {
          Cookie: cookie,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { data?: unknown[]; total?: number; page?: number; limit?: number; totalPages?: number };
    expect(Array.isArray(data.data)).toBe(true);
    expect(typeof data.total).toBe("number");
    expect(data.page).toBe(1);
    expect(data.limit).toBe(10);
  });
});

describe("Economy API - GET /api/v1/economy/config/:guildId", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should return 404 when config doesn't exist", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/economy/config/${testGuildId}`, {
        method: "GET",
        headers: {
          Cookie: cookie,
        },
      })
    );

    expect(response.status).toBe(404);
    const data = (await response.json()) as { error?: string };
    expect(data.error).toBe("Economy config not found");
  });
});

describe("Economy API - PATCH /api/v1/economy/config/:guildId", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should create economy config with valid payload", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/economy/config/${testGuildId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          startingMoney: 5000,
          workMinAmount: 100,
          workMaxAmount: 500,
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; startingMoney?: number };
    expect(data.guildId).toBe(testGuildId);
    expect(data.startingMoney).toBe(5000);
  });
});

describe("Economy API - Authentication", () => {
  it("should return 401 without JWT cookie", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/economy/leaderboard/test-guild`, {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
  });

  it("should return 401 with invalid JWT cookie", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/economy/leaderboard/test-guild`, {
        method: "GET",
        headers: {
          Cookie: "accessToken=invalid-token",
        },
      })
    );

    expect(response.status).toBe(401);
  });
});