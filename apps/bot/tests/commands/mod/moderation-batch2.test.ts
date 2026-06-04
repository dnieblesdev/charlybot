import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatInputCommandInteraction, GuildMember, User, Guild, Client, TextChannel, Message } from "discord.js";
import { Collection, ChannelType } from "discord.js";
import type { IModCase, IWarnThreshold, IGuildConfig } from "@charlybot/shared";

// =============================================================================
// Mock functions — defined before vi.mock() hoisting
// =============================================================================

const mockCanModerate = vi.fn();
const mockLogModAction = vi.fn();
const mockModCaseCreate = vi.fn();
const mockModCaseFindByGuild = vi.fn();
const mockModCaseFindByUser = vi.fn();
const mockModCaseFindById = vi.fn();
const mockModCaseFindByGuildAndCaseNumber = vi.fn();
const mockModCaseUpdateReason = vi.fn();
const mockGuildConfigGet = vi.fn();
const mockGuildConfigUpdate = vi.fn();
const mockWarnThresholdCreate = vi.fn();
const mockWarnThresholdFindAll = vi.fn();
const MOCK_MODERATION_ACTION = {
  WARN: "warn",
  TIMEOUT: "timeout",
  KICK: "kick",
  BAN: "ban",
  UNBAN: "unban",
  REASON: "reason",
  CASES: "cases",
  CONFIG: "config",
} as const;

// =============================================================================
// vi.mock() — hoisted, runs BEFORE imports
// =============================================================================

vi.mock("../../../src/app/services/ModGuardService.js", () => ({
  canModerate: (...args: unknown[]) => mockCanModerate(...args),
  MODERATION_ACTION: MOCK_MODERATION_ACTION,
}));

vi.mock("../../../src/app/services/ModLogService.js", () => ({
  logModAction: (...args: unknown[]) => mockLogModAction(...args),
}));

vi.mock("../../../src/config/repositories/modCaseRepository.js", () => ({
  create: (...args: unknown[]) => mockModCaseCreate(...args),
  findByGuild: (...args: unknown[]) => mockModCaseFindByGuild(...args),
  findByUser: (...args: unknown[]) => mockModCaseFindByUser(...args),
  findById: (...args: unknown[]) => mockModCaseFindById(...args),
  findByGuildAndCaseNumber: (...args: unknown[]) => mockModCaseFindByGuildAndCaseNumber(...args),
  updateReason: (...args: unknown[]) => mockModCaseUpdateReason(...args),
}));

vi.mock("../../../src/config/repositories/GuildConfigRepo.js", () => ({
  getGuildConfig: (...args: unknown[]) => mockGuildConfigGet(...args),
  update: (...args: unknown[]) => mockGuildConfigUpdate(...args),
}));

vi.mock("../../../src/config/repositories/warnThresholdRepository.js", () => ({
  create: (...args: unknown[]) => mockWarnThresholdCreate(...args),
  findAll: (...args: unknown[]) => mockWarnThresholdFindAll(...args),
}));

vi.mock("../../../src/utils/logger.js", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  logCommand: vi.fn(),
}));

// =============================================================================
// Import commands under test (after mocks are set up)
// =============================================================================

const clearHandler = (await import("../../../src/app/commands/mod/clear.js")).default;
const casesHandler = (await import("../../../src/app/commands/mod/cases.js")).default;
const reasonHandler = (await import("../../../src/app/commands/mod/reason.js")).default;
const modRoleHandler = (await import("../../../src/app/commands/mod/config/mod-role.js")).default;
const modLogHandler = (await import("../../../src/app/commands/mod/config/mod-log.js")).default;
const warnThresholdHandler = (await import("../../../src/app/commands/mod/config/warn-threshold.js")).default;
const viewHandler = (await import("../../../src/app/commands/mod/config/view.js")).default;

// =============================================================================
// Helpers
// =============================================================================

