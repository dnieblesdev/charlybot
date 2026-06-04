import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client, Guild, GuildMember, User } from "discord.js";
import type { IModCase } from "@charlybot/shared";

const mockLogModAction = vi.fn();
const mockCountActiveWarns = vi.fn();
const mockCreateModCase = vi.fn();
const mockFindByWarnCount = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
vi.mock("../../src/app/services/ModLogService.js", () => ({
  logModAction: (...args: unknown[]) => mockLogModAction(...args),
}));

vi.mock("../../src/config/repositories/modCaseRepository.js", () => ({
  countActiveWarns: (...args: unknown[]) => mockCountActiveWarns(...args),
  create: (...args: unknown[]) => mockCreateModCase(...args),
}));

vi.mock("../../src/config/repositories/warnThresholdRepository.js", () => ({
  findByWarnCount: (...args: unknown[]) => mockFindByWarnCount(...args),
}));

vi.mock("../../src/utils/logger.js", () => ({
  default: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: vi.fn(),
  },
}));

const { enforceWarnThreshold } = await import("../../src/app/services/WarnThresholdService.js");

const ESCALATION_CASE: IModCase = {
  id: 99,
  guildId: "guild-1",
  userId: "target-1",
  moderatorId: "mod-1",
  caseNumber: 43,
  type: "timeout",
  reason: "Threshold automático por 3 warns (timeout por 1h)",
  duration: BigInt(3_600_000),
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createContext() {
  const targetUser = {
    id: "target-1",
    username: "TargetUser",
  } as unknown as User;

  const targetMember = {
    timeout: vi.fn(() => Promise.resolve()),
    kick: vi.fn(() => Promise.resolve()),
  } as unknown as GuildMember;

  const guild = {
    name: "Test Guild",
    bans: {
      create: vi.fn(() => Promise.resolve()),
    },
  } as unknown as Guild;

  const client = {} as Client;

  return {
    client,
    guild,
    guildId: "guild-1",
    targetMember,
    targetUser,
    moderatorId: "mod-1",
    moderatorTag: "ModUser",
    userTag: "TargetUser",
  };
}

describe("WarnThresholdService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateModCase.mockResolvedValue(ESCALATION_CASE);
    mockLogModAction.mockResolvedValue(undefined);
  });

  it("returns warn-only when no threshold is configured for the new warn count", async () => {
    mockCountActiveWarns.mockResolvedValue(2);
    mockFindByWarnCount.mockResolvedValue(null);
    const context = createContext();
    const result = await enforceWarnThreshold(context);

    expect(mockCountActiveWarns).toHaveBeenCalledWith("guild-1", "target-1");
    expect(mockFindByWarnCount).toHaveBeenCalledWith("guild-1", 2);
    expect(result).toEqual({ matched: false });
    expect(mockCreateModCase).not.toHaveBeenCalled();
    expect(mockLogModAction).not.toHaveBeenCalled();
  });

  it("applies the configured threshold action after warn creation", async () => {
    mockCountActiveWarns.mockResolvedValue(3);
    mockFindByWarnCount.mockResolvedValue({
      id: 10,
      guildId: "guild-1",
      warnCount: 3,
      action: "timeout",
      duration: BigInt(3_600_000),
    });
    const context = createContext();
    const result = await enforceWarnThreshold(context);

    expect(context.targetMember.timeout).toHaveBeenCalledWith(
      3_600_000,
      expect.stringContaining("Threshold automático"),
    );
    expect(mockCreateModCase).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: "guild-1",
        userId: "target-1",
        moderatorId: "mod-1",
        type: "timeout",
        duration: BigInt(3_600_000),
      }),
    );
    expect(mockLogModAction).toHaveBeenCalledWith(
      context.client,
      "guild-1",
      ESCALATION_CASE,
      "ModUser",
      "TargetUser",
    );
    expect(result).toEqual({
      matched: true,
      action: "timeout",
      ok: true,
      message: "Threshold aplicado: timeout por 1h.",
    });
  });

  it("returns partial failure details when escalation cannot be completed", async () => {
    mockCountActiveWarns.mockResolvedValue(3);
    mockFindByWarnCount.mockResolvedValue({
      id: 11,
      guildId: "guild-1",
      warnCount: 3,
      action: "kick",
    });
    const context = createContext();
    context.targetMember.kick = vi.fn(() => Promise.reject(new Error("Missing Permissions")));
    const result = await enforceWarnThreshold(context);

    expect(context.targetMember.kick).toHaveBeenCalledWith(expect.stringContaining("Threshold automático"));
    expect(mockCreateModCase).not.toHaveBeenCalled();
    expect(mockLogModAction).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Warn threshold escalation failed",
      expect.objectContaining({ action: "kick", error: "Missing Permissions" }),
    );
    expect(result).toEqual({
      matched: true,
      action: "kick",
      ok: false,
      error: "Missing Permissions",
      message: "la escalada automática (kick) falló: Missing Permissions",
    });
  });

  it("reports successful escalation separately from mod-log failure", async () => {
    mockCountActiveWarns.mockResolvedValue(3);
    mockFindByWarnCount.mockResolvedValue({
      id: 12,
      guildId: "guild-1",
      warnCount: 3,
      action: "timeout",
      duration: BigInt(3_600_000),
    });
    mockLogModAction.mockRejectedValue(new Error("Channel missing"));
    const context = createContext();
    const result = await enforceWarnThreshold(context);

    expect(context.targetMember.timeout).toHaveBeenCalledWith(
      3_600_000,
      expect.stringContaining("Threshold automático"),
    );
    expect(mockCreateModCase).toHaveBeenCalledWith(
      expect.objectContaining({ type: "timeout" }),
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Warn threshold log failed after successful escalation",
      expect.objectContaining({ action: "timeout", error: "Channel missing" }),
    );
    expect(result).toEqual({
      matched: true,
      action: "timeout",
      ok: true,
      logFailed: true,
      error: "Channel missing",
      message: "Threshold aplicado: timeout por 1h, pero falló el registro en el canal de moderación: Channel missing",
    });
  });

  it("reports successful escalation separately from case creation failure", async () => {
    mockCountActiveWarns.mockResolvedValue(3);
    mockFindByWarnCount.mockResolvedValue({
      id: 13,
      guildId: "guild-1",
      warnCount: 3,
      action: "kick",
    });
    mockCreateModCase.mockRejectedValue(new Error("Database unavailable"));
    const context = createContext();
    const result = await enforceWarnThreshold(context);

    expect(context.targetMember.kick).toHaveBeenCalledWith(expect.stringContaining("Threshold automático"));
    expect(mockLogModAction).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Warn threshold case creation failed after successful escalation",
      expect.objectContaining({ action: "kick", error: "Database unavailable" }),
    );
    expect(result).toEqual({
      matched: true,
      action: "kick",
      ok: true,
      caseFailed: true,
      error: "Database unavailable",
      message: "Threshold aplicado: kick, pero falló la creación del caso de moderación: Database unavailable",
    });
  });
});
