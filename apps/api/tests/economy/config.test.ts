import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@charlybot/shared";
import { createTestEconomyConfig, cleanupEconomyData, API_KEY, TEST_GUILD, generateTestId } from "./setup";
import app from "../../src/index";

describe("GET /api/v1/economy/config/:guildId", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    // Config is created in beforeEach
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S4.1: should return config when config exists", async () => {
    // Setup: create config
    await createTestEconomyConfig(TEST_GUILD.ID, { startingMoney: 2000 });

    // Act: GET config
    const res = await app.fetch(
      new Request(`/api/v1/economy/config/${TEST_GUILD.ID}`, {
        method: "GET",
        headers: { "X-API-Key": API_KEY_VALID },
      })
    );

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json() as { guildId?: string; startingMoney?: number };
    expect(body.guildId).toBe(TEST_GUILD.ID);
    expect(body.startingMoney).toBe(2000);
  });

  it("S4.2: should return 404 when config does not exist", async () => {
    const nonExistentGuildId = generateTestId("non-existent-guild");

    // Act: GET non-existent config
    const res = await app.fetch(
      new Request(`/api/v1/economy/config/${nonExistentGuildId}`, {
        method: "GET",
        headers: { "X-API-Key": API_KEY_VALID },
      })
    );

    // Assert
    expect(res.status).toBe(404);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("Economy config not found");
  });
});

describe("POST /api/v1/economy/config", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    // Config is created in beforeEach
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S4.3: should create new economy config", async () => {
    const newGuildId = generateTestId("new-guild-config");

    // Act: POST new config
    const res = await app.fetch(
      new Request("/api/v1/economy/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          guildId: newGuildId,
          startingMoney: 1500,
        }),
      })
    );

    // Assert
    expect(res.status).toBe(201);
    const body = await res.json() as { guildId?: string; startingMoney?: number };
    expect(body.guildId).toBe(newGuildId);
    expect(body.startingMoney).toBe(1500);

    // Cleanup
    await prisma.economyConfig.deleteMany({ where: { guildId: newGuildId } });
  });

  it("S4.4: should return 400 when required fields are missing", async () => {
    // Act: POST without guildId
    const res = await app.fetch(
      new Request("/api/v1/economy/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          startingMoney: 1500,
        }),
      })
    );

    // Assert
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/economy/config/:guildId", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    // Config is created in beforeEach
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S4.5: should update config when config exists", async () => {
    // Setup: create config
    await createTestEconomyConfig(TEST_GUILD.ID, { startingMoney: 1000 });

    // Act: PATCH config with new startingMoney
    const res = await app.fetch(
      new Request(`/api/v1/economy/config/${TEST_GUILD.ID}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          startingMoney: 2500,
        }),
      })
    );

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json() as { startingMoney?: number };
    expect(body.startingMoney).toBe(2500);
  });

  it("S4.6: should return 500 when updating non-existent config", async () => {
    const nonExistentGuildId = generateTestId("non-existent-config-patch");

    // Act: PATCH non-existent config
    const res = await app.fetch(
      new Request(`/api/v1/economy/config/${nonExistentGuildId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          startingMoney: 1500,
        }),
      })
    );

    // Assert: route returns 500 on Prisma not-found error
    expect(res.status).toBe(500);
  });
});

describe("Config API - Authentication", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    // Config is created in beforeEach
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S7.6: should return 401 when no API key is provided for GET", async () => {
    // Act: GET without X-API-Key header
    const res = await app.fetch(
      new Request(`/api/v1/economy/config/${TEST_GUILD.ID}`, {
        method: "GET",
      })
    );

    // Assert
    expect(res.status).toBe(401);
  });
});