const MOCK_CASE: IModCase = {
  id: 1,
  guildId: "guild-1",
  userId: "target-1",
  moderatorId: "mod-1",
  caseNumber: 42,
  type: "warn",
  reason: "Spam",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockInteraction(overrides?: {
  userId?: string;
  guildId?: string;
  options?: Record<string, unknown>;
}): ChatInputCommandInteraction {
  const userId = overrides?.userId ?? "mod-1";
  const guildId = overrides?.guildId ?? "guild-1";
  const opts = (overrides?.options ?? {}) as Record<string, unknown>;

  const targetUserData = (opts.targetUser ?? { id: "target-1", username: "TargetUser", bot: false }) as User;
  const targetUser = {
    id: targetUserData.id,
    username: targetUserData.username,
    bot: targetUserData.bot ?? false,
  } as unknown as User;

  const modMember = {
    id: userId,
    user: { id: userId, username: "ModUser" },
    roles: { highest: { position: 10 } },
    permissions: { has: vi.fn(() => true) },
  } as unknown as GuildMember;

  const botMember = {
    id: "bot-1",
    user: { id: "bot-1", username: "BotUser" },
    roles: { highest: { position: 100 } },
  } as unknown as GuildMember;

  const mockChannel = {
    id: "channel-1",
    messages: {
      fetch: vi.fn(() => Promise.resolve(new Collection())),
      bulkDelete: vi.fn(() => Promise.resolve(new Collection())),
    },
    send: vi.fn(() => Promise.resolve()),
    permissionsFor: vi.fn(() => ({ has: vi.fn(() => true) })),
  } as unknown as TextChannel;

  const guild = {
    id: guildId,
    name: "Test Guild",
    members: {
      fetch: vi.fn().mockImplementation((id: string) => {
        if (id === userId) return Promise.resolve(modMember);
        if (id === "bot-1") return Promise.resolve(botMember);
        return Promise.resolve(modMember);
      }),
    },
    channels: {
      fetch: vi.fn(() => Promise.resolve(mockChannel)),
    },
    roles: {
      fetch: vi.fn(() => Promise.resolve({ id: "role-1", name: "ModRole" })),
    },
  } as unknown as Guild;

  const client = {
    user: { id: "bot-1", username: "BotUser" },
  } as unknown as Client;

  const optionMap = opts.optionMap ?? {};
  const getSubcommand = vi.fn(() => (opts.subcommand ?? "clear") as string);
  const getSubcommandGroup = vi.fn(() => (opts.subcommandGroup ?? null) as string | null);
  const getUser = vi.fn((name: string) => {
    const val = (optionMap as Record<string, unknown>)[name];
    return (val as User) ?? null;
  });
  const getString = vi.fn((name: string) => {
    const val = (optionMap as Record<string, unknown>)[name];
    return (val as string) ?? null;
  });
  const getInteger = vi.fn((name: string) => {
    const val = (optionMap as Record<string, unknown>)[name];
    return (val as number) ?? null;
  });
  const getRole = vi.fn((name: string) => {
    const val = (optionMap as Record<string, unknown>)[name];
    return (val as { id: string; name: string }) ?? null;
  });
  const getChannel = vi.fn((name: string) => {
    const val = (optionMap as Record<string, unknown>)[name];
    return (val as TextChannel) ?? null;
  });

  const interaction = {
    user: { id: userId, username: "ModUser", bot: false },
    guildId,
    guild,
    client,
    member: modMember,
    memberPermissions: { has: vi.fn(() => true) },
    deferred: false,
    replied: false,
    options: {
      getSubcommand,
      getSubcommandGroup,
      getUser,
      getString,
      getInteger,
      getRole,
      getChannel,
    },
    channel: mockChannel,
    deferReply: vi.fn(() => {
      (interaction as any).deferred = true;
      return Promise.resolve();
    }),
    editReply: vi.fn(() => Promise.resolve()),
    reply: vi.fn(() => Promise.resolve()),
  } as unknown as ChatInputCommandInteraction;

  return interaction;
}

// =============================================================================
// /mod clear tests
// =============================================================================

describe("/mod clear", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModCaseCreate.mockResolvedValue({ ...MOCK_CASE, type: "clear", messageCount: 5 });
    mockLogModAction.mockResolvedValue(undefined);
  });

  it("should clear messages successfully", async () => {
    const deletedMessages = new Collection<string, Message>();
    // Add some mock messages
    for (let i = 0; i < 5; i++) {
      deletedMessages.set(`msg-${i}`, { id: `msg-${i}`, author: { id: "user-1" } } as Message);
    }

    const interaction = createMockInteraction({
      options: {
        optionMap: { cantidad: 5 },
      },
    });
    (interaction.channel as TextChannel).messages.fetch = vi.fn(() => Promise.resolve(deletedMessages));
    (interaction.channel as TextChannel).messages.bulkDelete = vi.fn(() => Promise.resolve(deletedMessages));

    await clearHandler(interaction);

    expect(mockModCaseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "clear", messageCount: 5 }),
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("5 mensajes eliminados") }),
    );
  });

  it("should filter by user when specified", async () => {
    const allMessages = new Collection<string, Message>();
    allMessages.set("msg-1", { id: "msg-1", author: { id: "target-1" } } as Message);
    allMessages.set("msg-2", { id: "msg-2", author: { id: "other-user" } } as Message);
    allMessages.set("msg-3", { id: "msg-3", author: { id: "target-1" } } as Message);

    const interaction = createMockInteraction({
      options: {
        optionMap: {
          cantidad: 10,
          usuario: { id: "target-1", username: "TargetUser", bot: false },
        },
      },
    });
    (interaction.channel as TextChannel).messages.fetch = vi.fn(() => Promise.resolve(allMessages));
    (interaction.channel as TextChannel).messages.bulkDelete = vi.fn(() => Promise.resolve(new Collection()));

    await clearHandler(interaction);

    // bulkDelete should be called with filtered messages (only target-1's)
    const bulkDeleteCall = (interaction.channel as TextChannel).messages.bulkDelete as ReturnType<typeof vi.fn>;
    const filteredArg = bulkDeleteCall.mock.calls[0]?.[0];
    expect(filteredArg.size).toBe(2); // Only 2 messages from target-1
  });

  it("should handle no messages found", async () => {
    const interaction = createMockInteraction({
      options: { optionMap: { cantidad: 10 } },
    });
    (interaction.channel as TextChannel).messages = {
      fetch: vi.fn(() => Promise.resolve(new Collection())),
      bulkDelete: vi.fn(() => Promise.resolve(new Collection())),
    } as any;

    await clearHandler(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("No se encontraron mensajes") }),
    );
    expect(mockModCaseCreate).not.toHaveBeenCalled();
  });

  it("should reject without ManageMessages permission", async () => {
    const interaction = createMockInteraction({
      options: { optionMap: { cantidad: 10 } },
    });
    (interaction as any).memberPermissions = { has: vi.fn(() => false) };

    await clearHandler(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("permiso") }),
    );
  });
});

