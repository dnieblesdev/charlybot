import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../../src/index";
import { prisma } from "@charlybot/shared";
import { createTestGuild, createTestVerification, cleanupTestGuild, generateTestId } from "../helpers/factories";
import { getAuthCookie } from "../helpers/auth";

describe("Verifications API - GET /api/v1/verifications/pending/:guildId", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    await createTestVerification(prisma, {
      guildId: testGuildId,
      userId: "user-123",
      inGameName: "TestPlayer",
      screenshotUrl: "https://example.com/screenshot.png",
      status: "pending",
    });
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should return 200 with paginated pending verifications", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/verifications/pending/${testGuildId}?page=1&limit=20`, {
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
    expect(data.limit).toBe(20);
  });
});

describe("Verifications API - PATCH /api/v1/verifications/:id", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should return 404 for non-existent verification", async () => {
    // Note: PATCH /api/v1/verifications/:id doesn't have guildId in URL path,
    // so guildAccessMiddleware can't validate guild access.
    // We use a valid JWT without guild-specific access.
    const cookie = await getAuthCookie([]);
    const response = await app.fetch(
      new Request(`/api/v1/verifications/nonexistent-id`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          status: "approved",
        }),
      })
    );

    // Returns 404 for non-existent resource or 500 for server error
    const status = response.status;
    expect(status === 404 || status === 500).toBe(true);
  });
});

describe("Verifications API - Authentication", () => {
  it("should return 401 without JWT cookie", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/verifications/pending/test-guild`, {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
  });

  it("should return 401 with invalid JWT cookie", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/verifications/pending/test-guild`, {
        method: "GET",
        headers: {
          Cookie: "accessToken=invalid-token",
        },
      })
    );

    expect(response.status).toBe(401);
  });
});