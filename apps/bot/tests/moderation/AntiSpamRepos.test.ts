import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@charlybot/shared";
import {
  getByGuildId,
  getCachedByGuildId,
  create,
  invalidate,
  update,
} from "../../src/config/repositories/AntiSpamConfigRepo";
import {
  create as createHistory,
  countRecentByUser,
  getRecentByUser,
} from "../../src/config/repositories/AntiSpamHistoryRepo";

describe("AntiSpamRepos", () => {
  const prismaMock = prisma as unknown as {
    antiSpamConfig: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
  };

  const baseConfig = {
    id: 1,
    guildId: "guild-1",
    enabled: true,
    burstEnabled: true,
    duplicateEnabled: true,
    mentionEnabled: true,
    linkEnabled: true,
    capsEnabled: true,
    emojiEnabled: false,
    comboEnabled: false,
    burstAction: "warn",
    duplicateAction: "warn",
    mentionAction: "timeout_5min",
    linkAction: "timeout_5min",
    capsAction: "warn",
    emojiAction: "warn",
    comboAction: "timeout_5min",
    escalationEnabled: true,
    escalationCount: 3,
    notifyOnSpam: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    invalidate("guild-1");
  });

  describe("AntiSpamConfigRepo", () => {
    describe("getCachedByGuildId", () => {
      it("reuses the warm cache without hitting Prisma again", async () => {
        prismaMock.antiSpamConfig.findUnique.mockResolvedValue(baseConfig);

        const first = await getCachedByGuildId("guild-1");
        const second = await getCachedByGuildId("guild-1");

        expect(first?.guildId).toBe("guild-1");
        expect(second?.guildId).toBe("guild-1");
        expect(prismaMock.antiSpamConfig.findUnique).toHaveBeenCalledTimes(1);
      });
    });

    describe("create", () => {
      it("should throw if guildId is missing", async () => {
        await expect(create({})).rejects.toThrow("guildId is required");
      });
    });

    describe("update", () => {
      it("refreshes the cache after a config write", async () => {
        prismaMock.antiSpamConfig.findUnique.mockResolvedValue(baseConfig);
        prismaMock.antiSpamConfig.upsert.mockResolvedValue({
          ...baseConfig,
          enabled: false,
        });

        await getCachedByGuildId("guild-1");
        await update("guild-1", { enabled: false });
        const refreshed = await getCachedByGuildId("guild-1");

        expect(refreshed?.enabled).toBe(false);
        expect(prismaMock.antiSpamConfig.findUnique).toHaveBeenCalledTimes(1);
      });

      it("can force a reload after explicit invalidation", async () => {
        prismaMock.antiSpamConfig.findUnique
          .mockResolvedValueOnce(baseConfig)
          .mockResolvedValueOnce({ ...baseConfig, enabled: false });

        const first = await getCachedByGuildId("guild-1");
        invalidate("guild-1");
        const second = await getByGuildId("guild-1");

        expect(first?.enabled).toBe(true);
        expect(second?.enabled).toBe(false);
        expect(prismaMock.antiSpamConfig.findUnique).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("AntiSpamHistoryRepo", () => {
    describe("create", () => {
      it("should be a function", () => {
        expect(typeof createHistory).toBe("function");
      });
    });

    describe("countRecentByUser", () => {
      it("should be a function", () => {
        expect(typeof countRecentByUser).toBe("function");
      });
    });

    describe("getRecentByUser", () => {
      it("should be a function", () => {
        expect(typeof getRecentByUser).toBe("function");
      });
    });
  });
});