// =============================================================================
// /mod cases tests
// =============================================================================

describe("/mod cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanModerate.mockResolvedValue({ allowed: true });
  });

  it("should show last 10 cases when no arguments", async () => {
    const cases = [
      { ...MOCK_CASE, caseNumber: 1, type: "warn" as const, createdAt: new Date() },
      { ...MOCK_CASE, caseNumber: 2, type: "timeout" as const, createdAt: new Date() },
    ];
    mockModCaseFindByGuild.mockResolvedValue(cases);

    const interaction = createMockInteraction({
      options: { optionMap: {} },
    });

    await casesHandler(interaction);

    expect(mockModCaseFindByGuild).toHaveBeenCalledWith("guild-1");
    expect(interaction.editReply).toHaveBeenCalled();
    const replyArg = (interaction.editReply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(replyArg).toBeDefined();
  });

  it("should show cases for a specific user", async () => {
    const cases = [{ ...MOCK_CASE, caseNumber: 1, type: "warn" as const }];
    mockModCaseFindByUser.mockResolvedValue(cases);

    const interaction = createMockInteraction({
      options: {
        optionMap: {
          usuario: { id: "target-1", username: "TargetUser", bot: false },
        },
      },
    });

    await casesHandler(interaction);

    expect(mockModCaseFindByUser).toHaveBeenCalledWith("guild-1", "target-1");
  });

  it("should show detail for a specific case id", async () => {
    mockModCaseFindByGuildAndCaseNumber.mockResolvedValue(MOCK_CASE);

    const interaction = createMockInteraction({
      options: { optionMap: { id: 42 } },
    });

    await casesHandler(interaction);

    expect(mockCanModerate).toHaveBeenCalledWith(interaction, MOCK_MODERATION_ACTION.CASES);
    expect(mockModCaseFindByGuildAndCaseNumber).toHaveBeenCalledWith("guild-1", 42);
    const replyArg = (interaction.editReply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(replyArg).toBeDefined();
    expect(replyArg.embeds?.[0]?.data?.footer).toBeUndefined();
  });

  it("should handle case not found", async () => {
    mockModCaseFindByGuildAndCaseNumber.mockResolvedValue(null);

    const interaction = createMockInteraction({
      options: { optionMap: { id: 999 } },
    });

    await casesHandler(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("en este servidor") }),
    );
  });

  it("should reject case lookup when user cannot moderate", async () => {
    mockCanModerate.mockResolvedValue({ allowed: false, reason: "No tenés permisos" });

    const interaction = createMockInteraction({
      options: { optionMap: { id: 42 } },
    });

    await casesHandler(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("permisos") }),
    );
    expect(mockModCaseFindByGuildAndCaseNumber).not.toHaveBeenCalled();
  });

  it("should handle empty case list", async () => {
    mockModCaseFindByGuild.mockResolvedValue([]);

    const interaction = createMockInteraction({
      options: { optionMap: {} },
    });

    await casesHandler(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("No hay casos") }),
    );
  });
});

