import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../../src/index";
import { prisma } from "@charlybot/shared";
import { createTestGuild, createTestXPConfig, cleanupTestGuild, generateTestId, createTestUserXP, cleanupXPData } from "../helpers/factories";
import { getAuthCookie } from "../helpers/auth";

describe("XP API - GET /api/v1/xp/leaderboard/:guildId", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    await createTestXPConfig(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should return 200 with paginated XP leaderboard", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/xp/leaderboard/${testGuildId}?page=1&limit=10`, {
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
  });
});

describe("XP API - GET /api/v1/xp/level-roles/:guildId", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should return 200 with level roles array", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/xp/level-roles/${testGuildId}`, {
        method: "GET",
        headers: {
          Cookie: cookie,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as unknown[];
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("XP API - GET /api/v1/xp/:guildId/:userId", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    await createTestUserXP(prisma, "test-user-123", testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should return 200 with user XP and economy data", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/xp/${testGuildId}/test-user-123`, {
        method: "GET",
        headers: {
          Cookie: cookie,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { xp?: unknown; economy?: unknown };
    expect(data.xp).toBeDefined();
    expect(data.economy).toBeDefined();
  });

  it("should return 404 when user XP not found", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/xp/${testGuildId}/nonexistent-user`, {
        method: "GET",
        headers: {
          Cookie: cookie,
        },
      })
    );

    expect(response.status).toBe(404);
    const data = (await response.json()) as { error?: string };
    expect(data.error).toBe("User XP not found");
  });
});

describe("XP API - Authentication", () => {
  it("should return 401 without JWT cookie", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/xp/leaderboard/test-guild`, {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
  });

  it("should return 401 with invalid JWT cookie", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/xp/leaderboard/test-guild`, {
        method: "GET",
        headers: {
          Cookie: "accessToken=invalid-token",
        },
      })
    );

    expect(response.status).toBe(401);
  });
});