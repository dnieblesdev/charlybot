import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../../src/index";
import { prisma } from "@charlybot/shared";
import { createTestGuild, createTestAutorole, cleanupTestGuild, generateTestId } from "../helpers/factories";

const API_KEY = "charly_secret_key";

describe("Autoroles API - GET /guild/:guildId", () => {
  const testGuildId = generateTestId("guild-autorole");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    await createTestAutorole(prisma, {
      guildId: testGuildId,
      messageId: "msg-123",
      channelId: "channel-123",
      createdBy: "admin",
      mode: "multiple",
      mappings: [
        { roleId: "role-1", type: "reaction", order: 1, emoji: "1️⃣" },
        { roleId: "role-2", type: "reaction", order: 2, emoji: "2️⃣" },
      ],
    });
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T5.1: should return autoroles for guild", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles/guild/${testGuildId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Array<{ guildId?: string; messageId?: string; mappings?: unknown[] }>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]!.messageId).toBe("msg-123");
    expect(data[0]!.mappings).toHaveLength(2);
  });

  it("T5.1b: should return empty array when no autoroles", async () => {
    const noAutoroleGuildId = generateTestId("guild-no-autorole");
    await createTestGuild(prisma, noAutoroleGuildId);

    const response = await app.fetch(
      new Request(`/api/v1/autoroles/guild/${noAutoroleGuildId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as unknown[];
    expect(data.length).toBe(0);

    await prisma.guild.deleteMany({ where: { guildId: noAutoroleGuildId } });
  });
});

describe("Autoroles API - GET /message/:guildId/:messageId", () => {
  const testGuildId = generateTestId("guild-autorole");
  let autoroleId: number;

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    const autorole = await createTestAutorole(prisma, {
      guildId: testGuildId,
      messageId: "msg-specific",
      channelId: "channel-123",
      createdBy: "admin",
      mode: "unique",
    });
    autoroleId = autorole.id;
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T5.2: should return autorole by messageId", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles/message/${testGuildId}/msg-specific`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; messageId?: string };
    expect(data.messageId).toBe("msg-specific");
  });

  it("T5.2b: should return 404 for non-existent messageId", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles/message/${testGuildId}/non-existent`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(404);
  });
});

describe("Autoroles API - POST /", () => {
  const testGuildId = generateTestId("guild-autorole");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T5.3: should create autorole with valid data", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          messageId: "msg-new",
          channelId: "channel-new",
          createdBy: "admin",
          mode: "multiple",
          mappings: [
            { roleId: "role-a", type: "reaction", order: 1, emoji: "a" },
            { roleId: "role-b", type: "button", order: 2, buttonLabel: "Button", buttonStyle: "primary" },
          ],
        }),
      })
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as { guildId?: string; messageId?: string; mappings?: unknown[] };
    expect(data.messageId).toBe("msg-new");
    expect(data.mappings).toHaveLength(2);
  });

  it("T5.3b: should reject invalid autorole data", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          // Missing required fields
          guildId: testGuildId,
        }),
      })
    );

    expect(response.status).toBe(400);
  });
});

describe("Autoroles API - PATCH /:id", () => {
  const testGuildId = generateTestId("guild-autorole");
  let autoroleId: number;

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    const autorole = await createTestAutorole(prisma, {
      guildId: testGuildId,
      messageId: "msg-patch",
      channelId: "channel-old",
      createdBy: "admin",
      mode: "multiple",
    });
    autoroleId = autorole.id;
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T5.4: should update autorole", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles/${autoroleId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          channelId: "channel-updated",
          mode: "unique",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { channelId?: string; mode?: string };
    expect(data.channelId).toBe("channel-updated");
    expect(data.mode).toBe("unique");
  });
});

describe("Autoroles API - DELETE /:id", () => {
  const testGuildId = generateTestId("guild-autorole");
  let autoroleId: number;

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    const autorole = await createTestAutorole(prisma, {
      guildId: testGuildId,
      messageId: "msg-delete",
      channelId: "channel-123",
      createdBy: "admin",
      mode: "multiple",
    });
    autoroleId = autorole.id;
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T5.5: should delete autorole", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles/${autoroleId}`, {
        method: "DELETE",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);

    // Verify it's deleted
    const getResponse = await app.fetch(
      new Request(`/api/v1/autoroles/message/${testGuildId}/msg-delete`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );
    expect(getResponse.status).toBe(404);
  });
});

describe("Autoroles API - POST /:id/mappings", () => {
  const testGuildId = generateTestId("guild-autorole");
  let autoroleId: number;

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    const autorole = await createTestAutorole(prisma, {
      guildId: testGuildId,
      messageId: "msg-mapping",
      channelId: "channel-123",
      createdBy: "admin",
      mode: "multiple",
    });
    autoroleId = autorole.id;
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T5.6: should add mapping to autorole", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles/${autoroleId}/mappings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          roleId: "new-role",
          type: "reaction",
          order: 1,
          emoji: "⭐",
        }),
      })
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as { roleId?: string; type?: string };
    expect(data.roleId).toBe("new-role");
    expect(data.type).toBe("reaction");
  });
});

describe("Autoroles API - PATCH /mappings/:mappingId", () => {
  const testGuildId = generateTestId("guild-autorole");
  let autoroleId: number;
  let mappingId: number;

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    const autorole = await createTestAutorole(prisma, {
      guildId: testGuildId,
      messageId: "msg-patch-mapping",
      channelId: "channel-123",
      createdBy: "admin",
      mode: "multiple",
      mappings: [
        { roleId: "role-to-patch", type: "reaction", order: 1 },
      ],
    });
    autoroleId = autorole.id;
    mappingId = autorole.mappings[0]!.id;
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T5.7: should update mapping", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles/mappings/${mappingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          order: 5,
          emoji: "🔥",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { order?: number; emoji?: string };
    expect(data.order).toBe(5);
    expect(data.emoji).toBe("🔥");
  });
});

describe("Autoroles API - DELETE /mappings/:mappingId", () => {
  const testGuildId = generateTestId("guild-autorole");
  let autoroleId: number;
  let mappingId: number;

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    const autorole = await createTestAutorole(prisma, {
      guildId: testGuildId,
      messageId: "msg-delete-mapping",
      channelId: "channel-123",
      createdBy: "admin",
      mode: "multiple",
      mappings: [
        { roleId: "role-to-delete", type: "reaction", order: 1 },
      ],
    });
    autoroleId = autorole.id;
    mappingId = autorole.mappings[0]!.id;
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T5.8: should delete mapping", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/autoroles/mappings/${mappingId}`, {
        method: "DELETE",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
  });
});
