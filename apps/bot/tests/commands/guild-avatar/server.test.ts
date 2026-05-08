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

// Mock global fetch
const mockFetch = vi.hoisted(() => vi.fn<() => Promise<Response>>());
vi.stubGlobal("fetch", mockFetch);

const { execute } = await import("../../../src/app/commands/guild-avatar/server.js");

function createServerInteraction(overrides?: {
  guildId?: string;
  subcommand?: string;
  iconURL?: string | null;
}): unknown {
  const guildId = overrides?.guildId ?? "guild-123";
  const iconURL = overrides?.iconURL ?? "https://cdn.discordapp.com/icons/guild-123/avatar.png";

  const mockGuild = {
    id: guildId,
    members: {
      editMe: mockEditMe,
    },
    iconURL: () => iconURL,
  };

  const interaction = createMockChatInputCommandInteraction({
    userId: "user-1",
    guildId,
    options: { subcommand: overrides?.subcommand ?? "server" },
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

describe("guild-avatar server command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditMe.mockResolvedValue(undefined);
    mockReply.mockResolvedValue(undefined);
    mockDeferReply.mockResolvedValue(undefined);
    mockEditReply.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as unknown as Response);
  });

  describe("execute — happy path", () => {
    it("should defer, fetch icon, set avatar, and editReply on success", async () => {
      const interaction = createServerInteraction({
        guildId: "guild-123",
        iconURL: "https://cdn.discordapp.com/icons/guild-123/avatar.png",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalledWith({
        flags: [1 << 6], // MessageFlags.Ephemeral
      });
      expect(mockFetch).toHaveBeenCalledWith("https://cdn.discordapp.com/icons/guild-123/avatar.png");
      expect(mockEditMe).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "✅ Avatar cambiado al ícono del servidor",
      });
      expect(mockReply).not.toHaveBeenCalled();
    });
  });

  describe("execute — guild guard", () => {
    it("should reply with error when used in DM (no guild)", async () => {
      const interaction = createMockChatInputCommandInteraction({
        userId: "user-1",
        guildId: "",
        options: { subcommand: "server" },
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

  describe("execute — edge cases", () => {
    it("should reply with error when guild has no icon", async () => {
      const mockGuild = {
        id: "guild-123",
        members: { editMe: mockEditMe },
        iconURL: () => null,
      };

      const interaction = createMockChatInputCommandInteraction({
        userId: "user-1",
        guildId: "guild-123",
        options: { subcommand: "server" },
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

      expect(mockGuild.iconURL()).toBeNull();

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockEditMe).not.toHaveBeenCalled();
      expect(mockDeferReply).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith({
        content: "Este servidor no tiene un ícono configurado.",
        flags: [1 << 6],
      });
    });
  });

  describe("execute — error handling", () => {
    it("should handle DiscordAPIError code 429 (rate limit)", async () => {
      const { DiscordAPIError } = await import("discord.js");
      const rateLimitError = new DiscordAPIError("Rate limited", 429);
      mockEditMe.mockRejectedValue(rateLimitError);

      const interaction = createServerInteraction({
        guildId: "guild-123",
        iconURL: "https://cdn.discordapp.com/icons/guild-123/avatar.png",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditMe).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "⏳ Esperá unos minutos antes de cambiar el avatar de nuevo.",
      });
    });

    it("should handle DiscordAPIError code 50013 (missing permissions)", async () => {
      const { DiscordAPIError } = await import("discord.js");
      const permissionError = new DiscordAPIError("Missing Permissions", 50013);
      mockEditMe.mockRejectedValue(permissionError);

      const interaction = createServerInteraction({
        guildId: "guild-123",
        iconURL: "https://cdn.discordapp.com/icons/guild-123/avatar.png",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditMe).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "No tengo permiso para cambiar mi avatar en este servidor.",
      });
    });

    it("should handle generic DiscordAPIError with user-friendly message", async () => {
      const { DiscordAPIError } = await import("discord.js");
      const genericError = new DiscordAPIError("Something went wrong", 50035);
      mockEditMe.mockRejectedValue(genericError);

      const interaction = createServerInteraction({
        guildId: "guild-123",
        iconURL: "https://cdn.discordapp.com/icons/guild-123/avatar.png",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditMe).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "❌ Ocurrió un error inesperado al cambiar el avatar.",
      });
    });

    it("should handle non-DiscordAPIError with user-friendly message", async () => {
      const unknownError = new Error("Unknown error");
      mockEditMe.mockRejectedValue(unknownError);

      const interaction = createServerInteraction({
        guildId: "guild-123",
        iconURL: "https://cdn.discordapp.com/icons/guild-123/avatar.png",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditMe).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "❌ Ocurrió un error inesperado al cambiar el avatar.",
      });
    });
  });
});
