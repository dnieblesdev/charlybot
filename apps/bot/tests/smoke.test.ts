import { describe, it, expect, vi } from "vitest";
import { createMockChatInputCommandInteraction } from "../src/__mocks__/discord";
import { createMockEconomyRepo, DEFAULT_MOCK_USER } from "../src/__mocks__/repo";

describe("Smoke Tests", () => {
  describe("Vitest environment", () => {
    it("should run a basic test", () => {
      // Real assertion: vitest is configured and running
      const result = [1, 2, 3].filter(n => n > 0);
      expect(result).toHaveLength(3);
    });

    it("should support describe/it/expect from vitest", () => {
      const result = 1 + 2;
      expect(result).toBe(3);
    });

    it("should have vi.fn() available", () => {
      const spy = vi.fn(() => "called");
      expect(spy()).toBe("called");
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("Discord mock factory", () => {
    it("should create a mock interaction with defaults", () => {
      const interaction = createMockChatInputCommandInteraction();
      expect(interaction.user.id).toBe("user-123");
      expect(interaction.guildId).toBe("guild-456");
      expect(interaction.deferred).toBe(false);
    });

    it("should allow overriding userId and guildId", () => {
      const interaction = createMockChatInputCommandInteraction({
        userId: "my-user",
        guildId: "my-guild",
      });
      expect(interaction.user.id).toBe("my-user");
      expect(interaction.guildId).toBe("my-guild");
    });

    it("should allow overriding options", () => {
      const interaction = createMockChatInputCommandInteraction({
        options: {
          subcommand: "balance",
          stringOption: "test-string",
          integerOption: 42,
          userOption: { id: "target-user", username: "TargetUser", bot: false },
        },
      });
      expect(interaction.options.getSubcommand()).toBe("balance");
      expect(interaction.options.getString()).toBe("test-string");
      expect(interaction.options.getInteger()).toBe(42);
    });

    it("should have functional reply/editReply/deferReply", async () => {
      const interaction = createMockChatInputCommandInteraction();
      await interaction.reply({ content: "test" });
      await interaction.editReply({ content: "edited" });
      await interaction.deferReply();

      expect(interaction.reply).toHaveBeenCalledWith({ content: "test" });
      expect(interaction.editReply).toHaveBeenCalledWith({ content: "edited" });
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.deferred).toBe(true);
    });
  });

  describe("EconomyRepo mock factory", () => {
    it("should create a mock repo with default null returns", async () => {
      const repo = createMockEconomyRepo();
      const user = await repo.getEconomyUser("guild-1", "user-1");
      expect(user).toBeNull();
    });

    it("should return default user for createEconomyUser", async () => {
      const repo = createMockEconomyRepo();
      const user = await repo.createEconomyUser("guild-1", {
        userId: "user-1",
        username: "TestUser",
      });
      expect(user.userId).toBe("user-1");
      expect(user.guildId).toBe("guild-1");
      expect(user.pocket).toBe(1000);
    });

    it("should allow overriding specific functions", async () => {
      const mockUser = { ...DEFAULT_MOCK_USER, userId: "overridden", pocket: 5000 };
      const repo = createMockEconomyRepo({
        getEconomyUser: vi.fn(() => Promise.resolve(mockUser)),
      });
      const user = await repo.getEconomyUser("guild-1", "overridden");
      expect(user?.pocket).toBe(5000);
    });

    it("should have all EconomyRepo functions as spies", () => {
      const repo = createMockEconomyRepo();
      expect(typeof repo.getEconomyUser).toBe("function");
      expect(typeof repo.createEconomyUser).toBe("function");
      expect(typeof repo.updateEconomyUser).toBe("function");
      expect(typeof repo.getGlobalBank).toBe("function");
      expect(typeof repo.createGlobalBank).toBe("function");
      expect(typeof repo.updateGlobalBank).toBe("function");
      expect(typeof repo.getEconomyConfig).toBe("function");
      expect(typeof repo.createEconomyConfig).toBe("function");
      expect(typeof repo.updateEconomyConfig).toBe("function");
      expect(typeof repo.getLeaderboard).toBe("function");
      expect(typeof repo.getLeaderboardEntry).toBe("function");
      expect(typeof repo.upsertLeaderboard).toBe("function");
      expect(typeof repo.getUserPosition).toBe("function");
      expect(typeof repo.removeFromLeaderboard).toBe("function");
      expect(typeof repo.createRouletteGame).toBe("function");
      expect(typeof repo.getActiveRouletteGame).toBe("function");
      expect(typeof repo.getRouletteGame).toBe("function");
      expect(typeof repo.updateRouletteGame).toBe("function");
      expect(typeof repo.deleteRouletteGame).toBe("function");
      expect(typeof repo.placeRouletteBet).toBe("function");
      expect(typeof repo.updateRouletteBet).toBe("function");
      expect(typeof repo.atomicTransfer).toBe("function");
      expect(typeof repo.atomicDeposit).toBe("function");
      expect(typeof repo.atomicWithdraw).toBe("function");
      expect(typeof repo.atomicAddPocket).toBe("function");
      expect(typeof repo.atomicSubtractPocket).toBe("function");
      expect(typeof repo.atomicClaimCooldown).toBe("function");
      expect(typeof repo.atomicPlaceBet).toBe("function");
      expect(typeof repo.atomicProcessRouletteResults).toBe("function");
      expect(typeof repo.atomicCancelRouletteGame).toBe("function");
    });
  });

  describe("Module imports", () => {
    it("should import @charlybot/shared without error", async () => {
      // This import is exercised by the global mock setup — verify it resolves
      const { prisma } = await import("@charlybot/shared");
      // Verify prisma mock is available (either from vitest mock or real client)
      // The key is that the module loads without error; behavior is tested elsewhere
      expect(prisma).toBeDefined();
    });

    it("should import discord.js types without error", async () => {
      const { MessageFlags } = await import("discord.js");
      // Verify MessageFlags is a real flags object (has a Flags property)
      expect(typeof MessageFlags).toBe("object");
      expect(MessageFlags).toHaveProperty("Ephemeral");
    });
  });
});
