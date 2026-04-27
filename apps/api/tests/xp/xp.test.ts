import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../../src/index";
import { prisma } from "@charlybot/shared";
import {
  createTestGuild,
  createTestXPConfig,
  createTestLevelRole,
  createTestUserXP,
  cleanupXPData,
  generateTestId,
} from "../helpers/factories";

const API_KEY = "charly_secret_key";

describe("Leaderboard API", () => {
  const testGuildId = generateTestId("leaderboard");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await prisma.guild.deleteMany({ where: { guildId: testGuildId } });
  });

  it("T5.1: should return empty leaderboard when no users", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/leaderboard/${testGuildId}`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  it("T5.2: should return leaderboard with users sorted by XP desc", async () => {
    await createTestUserXP(prisma, "user-a", testGuildId, { xp: 100, username: "UserA" });
    await createTestUserXP(prisma, "user-b", testGuildId, { xp: 300, username: "UserB" });
    await createTestUserXP(prisma, "user-c", testGuildId, { xp: 200, username: "UserC" });

    const res = await app.fetch(
      new Request(`/api/v1/xp/leaderboard/${testGuildId}`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(3);
    expect(body.data[0].xp).toBe(300);
    expect(body.data[1].xp).toBe(200);
    expect(body.data[2].xp).toBe(100);
    expect(body.total).toBe(3);
  });

  it("T5.3: should sort by lastMessageAt as tiebreaker", async () => {
    const older = new Date("2024-01-01");
    const newer = new Date("2024-06-01");
    const newest = new Date("2024-12-01");

    await createTestUserXP(prisma, "user-old", testGuildId, { xp: 100, lastMessageAt: older });
    await createTestUserXP(prisma, "user-mid", testGuildId, { xp: 100, lastMessageAt: newer });
    await createTestUserXP(prisma, "user-new", testGuildId, { xp: 100, lastMessageAt: newest });

    const res = await app.fetch(
      new Request(`/api/v1/xp/leaderboard/${testGuildId}`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    // Same XP (100), ordered by lastMessageAt asc (oldest first)
    expect(body.data[0].userId).toBe("user-old");
    expect(body.data[1].userId).toBe("user-mid");
    expect(body.data[2].userId).toBe("user-new");
  });

  it("T5.4: should paginate with default page=1 limit=20", async () => {
    for (let i = 0; i < 25; i++) {
      await createTestUserXP(prisma, `user-${i}`, testGuildId, { xp: i * 10 });
    }

    const res = await app.fetch(
      new Request(`/api/v1/xp/leaderboard/${testGuildId}`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(20); // default limit
    expect(body.total).toBe(25);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.totalPages).toBe(2);
  });

  it("T5.5: should return page 2 with limit 10", async () => {
    for (let i = 0; i < 15; i++) {
      await createTestUserXP(prisma, `user-${i}`, testGuildId, { xp: i * 10 });
    }

    const res = await app.fetch(
      new Request(`/api/v1/xp/leaderboard/${testGuildId}?page=2&limit=10`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(5); // remaining 5
    expect(body.page).toBe(2);
    expect(body.limit).toBe(10);
    expect(body.totalPages).toBe(2);
  });

  it("T5.6: should clamp page=0 to page=1", async () => {
    await createTestUserXP(prisma, "user-1", testGuildId, { xp: 50 });

    const res = await app.fetch(
      new Request(`/api/v1/xp/leaderboard/${testGuildId}?page=0`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(1); // clamped to 1
  });

  it("T5.7: should clamp limit=0 to limit=1", async () => {
    await createTestUserXP(prisma, "user-1", testGuildId, { xp: 50 });

    const res = await app.fetch(
      new Request(`/api/v1/xp/leaderboard/${testGuildId}?limit=0`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBe(1); // clamped to 1
  });

  it("T5.8: should clamp limit=999 to limit=100", async () => {
    await createTestUserXP(prisma, "user-1", testGuildId, { xp: 50 });

    const res = await app.fetch(
      new Request(`/api/v1/xp/leaderboard/${testGuildId}?limit=999`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBe(100); // clamped to 100
  });

  it("T5.9: should return 401 without API key", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/leaderboard/${testGuildId}`, {})
    );

    expect(res.status).toBe(401);
  });
});

