import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../../src/index";
import { prisma } from "@charlybot/shared";
import { createTestGuild, createTestMusicQueue, createTestMusicQueueItem, createTestMusicConfig, cleanupTestGuild, generateTestId } from "../helpers/factories";

const API_KEY = "charly_secret_key";

describe("Music API - GET /queues/:guildId", () => {
  const testGuildId = generateTestId("guild-music");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    await createTestMusicQueue(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T3.1: should return music queue for guild", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/music/queues/${testGuildId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; items?: unknown[] };
    expect(data.guildId).toBe(testGuildId);
    expect(Array.isArray(data.items)).toBe(true);
  });

  it("T3.1b: should return 404 when queue doesn't exist", async () => {
    const noQueueGuildId = generateTestId("guild-no-queue");
    await createTestGuild(prisma, noQueueGuildId);

    const response = await app.fetch(
      new Request(`/api/v1/music/queues/${noQueueGuildId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(404);

    await prisma.guild.deleteMany({ where: { guildId: noQueueGuildId } });
  });
});

describe("Music API - POST /queues/:guildId/items", () => {
  const testGuildId = generateTestId("guild-music");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    await createTestMusicQueue(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T3.2: should add item to queue", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/music/queues/${testGuildId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          title: "Test Song",
          url: "https://youtube.com/watch?v=test",
          duration: 180,
          requesterId: "user-123",
          requesterName: "TestUser",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { title?: string; url?: string; position?: number };
    expect(data.title).toBe("Test Song");
    expect(data.url).toBe("https://youtube.com/watch?v=test");
    expect(data.position).toBe(0);
  });

  it("T3.2b: should reject invalid item data", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/music/queues/${testGuildId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          // Missing required fields
          title: "Test",
        }),
      })
    );

    expect(response.status).toBe(400);
  });
});

describe("Music API - DELETE /queues/:guildId/items/:position", () => {
  const testGuildId = generateTestId("guild-music");
  let queueId: string;

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    const queue = await createTestMusicQueue(prisma, testGuildId);
    queueId = queue.id;
    await createTestMusicQueueItem(prisma, queueId, {
      title: "Song 1",
      url: "https://youtube.com/watch?v=1",
      duration: 180,
      position: 0,
      requesterId: "user-1",
      requesterName: "User1",
    });
    await createTestMusicQueueItem(prisma, queueId, {
      title: "Song 2",
      url: "https://youtube.com/watch?v=2",
      duration: 240,
      position: 1,
      requesterId: "user-2",
      requesterName: "User2",
    });
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T3.3: should remove item from queue by position", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/music/queues/${testGuildId}/items/0`, {
        method: "DELETE",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { success?: boolean };
    expect(data.success).toBe(true);
  });

  it("T3.3b: should return 404 for invalid position", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/music/queues/${testGuildId}/items/999`, {
        method: "DELETE",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(404);
  });
});

describe("Music API - DELETE /queues/:guildId/items (clear queue)", () => {
  const testGuildId = generateTestId("guild-music");
  let queueId: string;

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    const queue = await createTestMusicQueue(prisma, testGuildId);
    queueId = queue.id;
    await createTestMusicQueueItem(prisma, queueId, {
      title: "Song 1",
      url: "https://youtube.com/watch?v=1",
      duration: 180,
      position: 0,
      requesterId: "user-1",
      requesterName: "User1",
    });
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T3.4: should clear all items from queue", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/music/queues/${testGuildId}/items`, {
        method: "DELETE",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { success?: boolean };
    expect(data.success).toBe(true);

    // Verify queue is empty
    const queue = await prisma.musicQueue.findUnique({ where: { guildId: testGuildId } });
    const itemCount = await prisma.musicQueueItem.count({ where: { queueId: queue!.id } });
    expect(itemCount).toBe(0);
  });
});

describe("Music API - PUT /queues/:guildId/settings", () => {
  const testGuildId = generateTestId("guild-music");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T3.5: should update queue settings", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/music/queues/${testGuildId}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          volume: 75,
          isPaused: true,
          loopMode: "queue",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { volume?: number; isPaused?: boolean; loopMode?: string };
    expect(data.volume).toBe(75);
    expect(data.isPaused).toBe(true);
    expect(data.loopMode).toBe("queue");
  });
});

describe("Music API - GET /config/:guildId", () => {
  const testGuildId = generateTestId("guild-music");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    await createTestMusicConfig(prisma, testGuildId, {
      defaultVolume: 60,
      autoCleanup: true,
      maxQueueSize: 200,
    });
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T3.6: should return music config", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/music/config/${testGuildId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; defaultVolume?: number };
    expect(data.guildId).toBe(testGuildId);
    expect(data.defaultVolume).toBe(60);
  });

  it("T3.6b: should return 404 when config doesn't exist", async () => {
    const noConfigGuildId = generateTestId("guild-no-config");
    await createTestGuild(prisma, noConfigGuildId);

    const response = await app.fetch(
      new Request(`/api/v1/music/config/${noConfigGuildId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(404);

    await prisma.guild.deleteMany({ where: { guildId: noConfigGuildId } });
  });
});

describe("Music API - PUT /config/:guildId", () => {
  const testGuildId = generateTestId("guild-music");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T3.7: should create/update music config", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/music/config/${testGuildId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          defaultVolume: 80,
          maxQueueSize: 300,
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { guildId?: string; defaultVolume?: number; maxQueueSize?: number };
    expect(data.guildId).toBe(testGuildId);
    expect(data.defaultVolume).toBe(80);
    expect(data.maxQueueSize).toBe(300);
  });
});
