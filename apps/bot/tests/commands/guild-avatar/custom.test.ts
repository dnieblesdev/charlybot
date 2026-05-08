import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";
import { createMockChatInputCommandInteraction } from "../../../src/__mocks__/discord.js";

const mockEditMe = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockReply = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockDeferReply = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockEditReply = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockGetAttachment = vi.hoisted(() => vi.fn());

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

const { execute } = await import("../../../src/app/commands/guild-avatar/custom.js");

function createCustomInteraction(overrides?: {
  guildId?: string;
  subcommand?: string;
  attachment?: { url: string; contentType?: string } | null;
}): unknown {
  const guildId = overrides?.guildId ?? "guild-123";
  const attachment = overrides?.attachment ?? { url: "https://cdn.discordapp.com/attachments/123/456/image.png" };

  const mockGuild = {
    id: guildId,
    members: {
      editMe: mockEditMe,
    },
  };

  const interaction = createMockChatInputCommandInteraction({
    userId: "user-1",
    guildId,
    options: { subcommand: overrides?.subcommand ?? "custom" },
  }) as unknown as ChatInputCommandInteraction & {
    guild: typeof mockGuild;
    reply: ReturnType<typeof mockReply>;
    deferReply: ReturnType<typeof mockDeferReply>;
    editReply: ReturnType<typeof mockEditReply>;
    options: {
      getAttachment: ReturnType<typeof mockGetAttachment>;
      getSubcommand: () => string;
    };
  };

  interaction.guild = mockGuild as unknown as ChatInputCommandInteraction["guild"];
  interaction.reply = mockReply as unknown as ChatInputCommandInteraction["reply"];
  interaction.deferReply = mockDeferReply as unknown as ChatInputCommandInteraction["deferReply"];
  interaction.editReply = mockEditReply as unknown as ChatInputCommandInteraction["editReply"];
  interaction.options.getAttachment = mockGetAttachment as unknown as ChatInputCommandInteraction["options"]["getAttachment"];

  if (attachment) {
    mockGetAttachment.mockReturnValue({
      url: attachment.url,
      contentType: attachment.contentType ?? "image/png",
    });
  } else {
    mockGetAttachment.mockReturnValue(null);
  }

  return interaction;
}

describe("guild-avatar custom command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditMe.mockResolvedValue(undefined);
    mockReply.mockResolvedValue(undefined);
    mockDeferReply.mockResolvedValue(undefined);
    mockEditReply.mockResolvedValue(undefined);
    mockGetAttachment.mockReturnValue({
      url: "https://cdn.discordapp.com/attachments/123/456/image.png",
      contentType: "image/png",
    });
    mockFetch.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as unknown as Response);
  });

  describe("execute — happy path", () => {
    it("should defer, fetch attachment, set avatar, and editReply on success", async () => {
      const interaction = createCustomInteraction({
        guildId: "guild-123",
        attachment: { url: "https://cdn.discordapp.com/attachments/123/456/image.png" },
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalledWith({
        flags: [1 << 6], // MessageFlags.Ephemeral
      });
      expect(mockFetch).toHaveBeenCalledWith("https://cdn.discordapp.com/attachments/123/456/image.png");
      expect(mockEditMe).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "✅ Avatar personalizado cambiado con éxito",
      });
      expect(mockReply).not.toHaveBeenCalled();
    });
  });

  describe("execute — guild guard", () => {
    it("should reply with error when used in DM (no guild)", async () => {
      const interaction = createMockChatInputCommandInteraction({
        userId: "user-1",
        guildId: "",
        options: { subcommand: "custom" },
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

      const interaction = createCustomInteraction({
        guildId: "guild-123",
        attachment: { url: "https://cdn.discordapp.com/attachments/123/456/image.png" },
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

      const interaction = createCustomInteraction({
        guildId: "guild-123",
        attachment: { url: "https://cdn.discordapp.com/attachments/123/456/image.png" },
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditMe).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "No tengo permiso para cambiar mi avatar en este servidor.",
      });
    });

    it("should handle DiscordAPIError code 50035 (invalid format)", async () => {
      const { DiscordAPIError } = await import("discord.js");
      const formatError = new DiscordAPIError("Invalid format", 50035);
      mockEditMe.mockRejectedValue(formatError);

      const interaction = createCustomInteraction({
        guildId: "guild-123",
        attachment: { url: "https://cdn.discordapp.com/attachments/123/456/file.pdf" },
      });

      await execute(interaction as ChatInputCommandInteraction);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditMe).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith({
        content: "Formato de imagen no válido. Usá PNG, JPG o GIF.",
      });
    });

    it("should handle generic DiscordAPIError with user-friendly message", async () => {
      const { DiscordAPIError } = await import("discord.js");
      const genericError = new DiscordAPIError("Something went wrong", 10003);
      mockEditMe.mockRejectedValue(genericError);

      const interaction = createCustomInteraction({
        guildId: "guild-123",
        attachment: { url: "https://cdn.discordapp.com/attachments/123/456/image.png" },
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

      const interaction = createCustomInteraction({
        guildId: "guild-123",
        attachment: { url: "https://cdn.discordapp.com/attachments/123/456/image.png" },
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