// =============================================================================
// /mod reason tests
// =============================================================================

describe("/mod reason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModCaseFindByGuildAndCaseNumber.mockResolvedValue(MOCK_CASE);
    mockModCaseUpdateReason.mockResolvedValue(MOCK_CASE);
    mockCanModerate.mockResolvedValue({ allowed: true });
    mockLogModAction.mockResolvedValue(undefined);
  });

  it("should update reason successfully", async () => {
    const interaction = createMockInteraction({
      options: {
        optionMap: { id: 42, razon: "Nueva razón" },
      },
    });

    await reasonHandler(interaction);

    expect(mockCanModerate).toHaveBeenCalledWith(interaction, MOCK_MODERATION_ACTION.REASON);
    expect(mockModCaseFindByGuildAndCaseNumber).toHaveBeenCalledWith("guild-1", 42);
    expect(mockModCaseUpdateReason).toHaveBeenCalledWith(1, "Nueva razón");
    expect(mockLogModAction).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("actualizada") }),
    );
  });

  it("should reject if case not found", async () => {
    mockModCaseFindByGuildAndCaseNumber.mockResolvedValue(null);

    const interaction = createMockInteraction({
      options: { optionMap: { id: 999, razon: "Nueva razón" },
      },
    });

    await reasonHandler(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("No se encontró") }),
    );
    expect(mockModCaseUpdateReason).not.toHaveBeenCalled();
  });

  it("should reject when user cannot moderate", async () => {
    mockCanModerate.mockResolvedValue({ allowed: false, reason: "No tenés permisos" });

    const interaction = createMockInteraction({
      options: { optionMap: { id: 42, razon: "Nueva razón" } },
    });

    await reasonHandler(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("permisos") }),
    );
    expect(mockModCaseUpdateReason).not.toHaveBeenCalled();
  });
});

// =============================================================================
// /mod config mod-role tests
// =============================================================================

