import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../../src/index";
import { prisma } from "@charlybot/shared";
import { createTestGuild, createTestAutorole, cleanupTestGuild, generateTestId } from "../helpers/factories";
import { getAuthCookie } from "../helpers/auth";

describe("Autoroles API - GET /api/v1/autoroles/guild/:guildId", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should return 200 with paginated autoroles", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/autoroles/guild/${testGuildId}?page=1&limit=20`, {
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

describe("Autoroles API - POST /api/v1/autoroles", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should return 401 without JWT (jwtAuth required for POST)", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "accessToken=invalid", // Invalid JWT
        },
        body: JSON.stringify({
          guildId: testGuildId,
          channelId: "channel-123",
          messageId: "msg-123",
          mode: "unique",
          mappings: [],
        }),
      })
    );

    // jwtAuth is required for POST - returns 401 without valid JWT
    expect(response.status).toBe(401);
  });
});

describe("Autoroles API - Authentication", () => {
  it("should return 401 without JWT cookie for GET", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles/guild/test-guild`, {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
  });

  it("should return 401 with invalid JWT cookie for GET", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles/guild/test-guild`, {
        method: "GET",
        headers: {
          Cookie: "accessToken=invalid-token",
        },
      })
    );

    expect(response.status).toBe(401);
  });
});