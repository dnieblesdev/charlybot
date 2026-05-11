import { describe, it, expect } from "vitest";
import {
  canTargetModerator,
  canTargetSelf,
  canBotAct,
} from "../../src/app/services/ModGuardService";
import type { GuildMember, Role } from "discord.js";

// Helper to create a mock GuildMember with a role hierarchy
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