describe("/mod config mod-role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuildConfigUpdate.mockResolvedValue(undefined);
  });

  it("should set mod role successfully", async () => {
    const interaction = createMockInteraction({
      options: {
        optionMap: {
          rol: { id: "role-123", name: "Moderator" },
        },
      },
    });

    await modRoleHandler(interaction);

    expect(mockGuildConfigUpdate).toHaveBeenCalledWith("guild-1", { modRoleId: "role-123" });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("role-123") }),
    );
  });
});

// =============================================================================
// /mod config mod-log tests
// =============================================================================

describe("/mod config mod-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuildConfigUpdate.mockResolvedValue(undefined);
  });

  it("should set mod log channel successfully", async () => {
    const mockChannel = {
      id: "channel-123",
      name: "mod-logs",
      type: ChannelType.GuildText,
      send: vi.fn(() => Promise.resolve()),
      permissionsFor: vi.fn(() => ({ has: vi.fn(() => true) })),
    } as unknown as TextChannel;

    const interaction = createMockInteraction({
      options: {
        optionMap: { canal: mockChannel },
      },
    });
    // Set up guild.members.me for permission check
    (interaction.guild as any).members.me = {
      id: "bot-1",
      roles: { highest: { position: 100 } },
    };

    await modLogHandler(interaction);

    expect(mockGuildConfigUpdate).toHaveBeenCalledWith("guild-1", { modLogChannelId: "channel-123" });
    expect(mockChannel.send).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("channel-123") }),
    );
  });
});

// =============================================================================
// /mod config warn-threshold tests
// =============================================================================

describe("/mod config warn-threshold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWarnThresholdCreate.mockResolvedValue({ id: 1, guildId: "guild-1", warnCount: 3, action: "timeout" });
  });

  it("should create warn threshold with timeout action", async () => {
    const interaction = createMockInteraction({
      options: {
        optionMap: { warns: 3, accion: "timeout", duracion: "1h" },
      },
    });

    await warnThresholdHandler(interaction);

    expect(mockWarnThresholdCreate).toHaveBeenCalledWith("guild-1", 3, "timeout", BigInt(3_600_000));
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("timeout") }),
    );
  });

  it("should create warn threshold without duration for kick", async () => {
    const interaction = createMockInteraction({
      options: {
        optionMap: { warns: 5, accion: "kick" },
      },
    });

    await warnThresholdHandler(interaction);

    expect(mockWarnThresholdCreate).toHaveBeenCalledWith("guild-1", 5, "kick", undefined);
  });

  it("should reject invalid duration", async () => {
    const interaction = createMockInteraction({
      options: {
        optionMap: { warns: 3, accion: "timeout", duracion: "invalid" },
      },
    });

    await warnThresholdHandler(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("Formato") }),
    );
  });
});

// =============================================================================
// /mod config view tests
// =============================================================================

describe("/mod config view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanModerate.mockResolvedValue({ allowed: true });
  });

  it("should show current configuration", async () => {
    const config: IGuildConfig = {
      guildId: "guild-1",
      modRoleId: "role-123",
      modLogChannelId: "channel-123",
      antispamEnabled: true,
    };
    mockGuildConfigGet.mockResolvedValue(config);
    mockWarnThresholdFindAll.mockResolvedValue([
      { id: 1, guildId: "guild-1", warnCount: 3, action: "timeout", duration: BigInt(3_600_000) },
    ]);

    const interaction = createMockInteraction();

    await viewHandler(interaction);

    expect(mockCanModerate).toHaveBeenCalled();
    expect(mockGuildConfigGet).toHaveBeenCalledWith("guild-1");
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("should show not configured when no config exists", async () => {
    mockGuildConfigGet.mockResolvedValue(null);
    mockWarnThresholdFindAll.mockResolvedValue([]);

    const interaction = createMockInteraction();

    await viewHandler(interaction);

    const replyArg = (interaction.editReply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(replyArg).toBeDefined();
  });

  it("should reject when user cannot moderate", async () => {
    mockCanModerate.mockResolvedValue({ allowed: false, reason: "No tenés permisos" });

    const interaction = createMockInteraction();

    await viewHandler(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("permisos") }),
    );
  });
});