describe("User XP API - GET", () => {
  const testGuildId = generateTestId("user-xp-get");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await prisma.guild.deleteMany({ where: { guildId: testGuildId } });
  });

  it("T6.1: should return user XP when it exists", async () => {
    await createTestUserXP(prisma, "user-123", testGuildId, {
      xp: 500,
      nivel: 10,
      username: "TestUser",
    });

    const res = await app.fetch(
      new Request(`/api/v1/xp/${testGuildId}/user-123`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("user-123");
    expect(body.guildId).toBe(testGuildId);
    expect(body.xp).toBe(500);
    expect(body.nivel).toBe(10);
    expect(body.username).toBe("TestUser");
  });

  it("T6.2: should return 404 when user XP does not exist", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/${testGuildId}/non-existent-user`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("User XP not found");
  });

  it("T6.3: should return 401 without API key", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/${testGuildId}/user-123`, {})
    );

    expect(res.status).toBe(401);
  });
});

describe("User XP API - Upsert POST /", () => {
  const testGuildId = generateTestId("user-xp-upsert");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await prisma.guild.deleteMany({ where: { guildId: testGuildId } });
  });

  it("T7.1: should upsert user XP - create new (username not in schema, stored as null)", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          userId: "new-user",
          guildId: testGuildId,
          username: "NewUser", // in body but NOT in UserXPSchema, so ignored
          xp: 100,
          nivel: 2,
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.userId).toBe("new-user");
    expect(body.xp).toBe(100);
    expect(body.nivel).toBe(2);
    // Note: username is not in UserXPSchema, so it defaults to null
    expect(body.username).toBe(null);
  });

  it("T7.2: should upsert user XP - update existing (username not in schema, stays unchanged)", async () => {
    await createTestUserXP(prisma, "existing-user", testGuildId, {
      xp: 100,
      nivel: 2,
      username: "OldName",
    });

    const res = await app.fetch(
      new Request("/api/v1/xp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          userId: "existing-user",
          guildId: testGuildId,
          username: "NewName", // included in body but not in UserXPSchema, so ignored
          xp: 200,
          nivel: 5,
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.userId).toBe("existing-user");
    expect(body.xp).toBe(200);
    expect(body.nivel).toBe(5);
    // Note: username is not in UserXPSchema, so it won't be updated (stays OldName)
    expect(body.username).toBe("OldName");
  });

  it("T7.3: should return 400 when userId is missing", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          xp: 100,
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("T7.4: should return 400 when guildId is missing", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          userId: "user-123",
          xp: 100,
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("T7.5: should allow missing username (upsert without username)", async () => {
    // Bug verification: username is optional in schema, upsert works without it
    const res = await app.fetch(
      new Request("/api/v1/xp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          userId: "user-no-name",
          guildId: testGuildId,
          xp: 50,
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.userId).toBe("user-no-name");
    // username may be undefined or null
    expect(body.xp).toBe(50);
  });

  it("T7.6: should return 400 for invalid xp type", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          userId: "user-123",
          guildId: testGuildId,
          xp: "not-a-number",
        }),
      })
    );

    expect(res.status).toBe(400);
  });
});

