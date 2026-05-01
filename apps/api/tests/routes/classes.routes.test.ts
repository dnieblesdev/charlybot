import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../../src/index";
import { prisma } from "@charlybot/shared";
import { createTestGuild, createTestClass, createTestTipoClase, cleanupTestGuild, generateTestId } from "../helpers/factories";
import { getAuthCookie } from "../helpers/auth";

describe("Classes API - GET /api/v1/classes/guild/:guildId", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should return 200 with paginated classes", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/classes/guild/${testGuildId}?page=1&limit=20`, {
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

describe("Classes API - POST /api/v1/classes", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    await createTestTipoClase(prisma, testGuildId, "role-healer", "Healer");
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should create class with valid payload", async () => {
    // Note: guildAccessMiddleware extracts guildId from URL path, not body.
    // POST /api/v1/classes doesn't have guildId in path, so we skip guildAccessMiddleware.
    // We use a valid JWT without guild-specific access since the route doesn't require it.
    const cookie = await getAuthCookie([]);
    const response = await app.fetch(
      new Request(`/api/v1/classes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          rolId: "role-dps",
          name: "Assassin",
          type: "DPS",
          typeRoleId: "role-dps",
        }),
      })
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as { guildId?: string; name?: string };
    expect(data.guildId).toBe(testGuildId);
    expect(data.name).toBe("Assassin");
  });
});

describe("Classes API - DELETE /api/v1/classes/guild/:guildId/:name", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("should return 404 when class doesn't exist", async () => {
    const cookie = await getAuthCookie([testGuildId]);
    const response = await app.fetch(
      new Request(`/api/v1/classes/guild/${testGuildId}/NonExistentClass`, {
        method: "DELETE",
        headers: {
          Cookie: cookie,
        },
      })
    );

    expect(response.status).toBe(404);
    const data = (await response.json()) as { error?: string };
    expect(data.error).toBe("Class not found");
  });
});

describe("Classes API - Authentication", () => {
  it("should return 401 without JWT cookie", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/classes/guild/test-guild`, {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
  });

  it("should return 401 with invalid JWT cookie", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/classes/guild/test-guild`, {
        method: "GET",
        headers: {
          Cookie: "accessToken=invalid-token",
        },
      })
    );

    expect(response.status).toBe(401);
  });
});