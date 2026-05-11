import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageFlags } from "discord.js";
import type { UserContextMenuCommandInteraction, Guild, GuildMember, User, Client } from "discord.js";

// =============================================================================
// Mock functions — defined before vi.mock() hoisting
// =============================================================================

const mockCanModerate = vi.fn(() => Promise.resolve({ allowed: true }));
const mockCanTargetSelf = vi.fn(() => ({ allowed: true }));
const mockCanTargetModerator = vi.fn(() => ({ allowed: true }));
const mockCanBotAct = vi.fn(() => ({ allowed: true }));
const mockLogModAction = vi.fn(() => Promise.resolve());
const mockModCaseCreate = vi.fn(() =>
  Promise.resolve({
    id: 1,
    caseNumber: 1,
    type: "warn",
    reason: "Sin razón (context menu)",
    guildId: "guild-123",
    userId: "target-456",
    moderatorId: "mod-789",
    active: true,
  }),
);

// =============================================================================
// vi.mock() — hoisted, runs BEFORE imports
// =============================================================================

vi.mock("../../../src/app/services/ModGuardService.js", () => ({
  canModerate: (...args: unknown[]) => mockCanModerate(...args),
  canTargetSelf: (...args: unknown[]) => mockCanTargetSelf(...args),
  canTargetModerator: (...args: unknown[]) => mockCanTargetModerator(...args),
  canBotAct: (...args: unknown[]) => mockCanBotAct(...args),
}));

vi.mock("../../../src/app/services/ModLogService.js", () => ({
  logModAction: (...args: unknown[]) => mockLogModAction(...args),
}));

vi.mock("../../../src/config/repositories/modCaseRepository.js", () => ({
  create: (...args: unknown[]) => mockModCaseCreate(...args),
}));

vi.mock("../../../src/utils/logger.js", () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// =============================================================================
// Import commands under test (after mocks are set up)
// =============================================================================

const { execute: executeWarn, data: dataWarn } = await import(
  "../../../src/app/commands/context-menus/mod/warn-user.js"
);
const { execute: executeBan, data: dataBan } = await import(
  "../../../src/app/commands/context-menus/mod/ban-user.js"
);
const { execute: executeKick, data: dataKick } = await import(
  "../../../src/app/commands/context-menus/mod/kick-user.js"
);
const { execute: executeTimeout, data: dataTimeout } = await import(
  "../../../src/app/commands/context-menus/mod/timeout-user.js"
);

import type { UserContextMenuCommandInteraction, Guild, GuildMember, User, Client } from "discord.js";

function createMockContextInteraction(overrides?: {
  userId?: string;
  guildId?: string;
  targetUserId?: string;
  targetUsername?: string;
  guildName?: string;
}): UserContextMenuCommandInteraction {
  const userId = overrides?.userId ?? "mod-789";
  const guildId = overrides?.guildId ?? "guild-123";
  const targetUserId = overrides?.targetUserId ?? "target-456";
  const targetUsername = overrides?.targetUsername ?? "TargetUser";
  const guildName = overrides?.guildName ?? "Test Guild";

  const targetUser = {
    id: targetUserId,
    username: targetUsername,
    send: vi.fn(() => Promise.resolve()),
  } as unknown as User;

  const targetMember = {
    ban: vi.fn(() => Promise.resolve()),
    kick: vi.fn(() => Promise.resolve()),
    timeout: vi.fn(() => Promise.resolve()),
    roles: { cache: { has: vi.fn(() => false) }, highest: { position: 2 } },
    user: { id: targetUserId, username: targetUsername },
  } as unknown as GuildMember;

  const modMember = {
    roles: { cache: { has: vi.fn(() => true) }, highest: { position: 10 } },
    permissions: { has: vi.fn(() => true) },
    user: { username: "ModUser" },
  } as unknown as GuildMember;

  const fetchMock = vi.fn((id: string) => {
    if (id === targetUserId) return Promise.resolve(targetMember);
    return Promise.resolve(modMember);
  });

  const guild = {
    id: guildId,
    name: guildName,
    members: { fetch: fetchMock },
  } as unknown as Guild;

  return {
    user: { id: userId, username: "ModUser" },
    guildId,
    guild,
    targetUser,
    client: {} as Client,
    deferReply: vi.fn(() => Promise.resolve()),
    editReply: vi.fn(() => Promise.resolve()),
  } as unknown as UserContextMenuCommandInteraction;
}

describe("Context Menu Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Warn User", () => {
    it("has correct command data", () => {
      expect(dataWarn.name).toBe("Warn User");
      expect(dataWarn.type).toBe(2); // ApplicationCommandType.User
    });

    it("executes warn successfully", async () => {
      const interaction = createMockContextInteraction();
      await executeWarn(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({
        flags: [MessageFlags.Ephemeral],
      });
      expect(mockModCaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "warn",
          reason: "Sin razón (context menu)",
          guildId: "guild-123",
          userId: "target-456",
          moderatorId: "mod-789",
        }),
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("advertido"),
        }),
      );
    });

    it("rejects self-moderation", async () => {
      mockCanTargetSelf.mockReturnValue({
        allowed: false,
        reason: "No podés moderarte a vos mismo",
      });

      const interaction = createMockContextInteraction({
        userId: "target-456",
        targetUserId: "target-456",
      });
      await executeWarn(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: "❌ No podés moderarte a vos mismo",
      });
      expect(mockModCaseCreate).not.toHaveBeenCalled();
    });

    it("rejects when user lacks mod permissions", async () => {
      mockCanModerate.mockReturnValue({
        allowed: false,
        reason: "No tenés permisos de moderador",
      });

      const interaction = createMockContextInteraction();
      await executeWarn(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: "❌ No tenés permisos de moderador",
      });
    });
  });

  describe("Ban User", () => {
    it("has correct command data", () => {
      expect(dataBan.name).toBe("Ban User");
      expect(dataBan.type).toBe(2);
    });

    it("executes ban successfully", async () => {
      const interaction = createMockContextInteraction();
      await executeBan(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({
        flags: [MessageFlags.Ephemeral],
      });
      expect(mockModCaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ban",
          reason: "Sin razón (context menu)",
        }),
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("baneado"),
        }),
      );
    });
  });

  describe("Kick User", () => {
    it("has correct command data", () => {
      expect(dataKick.name).toBe("Kick User");
      expect(dataKick.type).toBe(2);
    });

    it("executes kick successfully", async () => {
      const interaction = createMockContextInteraction();
      await executeKick(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({
        flags: [MessageFlags.Ephemeral],
      });
      expect(mockModCaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "kick",
          reason: "Sin razón (context menu)",
        }),
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("expulsado"),
        }),
      );
    });
  });

  describe("Timeout User", () => {
    it("has correct command data", () => {
      expect(dataTimeout.name).toBe("Timeout User");
      expect(dataTimeout.type).toBe(2);
    });

    it("executes timeout with 1 hour default", async () => {
      const interaction = createMockContextInteraction();
      await executeTimeout(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({
        flags: [MessageFlags.Ephemeral],
      });
      expect(mockModCaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "timeout",
          reason: "Sin razón (context menu)",
          duration: BigInt(60 * 60 * 1000), // 1 hour
        }),
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("silenciado por 1 hora"),
        }),
      );
    });
  });
});
