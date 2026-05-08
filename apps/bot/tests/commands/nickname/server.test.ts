import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";
import { createMockChatInputCommandInteraction } from "../../../src/__mocks__/discord.js";

const mockSetNickname = vi.hoisted(() => vi.fn<() => Promise<void>>());
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
    // Create a mock DiscordAPIError that instanceof actually recognizes
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

const { execute } = await import("../../../src/app/commands/nickname/server.js");

function createNicknameInteraction(overrides?: {
  guildName?: string;
  guildId?: string;
  subcommand?: string;
}): unknown {
  const guildName = overrides?.guildName ?? "Test Server";
  const guildId = overrides?.guildId ?? "guild-123";
  const subcommand = overrides?.subcommand ?? "server";

  const mockMembersMe = {
    setNickname: mockSetNickname,
  };

  const mockGuild = {
    id: guildId,
    name: guildName,
    members: {
      me: mockMembersMe,
    },
  };

  const interaction = createMockChatInputCommandInteraction({
    userId: "user-1",
    guildId,
    options: { subcommand },
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

describe("nickname server command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetNickname.mockResolvedValue(undefined);
    mockReply.mockResolvedValue(undefined);
    mockDeferReply.mockResolvedValue(undefined);
    mockEditReply.mockResolvedValue(undefined);
  });

  describe("execute — happy path", () => {
    it("should defer, set nickname, and editReply on success", async () => {
      const interaction = createNicknameInteraction({
        guildName: "My Cool Server",
        guildId: "guild-123",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalledWith({
        flags: [1 << 6], // MessageFlags.Ephemeral
      });
      expect(mockSetNickname).toHaveBeenCalledWith("My Cool Server");
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "✅ Apodo cambiado a **My Cool Server**",
      });
      expect(mockReply).not.toHaveBeenCalled();
    });

    it("should truncate guild name to 32 characters", async () => {
      const longName = "A".repeat(50);
      const interaction = createNicknameInteraction({
        guildName: longName,
        guildId: "guild-123",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockSetNickname).toHaveBeenCalledWith("A".repeat(32));
      expect(mockEditReply).toHaveBeenCalledWith({
        content: `✅ Apodo cambiado a **${"A".repeat(32)}**`,
      });
    });

    it("should not truncate guild name at exactly 32 chars", async () => {
      const exactName = "B".repeat(32);
      const interaction = createNicknameInteraction({
        guildName: exactName,
        guildId: "guild-123",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockSetNickname).toHaveBeenCalledWith(exactName);
      expect(mockEditReply).toHaveBeenCalledWith({
        content: `✅ Apodo cambiado a **${exactName}**`,
      });
    });
  });

  describe("execute — guild guard", () => {
    it("should reply with error when used in DM (no guild)", async () => {
      const interaction = createMockChatInputCommandInteraction({
        userId: "user-1",
        guildId: "",
        options: { subcommand: "server" },
      }) as unknown as ChatInputCommandInteraction & { reply: ReturnType<typeof mockReply> };

      // Simulate no guild
      Object.defineProperty(interaction, "guild", {
        value: null,
        writable: true,
      });
      // Use our hoisted mockReply
      interaction.reply = mockReply as unknown as ChatInputCommandInteraction["reply"];

      await execute(interaction);

      expect(mockSetNickname).not.toHaveBeenCalled();
      expect(mockDeferReply).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith({
        content: "Este comando solo puede usarse en un servidor.",
        flags: [1 << 6],
      });
    });
  });

  describe("execute — edge cases", () => {
    it("should reply with error when bot member is not available", async () => {
      const interaction = createNicknameInteraction({
        guildName: "Test Server",
        guildId: "guild-123",
      });

      // Override guild.members.me to be null
      (interaction as { guild: { members: { me: null } } }).guild.members.me = null;

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockSetNickname).not.toHaveBeenCalled();
      expect(mockDeferReply).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith({
        content: "No pude obtener mi información de miembro en este servidor.",
        flags: [1 << 6],
      });
    });
  });

  describe("execute — error handling", () => {
    it("should handle DiscordAPIError code 50013 (missing permissions)", async () => {
      const { DiscordAPIError } = await import("discord.js");
      const permissionError = new DiscordAPIError("Missing Permissions", 50013);
      mockSetNickname.mockRejectedValue(permissionError);

      const interaction = createNicknameInteraction({
        guildName: "Test Server",
        guildId: "guild-123",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockSetNickname).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "No tengo permiso para cambiar mi apodo en este servidor.",
      });
    });

    it("should handle generic DiscordAPIError with user-friendly message", async () => {
      const genericError = new Error("Something went wrong") as DiscordAPIError;
      genericError.code = 50035;
      mockSetNickname.mockRejectedValue(genericError);

      const interaction = createNicknameInteraction({
        guildName: "Test Server",
        guildId: "guild-123",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockSetNickname).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "❌ Ocurrió un error inesperado al cambiar el apodo.",
      });
    });

    it("should handle non-DiscordAPIError with user-friendly message", async () => {
      const unknownError = new Error("Unknown error");
      mockSetNickname.mockRejectedValue(unknownError);

      const interaction = createNicknameInteraction({
        guildName: "Test Server",
        guildId: "guild-123",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockSetNickname).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "❌ Ocurrió un error inesperado al cambiar el apodo.",
      });
    });
  });
});
