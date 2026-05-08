import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";
import { createMockChatInputCommandInteraction } from "../../../src/__mocks__/discord.js";

const mockSetNickname = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockReply = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockDeferReply = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockEditReply = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockGetString = vi.hoisted(() => vi.fn<string | null>());

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

const { execute } = await import("../../../src/app/commands/nickname/custom.js");

function createNicknameInteraction(overrides?: {
  guildName?: string;
  guildId?: string;
  customName?: string | null;
  subcommand?: string;
}): unknown {
  const guildName = overrides?.guildName ?? "Test Server";
  const guildId = overrides?.guildId ?? "guild-123";
  const customName = overrides?.customName ?? "CharlyBot";
  const subcommand = overrides?.subcommand ?? "custom";

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
    options: { subcommand, stringOption: customName },
  }) as unknown as ChatInputCommandInteraction & {
    guild: typeof mockGuild;
    reply: ReturnType<typeof mockReply>;
    deferReply: ReturnType<typeof mockDeferReply>;
    editReply: ReturnType<typeof mockEditReply>;
    options: {
      getString: ReturnType<typeof mockGetString>;
      getSubcommand: () => string;
    };
  };

  interaction.guild = mockGuild as unknown as ChatInputCommandInteraction["guild"];
  interaction.reply = mockReply as unknown as ChatInputCommandInteraction["reply"];
  interaction.deferReply = mockDeferReply as unknown as ChatInputCommandInteraction["deferReply"];
  interaction.editReply = mockEditReply as unknown as ChatInputCommandInteraction["editReply"];
  interaction.options.getString = mockGetString as unknown as ChatInputCommandInteraction["options"]["getString"];

  // Default: return the custom name
  mockGetString.mockReturnValue(customName);

  return interaction;
}

describe("nickname custom command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetNickname.mockResolvedValue(undefined);
    mockReply.mockResolvedValue(undefined);
    mockDeferReply.mockResolvedValue(undefined);
    mockEditReply.mockResolvedValue(undefined);
    mockGetString.mockReturnValue("CharlyBot");
  });

  describe("execute — happy path", () => {
    it("should defer, set nickname, and editReply on success", async () => {
      const interaction = createNicknameInteraction({
        customName: "MyBot",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalledWith({
        flags: [1 << 6], // MessageFlags.Ephemeral
      });
      expect(mockSetNickname).toHaveBeenCalledWith("MyBot");
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "✅ Apodo cambiado a **MyBot**",
      });
      expect(mockReply).not.toHaveBeenCalled();
    });

    it("should trim whitespace from custom name", async () => {
      const interaction = createNicknameInteraction({
        customName: "  TrimmedBot  ",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockSetNickname).toHaveBeenCalledWith("TrimmedBot");
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "✅ Apodo cambiado a **TrimmedBot**",
      });
    });

    it("should accept exactly 32-character name", async () => {
      const exactName = "C".repeat(32);
      const interaction = createNicknameInteraction({
        customName: exactName,
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockSetNickname).toHaveBeenCalledWith(exactName);
      expect(mockEditReply).toHaveBeenCalledWith({
        content: `✅ Apodo cambiado a **${exactName}**`,
      });
    });
  });

  describe("execute — validation", () => {
    it("should reject empty string", async () => {
      const interaction = createNicknameInteraction({
        customName: "",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockSetNickname).not.toHaveBeenCalled();
      expect(mockDeferReply).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith({
        content: "El apodo no puede estar vacío.",
        flags: [1 << 6],
      });
    });

    it("should reject whitespace-only string", async () => {
      const interaction = createNicknameInteraction({
        customName: "   ",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockSetNickname).not.toHaveBeenCalled();
      expect(mockDeferReply).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith({
        content: "El apodo no puede estar vacío.",
        flags: [1 << 6],
      });
    });

    it("should reject name exceeding 32 characters", async () => {
      const longName = "D".repeat(33);
      const interaction = createNicknameInteraction({
        customName: longName,
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockSetNickname).not.toHaveBeenCalled();
      expect(mockDeferReply).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith({
        content: "El apodo debe tener 32 caracteres o menos.",
        flags: [1 << 6],
      });
    });

    it("should reject name at 33 characters", async () => {
      const interaction = createNicknameInteraction({
        customName: "E".repeat(33),
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockSetNickname).not.toHaveBeenCalled();
      expect(mockDeferReply).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith({
        content: "El apodo debe tener 32 caracteres o menos.",
        flags: [1 << 6],
      });
    });
  });

  describe("execute — guild guard", () => {
    it("should reply with error when used in DM (no guild)", async () => {
      const interaction = createMockChatInputCommandInteraction({
        userId: "user-1",
        guildId: "",
        options: { subcommand: "custom", stringOption: "SomeBot" },
      }) as unknown as ChatInputCommandInteraction & { reply: ReturnType<typeof mockReply> };

      Object.defineProperty(interaction, "guild", {
        value: null,
        writable: true,
      });
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
        customName: "TestBot",
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
        customName: "TestBot",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockSetNickname).toHaveBeenCalledWith("TestBot");
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "No tengo permiso para cambiar mi apodo en este servidor.",
      });
    });

    it("should handle generic DiscordAPIError with user-friendly message", async () => {
      const { DiscordAPIError } = await import("discord.js");
      const genericError = new DiscordAPIError("Invalid form body", 50035);
      mockSetNickname.mockRejectedValue(genericError);

      const interaction = createNicknameInteraction({
        customName: "TestBot",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockSetNickname).toHaveBeenCalledWith("TestBot");
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "❌ Ocurrió un error inesperado al cambiar el apodo.",
      });
    });

    it("should handle non-DiscordAPIError with user-friendly message", async () => {
      const unknownError = new Error("Unknown error");
      mockSetNickname.mockRejectedValue(unknownError);

      const interaction = createNicknameInteraction({
        customName: "TestBot",
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockSetNickname).toHaveBeenCalledWith("TestBot");
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "❌ Ocurrió un error inesperado al cambiar el apodo.",
      });
    });
  });
});