describe("XP Increment API", () => {
  const testGuildId = generateTestId("xp-increment");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await prisma.guild.deleteMany({ where: { guildId: testGuildId } });
  });

  it("T8.1: should increment XP atomically for existing user", async () => {
    await createTestUserXP(prisma, "user-inc", testGuildId, { xp: 100, nivel: 3 });

    const res = await app.fetch(
      new Request("/api/v1/xp/increment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          userId: "user-inc",
          guildId: testGuildId,
          username: "IncrementUser",
          xpIncrement: 25,
          nivel: 3,
          lastMessageAt: new Date().toISOString(),
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.userId).toBe("user-inc");
    expect(body.xp).toBe(125); // 100 + 25
    expect(body.nivel).toBe(3);
    expect(body.username).toBe("IncrementUser");
  });

  it("T8.2: should upsert on first increment (create if not exists)", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/increment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          userId: "brand-new-user",
          guildId: testGuildId,
          username: "NewIncrementUser",
          xpIncrement: 10,
          nivel: 1,
          lastMessageAt: new Date().toISOString(),
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.userId).toBe("brand-new-user");
    expect(body.xp).toBe(10); // first increment sets initial XP
    expect(body.nivel).toBe(1);
    expect(body.username).toBe("NewIncrementUser");
  });

  it("T8.3: should return 400 when required fields missing", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/increment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          userId: "user-123",
          guildId: testGuildId,
          // missing xpIncrement
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("T8.4: should return 400 for negative xpIncrement", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/increment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          userId: "user-123",
          guildId: testGuildId,
          username: "TestUser",
          xpIncrement: -10,
          nivel: 1,
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("T8.5: should return 400 for xpIncrement=0 (min 1)", async () => {
    // Bug verification: xpIncrement: 0 should return 400 per Zod min(1)
    const res = await app.fetch(
      new Request("/api/v1/xp/increment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          userId: "user-123",
          guildId: testGuildId,
          username: "TestUser",
          xpIncrement: 0,
          nivel: 1,
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("T8.6: should return 401 without API key", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/increment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "user-123",
          guildId: testGuildId,
          username: "TestUser",
          xpIncrement: 10,
          nivel: 1,
        }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("T8.7: should handle missing username in increment gracefully", async () => {
    await createTestUserXP(prisma, "user-no-name", testGuildId, { xp: 50, username: "OldName" });

    const res = await app.fetch(
      new Request("/api/v1/xp/increment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          userId: "user-no-name",
          guildId: testGuildId,
          xpIncrement: 20,
          nivel: 2,
          // username not provided - should keep existing or set undefined
          lastMessageAt: new Date().toISOString(),
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.xp).toBe(70); // 50 + 20
    // username may be undefined or original value
  });
});

describe("XP Config API - GET /config/:guildId", () => {
  const testGuildId = generateTestId("xp-config-get");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await prisma.guild.deleteMany({ where: { guildId: testGuildId } });
  });

  it("T9.1: should return 200 with config data when config exists", async () => {
    await createTestXPConfig(prisma, testGuildId, { xpPerMessage: 5 });

    const res = await app.fetch(
      new Request(`/api/v1/xp/config/${testGuildId}`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.guildId).toBe(testGuildId);
    expect(body.xpPerMessage).toBe(5);
    expect(body.enabled).toBe(true);
  });

  it("T9.2: should return 404 when no config exists", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/config/${testGuildId}`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("XP config not found");
  });

  it("T9.3: should return 401 without API key", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/config/${testGuildId}`, {})
    );

    expect(res.status).toBe(401);
  });
});

describe("XP Config API - POST /config", () => {
  const testGuildId = generateTestId("xp-config-post");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await prisma.guild.deleteMany({ where: { guildId: testGuildId } });
  });

  it("T10.1: should return 201 when creating valid config", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          xpPerMessage: 5,
          enabled: true,
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.guildId).toBe(testGuildId);
    expect(body.xpPerMessage).toBe(5);
    expect(body.enabled).toBe(true);
  });

  it("T10.2: should return 400 when guildId is missing", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          xpPerMessage: 5,
          enabled: true,
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("T10.3: should return 400 when xpPerMessage <= 0", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          xpPerMessage: 0,
          enabled: true,
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("T10.4: should return 400 when xpPerMessage is negative", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          xpPerMessage: -1,
          enabled: true,
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("T10.5: should return 401 without API key", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guildId: testGuildId,
          xpPerMessage: 5,
        }),
      })
    );

    expect(res.status).toBe(401);
  });
});

describe("XP Config API - PATCH /config/:guildId", () => {
  const testGuildId = generateTestId("xp-config-patch");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await prisma.guild.deleteMany({ where: { guildId: testGuildId } });
  });

  it("T11.1: should return 200 when updating existing config", async () => {
    await createTestXPConfig(prisma, testGuildId, { xpPerMessage: 1 });

    const res = await app.fetch(
      new Request(`/api/v1/xp/config/${testGuildId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          xpPerMessage: 10,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.xpPerMessage).toBe(10);
  });

  it("T11.2: should return 500 when config does not exist (P2025 bug)", async () => {
    // Known bug: PATCH on non-existent record throws Prisma error instead of graceful 404
    const res = await app.fetch(
      new Request(`/api/v1/xp/config/${testGuildId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          xpPerMessage: 10,
        }),
      })
    );

    expect(res.status).toBe(500);
  });

  it("T11.3: should return 401 without API key", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/config/${testGuildId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          xpPerMessage: 10,
        }),
      })
    );

    expect(res.status).toBe(401);
  });
});

