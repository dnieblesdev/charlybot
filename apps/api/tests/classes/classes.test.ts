import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../../src/index";
import { prisma } from "@charlybot/shared";
import { createTestGuild, createTestTipoClase, createTestClass, createTestSubclass, cleanupTestGuild, generateTestId } from "../helpers/factories";

const API_KEY = "charly_secret_key";

describe("Classes API - GET /guild/:guildId", () => {
  const testGuildId = generateTestId("guild-classes");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    // Create tipoClase
    await createTestTipoClase(prisma, testGuildId, "role-warrior", "Guerrero");
    // Create class
    await createTestClass(prisma, {
      guildId: testGuildId,
      rolId: "role-warrior",
      name: "Warrior",
      tipoId: "role-warrior",
    });
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T4.1: should return classes for guild", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/classes/guild/${testGuildId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { data: Array<{ name?: string; type?: string }> };
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0]!.type).toBe("Guerrero");
  });

  it("T4.1b: should return empty array when no classes", async () => {
    const noClassGuildId = generateTestId("guild-no-classes");
    await createTestGuild(prisma, noClassGuildId);

    const response = await app.fetch(
      new Request(`/api/v1/classes/guild/${noClassGuildId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { data: unknown[] };
    expect(data.data.length).toBe(0);

    await prisma.guild.deleteMany({ where: { guildId: noClassGuildId } });
  });
});

describe("Classes API - GET /guild/:guildId/:name", () => {
  const testGuildId = generateTestId("guild-classes");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    await createTestTipoClase(prisma, testGuildId, "role-mage", "Mago");
    await createTestClass(prisma, {
      guildId: testGuildId,
      rolId: "role-mage",
      name: "Mage",
      tipoId: "role-mage",
    });
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T4.2: should return specific class by name", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/classes/guild/${testGuildId}/Mage`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { name?: string; type?: string };
    expect(data.name).toBe("Mage");
    expect(data.type).toBe("Mago");
  });

  it("T4.2b: should return 404 for non-existent class", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/classes/guild/${testGuildId}/NonExistent`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(404);
  });
});

describe("Classes API - POST /", () => {
  const testGuildId = generateTestId("guild-classes");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T4.3: should create class with valid data", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/classes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          guildId: testGuildId,
          name: "Paladin",
          roleId: "role-paladin",
          type: "Tank",
          typeRoleId: "role-tank",
          subclasses: [
            { name: "Holy Knight", roleId: "role-holy" },
            { name: "Dark Knight", roleId: "role-dark" },
          ],
        }),
      })
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as { message?: string };
    expect(data.message).toBe("Class updated successfully");
  });

  it("T4.3b: should reject invalid class data", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/classes`, {
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

describe("Classes API - DELETE /guild/:guildId/:name", () => {
  const testGuildId = generateTestId("guild-classes");

  beforeEach(async () => {
    await createTestGuild(prisma, testGuildId);
    await createTestTipoClase(prisma, testGuildId, "role-rogue", "Asesino");
    await createTestClass(prisma, {
      guildId: testGuildId,
      rolId: "role-rogue",
      name: "Rogue",
      tipoId: "role-rogue",
    });
  });

  afterEach(async () => {
    await cleanupTestGuild(prisma, testGuildId);
  });

  it("T4.4: should delete class by name", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/classes/guild/${testGuildId}/Rogue`, {
        method: "DELETE",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { message?: string };
    expect(data.message).toBe("Class deleted");
  });

  it("T4.4b: should return 404 when class doesn't exist", async () => {
    const response = await app.fetch(
      new Request(`/api/v1/classes/guild/${testGuildId}/NonExistent`, {
        method: "DELETE",
        headers: {
          "X-API-Key": API_KEY,
        },
      })
    );

    expect(response.status).toBe(404);
  });
});
