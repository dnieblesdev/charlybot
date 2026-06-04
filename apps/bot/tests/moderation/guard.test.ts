import { describe, it, expect, vi, beforeEach } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction, GuildMember, Role } from "discord.js";

const mockGetGuildConfig = vi.fn();

vi.mock("../../src/config/repositories/GuildConfigRepo", () => ({
  getGuildConfig: (...args: unknown[]) => mockGetGuildConfig(...args),
}));

const {
  canModerate,
  canTargetModerator,
  canTargetSelf,
  canBotAct,
  MODERATION_ACTION,
} = await import("../../src/app/services/ModGuardService");

function createMockMember(
  id: string,
  rolePosition: number,
): GuildMember {
  const mockRole = {
    position: rolePosition,
  } as Role;

  return {
    id,
    roles: {
      highest: mockRole,
    },
  } as unknown as GuildMember;
}

function createModerationInteraction(options?: {
  guildId?: string;
  userId?: string;
  isAdmin?: boolean;
  hasModRole?: boolean;
  permissions?: bigint[];
}): ChatInputCommandInteraction {
  const guildId = options?.guildId ?? "guild-1";
  const userId = options?.userId ?? "mod-1";
  const permissionSet = new Set<bigint>(options?.permissions ?? []);

  const member = {
    id: userId,
    permissions: {
      has: vi.fn((permission: bigint) => {
        if (options?.isAdmin && permission === PermissionFlagsBits.Administrator) {
          return true;
        }

        return permissionSet.has(permission);
      }),
    },
    roles: {
      cache: {
        has: vi.fn(() => options?.hasModRole ?? false),
      },
    },
  } as unknown as GuildMember;

  return {
    guildId,
    user: { id: userId },
    guild: {
      members: {
        fetch: vi.fn(() => Promise.resolve(member)),
      },
    },
  } as unknown as ChatInputCommandInteraction;
}

describe("ModGuardService - canModerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows administrators without a configured mod role", async () => {
    mockGetGuildConfig.mockResolvedValue({ modRoleId: null });
    const interaction = createModerationInteraction({ isAdmin: true, hasModRole: false });

    const result = await canModerate(interaction, MODERATION_ACTION.BAN);

    expect(result).toEqual({ allowed: true });
  });

  it("allows administrators even when a mod role is configured", async () => {
    mockGetGuildConfig.mockResolvedValue({ modRoleId: "mod-role" });
    const interaction = createModerationInteraction({ isAdmin: true, hasModRole: false });

    const result = await canModerate(interaction, MODERATION_ACTION.BAN);

    expect(result).toEqual({ allowed: true });
  });

  it("allows role-based warn without extra native permission", async () => {
    mockGetGuildConfig.mockResolvedValue({ modRoleId: "mod-role" });
    const interaction = createModerationInteraction({ hasModRole: true });

    const result = await canModerate(interaction, MODERATION_ACTION.WARN);

    expect(result).toEqual({ allowed: true });
  });

  it("blocks timeout when moderator lacks ModerateMembers", async () => {
    mockGetGuildConfig.mockResolvedValue({ modRoleId: "mod-role" });
    const interaction = createModerationInteraction({ hasModRole: true });

    const result = await canModerate(interaction, MODERATION_ACTION.TIMEOUT);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Moderate Members");
  });

  it("allows timeout when moderator has ModerateMembers", async () => {
    mockGetGuildConfig.mockResolvedValue({ modRoleId: "mod-role" });
    const interaction = createModerationInteraction({
      hasModRole: true,
      permissions: [PermissionFlagsBits.ModerateMembers],
    });

    const result = await canModerate(interaction, MODERATION_ACTION.TIMEOUT);

    expect(result).toEqual({ allowed: true });
  });

  it("blocks ban when moderator lacks BanMembers", async () => {
    mockGetGuildConfig.mockResolvedValue({ modRoleId: "mod-role" });
    const interaction = createModerationInteraction({ hasModRole: true });

    const result = await canModerate(interaction, MODERATION_ACTION.BAN);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Ban Members");
  });

  it("blocks kick when moderator lacks KickMembers", async () => {
    mockGetGuildConfig.mockResolvedValue({ modRoleId: "mod-role" });
    const interaction = createModerationInteraction({ hasModRole: true });

    const result = await canModerate(interaction, MODERATION_ACTION.KICK);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Kick Members");
  });

  it("allows kick when moderator has KickMembers", async () => {
    mockGetGuildConfig.mockResolvedValue({ modRoleId: "mod-role" });
    const interaction = createModerationInteraction({
      hasModRole: true,
      permissions: [PermissionFlagsBits.KickMembers],
    });

    const result = await canModerate(interaction, MODERATION_ACTION.KICK);

    expect(result).toEqual({ allowed: true });
  });

  it("blocks unban when moderator lacks BanMembers", async () => {
    mockGetGuildConfig.mockResolvedValue({ modRoleId: "mod-role" });
    const interaction = createModerationInteraction({ hasModRole: true });

    const result = await canModerate(interaction, MODERATION_ACTION.UNBAN);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Ban Members");
  });

  it("allows unban when moderator has BanMembers", async () => {
    mockGetGuildConfig.mockResolvedValue({ modRoleId: "mod-role" });
    const interaction = createModerationInteraction({
      hasModRole: true,
      permissions: [PermissionFlagsBits.BanMembers],
    });

    const result = await canModerate(interaction, MODERATION_ACTION.UNBAN);

    expect(result).toEqual({ allowed: true });
  });
});

describe("ModGuardService - canTargetModerator", () => {
  it("allows moderation when mod has higher role", () => {
    const mod = createMockMember("mod-1", 10);
    const target = createMockMember("target-1", 5);

    const result = canTargetModerator(mod, target);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("blocks moderation when target has equal role", () => {
    const mod = createMockMember("mod-1", 10);
    const target = createMockMember("target-1", 10);

    const result = canTargetModerator(mod, target);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("igual o superior");
  });

  it("blocks moderation when target has higher role", () => {
    const mod = createMockMember("mod-1", 5);
    const target = createMockMember("target-1", 10);

    const result = canTargetModerator(mod, target);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("igual o superior");
  });
});

describe("ModGuardService - canTargetSelf", () => {
  it("blocks self-moderation", () => {
    const result = canTargetSelf("user-1", "user-1");

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("vos mismo");
  });

  it("allows targeting different users", () => {
    const result = canTargetSelf("user-1", "user-2");

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

describe("ModGuardService - canBotAct", () => {
  it("allows bot action when bot has higher role", () => {
    const bot = createMockMember("bot-1", 15);
    const target = createMockMember("target-1", 5);

    const result = canBotAct(bot, target);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("blocks bot action when target has equal role", () => {
    const bot = createMockMember("bot-1", 10);
    const target = createMockMember("target-1", 10);

    const result = canBotAct(bot, target);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("igual o superior");
  });

  it("blocks bot action when target has higher role", () => {
    const bot = createMockMember("bot-1", 5);
    const target = createMockMember("target-1", 15);

    const result = canBotAct(bot, target);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("igual o superior");
  });
});