describe("XP Config API - DELETE /config/:guildId", () => {
  const testGuildId = generateTestId("xp-config-delete");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await prisma.guild.deleteMany({ where: { guildId: testGuildId } });
  });

  it("T12.1: should return 200 when deleting existing config", async () => {
    await createTestXPConfig(prisma, testGuildId);

    const res = await app.fetch(
      new Request(`/api/v1/xp/config/${testGuildId}`, {
        method: "DELETE",
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
  });

  it("T12.2: should return 404 when config does not exist", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/config/${testGuildId}`, {
        method: "DELETE",
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("XP config not found");
  });

  it("T12.3: should return 401 without API key", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/config/${testGuildId}`, {
        method: "DELETE",
      })
    );

    expect(res.status).toBe(401);
  });
});

describe("Level Roles API - GET /level-roles/:guildId", () => {
  const testGuildId = generateTestId("level-roles-get");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await prisma.guild.deleteMany({ where: { guildId: testGuildId } });
  });

  it("T13.1: should return 200 with roles sorted by level asc", async () => {
    await createTestLevelRole(prisma, testGuildId, 10, "role-high");
    await createTestLevelRole(prisma, testGuildId, 1, "role-low");
    await createTestLevelRole(prisma, testGuildId, 5, "role-mid");

    const res = await app.fetch(
      new Request(`/api/v1/xp/level-roles/${testGuildId}`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(3);
    expect(body[0].level).toBe(1);
    expect(body[1].level).toBe(5);
    expect(body[2].level).toBe(10);
  });

  it("T13.2: should return 200 with empty array when no roles", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/level-roles/${testGuildId}`, {
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("T13.3: should return 401 without API key", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/level-roles/${testGuildId}`, {})
    );

    expect(res.status).toBe(401);
  });
});

describe("Level Roles API - POST /level-roles", () => {
  const testGuildId = generateTestId("level-roles-post");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await prisma.guild.deleteMany({ where: { guildId: testGuildId } });
  });

  it("T14.1: should return 201 when creating valid level role", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/level-roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          level: 10,
          roleId: "role-12345",
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.guildId).toBe(testGuildId);
    expect(body.level).toBe(10);
    expect(body.roleId).toBe("role-12345");
  });

  it("T14.2: should return 400 when required fields missing", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/level-roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          // missing level and roleId
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("T14.3: should return 400 when level = 0 (min 1)", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/level-roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          level: 0,
          roleId: "role-12345",
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("T14.4: should return 400 when level is negative", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/level-roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          level: -1,
          roleId: "role-12345",
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("T14.5: should handle duplicate level (unique constraint)", async () => {
    // Create first role
    await createTestLevelRole(prisma, testGuildId, 10, "role-first");

    // Try to create duplicate level
    const res = await app.fetch(
      new Request("/api/v1/xp/level-roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          level: 10,
          roleId: "role-second",
        }),
      })
    );

    // Unique constraint violation → 500 (no special handling for P2002 in create)
    expect(res.status).toBe(500);
  });

  it("T14.6: should return 401 without API key", async () => {
    const res = await app.fetch(
      new Request("/api/v1/xp/level-roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guildId: testGuildId,
          level: 10,
          roleId: "role-12345",
        }),
      })
    );

    expect(res.status).toBe(401);
  });
});

describe("Level Roles API - DELETE /level-roles/:guildId/:level", () => {
  const testGuildId = generateTestId("level-roles-delete");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupXPData(prisma, testGuildId);
    await prisma.guild.deleteMany({ where: { guildId: testGuildId } });
  });

  it("T15.1: should return 200 when deleting existing level role", async () => {
    await createTestLevelRole(prisma, testGuildId, 10, "role-123");

    const res = await app.fetch(
      new Request(`/api/v1/xp/level-roles/${testGuildId}/10`, {
        method: "DELETE",
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Level role deleted");
  });

  it("T15.2: should return 404 when level role does not exist", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/level-roles/${testGuildId}/999`, {
        method: "DELETE",
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Level role not found");
  });

it("T15.3: should return 500 for NaN level (Prisma validation error)", async () => {
    // NaN from parseInt("abc") → PrismaClientValidationError (missing required field)
    const res = await app.fetch(
      new Request(`/api/v1/xp/level-roles/${testGuildId}/abc`, {
        method: "DELETE",
        headers: { "X-API-Key": API_KEY },
      })
    );

    // NaN causes Prisma validation error (level field missing), not P2025
    expect(res.status).toBe(500);
  });

  it("T15.4: should return 401 without API key", async () => {
    const res = await app.fetch(
      new Request(`/api/v1/xp/level-roles/${testGuildId}/10`, {
        method: "DELETE",
      })
    );

    expect(res.status).toBe(401);
  });
});
