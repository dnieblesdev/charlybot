import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../../src/index";
import { prisma } from "@charlybot/shared";
import { createTestGuild, createTestGuildConfig, cleanupTestGuild, generateTestId, TEST_GUILD_ID } from "../helpers/factories";

const API_KEY = "charly_secret_key";

describe("Guilds API - PATCH /:id", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await prisma.guild.deleteMany({ where: { guildId: testGuildId } });
  });

  it("T1.1: should update guild metadata with valid payload", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/guilds/${testGuildId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          name: "Updated Guild Name",
          ownerId: "owner-123",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { name?: string; ownerId?: string; guildId?: string };
    expect(data.name).toBe("Updated Guild Name");
    expect(data.ownerId).toBe("owner-123");
  });

  it("T1.2: should create guild if it doesn't exist", async () => {
    const newGuildId = generateTestId("new-guild");

    const response = await app.fetch(
      new Request(`/api/v1/guilds/${newGuildId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          name: "New Guild",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; name?: string };
    expect(data.guildId).toBe(newGuildId);
    expect(data.name).toBe("New Guild");

    // Cleanup
    await prisma.guild.deleteMany({ where: { guildId: newGuildId } });
  });
});

describe("Guilds API - GET /:id/config", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    await createTestGuildConfig(prisma, testGuildId, {
      welcomeChannelId: "channel-123",
      welcomeMessage: "Welcome!",
    });
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T1.2: should return guild config when it exists", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/guilds/${testGuildId}/config`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; welcomeChannelId?: string; welcomeMessage?: string };
    expect(data.guildId).toBe(testGuildId);
    expect(data.welcomeChannelId).toBe("channel-123");
    expect(data.welcomeMessage).toBe("Welcome!");
  });

  it("T1.2c: should return persisted messageLogChannelId", async () => {
    // First set messageLogChannelId via PATCH
    await app.fetch(
      new Request(`/api/v1/guilds/${testGuildId}/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          messageLogChannelId: "123456789",
        }),
      })
    );

    // Then retrieve and verify via GET
    const response = await app.fetch(
      new Request(`/api/v1/guilds/${testGuildId}/config`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; messageLogChannelId?: string };
    expect(data.messageLogChannelId).toBe("123456789");
  });

  it("T1.2b: should return 404 when config doesn't exist", async () => {
    const noConfigGuildId = generateTestId("guild-no-config");
    await createTestGuild(prisma, noConfigGuildId);

    const response = await app.fetch(
      new Request(`/api/v1/guilds/${noConfigGuildId}/config`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(404);
    const data = (await response.json()) as { error?: string };
    expect(data.error).toBe("Guild configuration not found");

    // Cleanup
    await prisma.guild.deleteMany({ where: { guildId: noConfigGuildId } });
  });
});

describe("Guilds API - PATCH /:id/config", () => {
  const testGuildId = generateTestId("guild");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T1.3: should update guild config with valid payload", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/guilds/${testGuildId}/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          welcomeChannelId: "welcome-channel-456",
          welcomeMessage: "Hello {user}!",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; welcomeChannelId?: string; welcomeMessage?: string };
    expect(data.guildId).toBe(testGuildId);
    expect(data.welcomeChannelId).toBe("welcome-channel-456");
    expect(data.welcomeMessage).toBe("Hello {user}!");
  });

  it("T1.3b: should create config if it doesn't exist", async () => {
    const newGuildId = generateTestId("guild-new");
    await createTestGuild(prisma, newGuildId);

    const response = await app.fetch(
      new Request(`/api/v1/guilds/${newGuildId}/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          verificationChannelId: "verif-channel",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; verificationChannelId?: string };
    expect(data.guildId).toBe(newGuildId);
    expect(data.verificationChannelId).toBe("verif-channel");

    // Cleanup
    await cleanupTestGuild(prisma, newGuildId);
  });

  it("T1.3d: should persist messageLogChannelId via PATCH", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/guilds/${testGuildId}/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          messageLogChannelId: "123456789",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; messageLogChannelId?: string };
    expect(data.guildId).toBe(testGuildId);
    expect(data.messageLogChannelId).toBe("123456789");
  });

  it("T1.3c: should reject invalid payload", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/guilds/${testGuildId}/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          // Invalid: non-existent field
          invalidField: "test",
        }),
      })
    );

    // Zod validator should reject invalid fields
    expect(response.status).toBe(400);
  });
});

describe("Guilds API - Authentication", () => {
  it("should return 401 without API key", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/guilds/test/config`, {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
  });

  it("should return 401 with invalid API key", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/guilds/test/config`, {
        method: "GET",
        headers: {
          "X-API-Key": "invalid-key",
        },
      })
    );

    expect(response.status).toBe(401);
  });
});
