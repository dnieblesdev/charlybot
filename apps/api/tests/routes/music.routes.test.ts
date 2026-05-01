import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../../src/index";
import { prisma } from "@charlybot/shared";
import { createTestGuild, createTestMusicQueue, cleanupTestGuild, generateTestId } from "../helpers/factories";
import { getAuthCookie } from "../helpers/auth";

describe("Music API - GET /api/v1/music/queues/:guildId", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    await createTestMusicQueue(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should return 200 with music queue and items", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/music/queues/${testGuildId}`, {
        method: "GET",
        headers: {
          Cookie: cookie,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; items?: unknown[] };
    expect(data.guildId).toBe(testGuildId);
    expect(Array.isArray(data.items)).toBe(true);
  });
});

describe("Music API - GET /api/v1/music/config/:guildId", () => {
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
      new Request(`/api/v1/music/config/${testGuildId}`, {
        method: "GET",
        headers: {
          Cookie: cookie,
        },
      })
    );

    expect(response.status).toBe(404);
    const data = (await response.json()) as { error?: string };
    expect(data.error).toBe("Music config not found");
  });
});

describe("Music API - PUT /api/v1/music/config/:guildId", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should create music config with valid payload", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/music/config/${testGuildId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          defaultVolume: 75,
          autoCleanup: true,
          maxQueueSize: 1000,
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; defaultVolume?: number };
    expect(data.guildId).toBe(testGuildId);
    expect(data.defaultVolume).toBe(75);
  });
});

describe("Music API - Authentication", () => {
  it("should return 401 without JWT cookie", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/music/queues/test-guild`, {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
  });

  it("should return 401 with invalid JWT cookie", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/music/queues/test-guild`, {
        method: "GET",
        headers: {
          Cookie: "accessToken=invalid-token",
        },
      })
    );

    expect(response.status).toBe(401);
  });
});