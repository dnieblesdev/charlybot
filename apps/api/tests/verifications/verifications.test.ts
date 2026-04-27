import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../../src/index";
import { prisma } from "@charlybot/shared";
import { createTestGuild, cleanupTestGuild, createTestVerification, generateTestId } from "../helpers/factories";

const API_KEY = "charly_secret_key";

describe("Verifications API - POST /", () => {
  const testGuildId = generateTestId("guild-verif");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T2.1: should create verification with valid data", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/verifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          userId: generateTestId("user"),
          inGameName: "TestPlayer",
          screenshotUrl: "https://example.com/screenshot.png",
        }),
      })
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as { guildId?: string; inGameName?: string; status?: string };
    expect(data.guildId).toBe(testGuildId);
    expect(data.inGameName).toBe("TestPlayer");
    expect(data.status).toBe("pending");
  });

  it("T2.1b: should reject invalid verification data", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/verifications`, {
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

describe("Verifications API - GET /pending/:guildId", () => {
  const testGuildId = generateTestId("guild-verif");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    // Create pending verifications
    await createTestVerification(prisma, {
      guildId: testGuildId,
      userId: generateTestId("user1"),
      inGameName: "Player1",
      screenshotUrl: "https://example.com/screen1.png",
      status: "pending",
    });
    await createTestVerification(prisma, {
      guildId: testGuildId,
      userId: generateTestId("user2"),
      inGameName: "Player2",
      screenshotUrl: "https://example.com/screen2.png",
      status: "pending",
    });
    // Create approved verification (should not appear)
    await createTestVerification(prisma, {
      guildId: testGuildId,
      userId: generateTestId("user3"),
      inGameName: "Player3",
      screenshotUrl: "https://example.com/screen3.png",
      status: "approved",
    });
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T2.2: should return only pending verifications for a guild", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/verifications/pending/${testGuildId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { data: Array<{ status?: string; inGameName?: string }> };
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBe(2); // Only pending
    expect(data.data.every(v => v.status === "pending")).toBe(true);
  });

  it("T2.2b: should return empty array when no pending verifications", async () => {
    const newGuildId = generateTestId("guild-empty");
    await createTestGuild(prisma, newGuildId);

    const response = await app.fetch(
      new Request(`/api/v1/verifications/pending/${newGuildId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { data: unknown[] };
    expect(data.data.length).toBe(0);

    await prisma.guild.deleteMany({ where: { guildId: newGuildId } });
  });
});

describe("Verifications API - GET /:id", () => {
  const testGuildId = generateTestId("guild-verif");
  let testVerifId: string;

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    const verif = await createTestVerification(prisma, {
      guildId: testGuildId,
      userId: generateTestId("user"),
      inGameName: "TestPlayer",
      screenshotUrl: "https://example.com/screen.png",
      status: "pending",
    });
    testVerifId = verif.id;
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T2.2c: should return verification by id", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/verifications/${testVerifId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { id?: string; inGameName?: string; status?: string };
    expect(data.id).toBe(testVerifId);
    expect(data.inGameName).toBe("TestPlayer");
    expect(data.status).toBe("pending");
  });

  it("T2.2d: should return 404 for non-existent verification", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/verifications/non-existent-id`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(404);
  });
});

describe("Verifications API - PATCH /:id", () => {
  const testGuildId = generateTestId("guild-verif");
  let testVerifId: string;

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    const verif = await createTestVerification(prisma, {
      guildId: testGuildId,
      userId: generateTestId("user"),
      inGameName: "TestPlayer",
      screenshotUrl: "https://example.com/screen.png",
      status: "pending",
    });
    testVerifId = verif.id;
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T2.3: should approve verification", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/verifications/${testVerifId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          status: "approved",
          reviewedBy: "admin-user",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { status?: string; reviewedBy?: string };
    expect(data.status).toBe("approved");
    expect(data.reviewedBy).toBe("admin-user");
  });

  it("T2.4: should reject verification", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/verifications/${testVerifId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          status: "rejected",
          reviewedBy: "admin-user",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { status?: string };
    expect(data.status).toBe("rejected");
  });
});

describe("Verifications API - DELETE /:id", () => {
  const testGuildId = generateTestId("guild-verif");
  let testVerifId: string;

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    const verif = await createTestVerification(prisma, {
      guildId: testGuildId,
      userId: generateTestId("user"),
      inGameName: "TestPlayer",
      screenshotUrl: "https://example.com/screen.png",
      status: "pending",
    });
    testVerifId = verif.id;
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T2.5: should delete verification", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/verifications/${testVerifId}`, {
        method: "DELETE",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);

    // Verify it's deleted
    const getResponse = await app.fetch(
      new Request(`/api/v1/verifications/${testVerifId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );
    expect(getResponse.status).toBe(404);
  });
});
