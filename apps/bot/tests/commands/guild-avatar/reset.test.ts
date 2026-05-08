import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";
import { createMockChatInputCommandInteraction } from "../../../src/__mocks__/discord.js";

const mockEditMe = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockReply = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockDeferReply = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockEditReply = vi.hoisted(() => vi.fn<() => Promise<void>>());

vi.mock("../../../src/utils/logger.js", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock discord.js to control which error types are recognized
vi.mock("discord.js", async (importOriginal) => {
  const discord = await importOriginal<typeof import("discord.js")>();
  return {
    ...discord,
    DiscordAPIError: class extends Error {
      code: number;
      constructor(message: string, code: number) {
        super(message);
        this.name = "DiscordAPIError";
        this.code = code;
      }
    },
  };
});

const { execute } = await import("../../../src/app/commands/guild-avatar/reset.js");

function createResetInteraction(overrides?: {
  guildId?: string;
  subcommand?: string;
}): unknown {
  const guildId = overrides?.guildId ?? "guild-123";

  const mockGuild = {
    id: guildId,
    members: {
      editMe: mockEditMe,
    },
  };

  const interaction = createMockChatInputCommandInteraction({
    userId: "user-1",
    guildId,
    options: { subcommand: overrides?.subcommand ?? "reset" },
  }) as unknown as ChatInputCommandInteraction & {
    guild: typeof mockGuild;
    reply: ReturnType<typeof mockReply>;
    deferReply: ReturnType<typeof mockDeferReply>;
    editReply: ReturnType<typeof mockEditReply>;
  };

  interaction.guild = mockGuild as unknown as ChatInputCommandInteraction["guild"];
  interaction.reply = mockReply as unknown as ChatInputCommandInteraction["reply"];
  interaction.deferReply = mockDeferReply as unknown as ChatInputCommandInteraction["deferReply"];
  interaction.editReply = mockEditReply as unknown as ChatInputCommandInteraction["editReply"];

  return interaction;
}

describe("guild-avatar reset command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditMe.mockResolvedValue(undefined);
    mockReply.mockResolvedValue(undefined);
    mockDeferReply.mockResolvedValue(undefined);
    mockEditReply.mockResolvedValue(undefined);
  });

  describe("execute — happy path", () => {
    it("should defer, reset avatar to null, and editReply on success", async () => {
      const interaction = createResetInteraction({
        guildId: "guild-123",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalledWith({
        flags: [1 << 6], // MessageFlags.Ephemeral
      });
      expect(mockEditMe).toHaveBeenCalledWith({ avatar: null });
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "✅ Avatar del servidor eliminado.",
      });
      expect(mockReply).not.toHaveBeenCalled();
    });

    it("should be idempotent when no guild avatar is set", async () => {
      const interaction = createResetInteraction({
        guildId: "guild-123",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockEditMe).toHaveBeenCalledWith({ avatar: null });
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "✅ Avatar del servidor eliminado.",
      });
    });
  });

  describe("execute — guild guard", () => {
    it("should reply with error when used in DM (no guild)", async () => {
      const interaction = createMockChatInputCommandInteraction({
        userId: "user-1",
        guildId: "",
        options: { subcommand: "reset" },
      }) as unknown as ChatInputCommandInteraction & { reply: ReturnType<typeof mockReply> };

      Object.defineProperty(interaction, "guild", {
        value: null,
        writable: true,
      });
      interaction.reply = mockReply as unknown as ChatInputCommandInteraction["reply"];

      await execute(interaction);

      expect(mockEditMe).not.toHaveBeenCalled();
      expect(mockDeferReply).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith({
        content: "Este comando solo puede usarse en un servidor.",
        flags: [1 << 6],
      });
    });
  });

  describe("execute — error handling", () => {
    it("should handle DiscordAPIError code 429 (rate limit)", async () => {
      const { DiscordAPIError } = await import("discord.js");
      const rateLimitError = new DiscordAPIError("Rate limited", 429);
      mockEditMe.mockRejectedValue(rateLimitError);

      const interaction = createResetInteraction({
        guildId: "guild-123",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditMe).toHaveBeenCalledWith({ avatar: null });
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "⏳ Esperá unos minutos antes de cambiar el avatar de nuevo.",
      });
    });

    it("should handle DiscordAPIError code 50013 (missing permissions)", async () => {
      const { DiscordAPIError } = await import("discord.js");
      const permissionError = new DiscordAPIError("Missing Permissions", 50013);
      mockEditMe.mockRejectedValue(permissionError);

      const interaction = createResetInteraction({
        guildId: "guild-123",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditMe).toHaveBeenCalledWith({ avatar: null });
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "No tengo permiso para cambiar mi avatar en este servidor.",
      });
    });

    it("should handle generic DiscordAPIError with user-friendly message", async () => {
      const { DiscordAPIError } = await import("discord.js");
      const genericError = new DiscordAPIError("Something went wrong", 50035);
      mockEditMe.mockRejectedValue(genericError);

      const interaction = createResetInteraction({
        guildId: "guild-123",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditMe).toHaveBeenCalledWith({ avatar: null });
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "❌ Ocurrió un error inesperado al cambiar el avatar.",
      });
    });

    it("should handle non-DiscordAPIError with user-friendly message", async () => {
      const unknownError = new Error("Unknown error");
      mockEditMe.mockRejectedValue(unknownError);

      const interaction = createResetInteraction({
        guildId: "guild-123",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditMe).toHaveBeenCalledWith({ avatar: null });
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "❌ Ocurrió un error inesperado al cambiar el avatar.",
      });
    });
  });
});
