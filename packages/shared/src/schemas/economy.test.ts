import { describe, expect, it } from "vitest";

import {
  EconomyConfigSchema,
  LeaderboardUpsertSchema,
  RouletteBetSchema,
  UserEconomySchema,
} from "./economy";

describe("economy schemas", () => {
  it("accepts whole integer money amounts", () => {
    const parsed = UserEconomySchema.parse({
      userId: "user-1",
      guildId: "guild-1",
      username: "Charly",
      pocket: 100,
      totalEarned: 250,
      totalLost: 40,
    });

    expect(parsed.pocket).toBe(100);
    expect(parsed.totalEarned).toBe(250);
    expect(parsed.totalLost).toBe(40);
  });

  it("rejects decimal user economy amounts", () => {
    const result = UserEconomySchema.safeParse({
      userId: "user-1",
      guildId: "guild-1",
      username: "Charly",
      pocket: 100.5,
      totalEarned: 250,
      totalLost: 40,
    });

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path.join("."))).toContain("pocket");
  });

  it("rejects decimal roulette bets and leaderboard cache totals", () => {
    const roulette = RouletteBetSchema.safeParse({
      userId: "user-1",
      guildId: "guild-1",
      amount: 20.25,
      betType: "color",
      betValue: "red",
    });
    const leaderboard = LeaderboardUpsertSchema.safeParse({
      userId: "user-1",
      guildId: "guild-1",
      username: "Charly",
      totalMoney: 99.9,
      joinedServerAt: new Date(),
    });

    expect(roulette.success).toBe(false);
    expect(leaderboard.success).toBe(false);
  });

  it("rejects decimal config values for integer-backed economy settings", () => {
    const baseConfig = {
      guildId: "guild-1",
      workCooldown: 300000,
      crimeCooldown: 900000,
      robCooldown: 1800000,
      workMinAmount: 100,
      workMaxAmount: 300,
      crimeMultiplier: 3,
      startingMoney: 1000,
      jailTimeWork: 30,
      jailTimeRob: 45,
    };

    const decimalCases = [
      "workCooldown",
      "crimeCooldown",
      "robCooldown",
      "workMinAmount",
      "workMaxAmount",
      "crimeMultiplier",
      "startingMoney",
      "jailTimeWork",
      "jailTimeRob",
    ] as const;

    for (const field of decimalCases) {
      const result = EconomyConfigSchema.safeParse({
        ...baseConfig,
        [field]: baseConfig[field] + 0.5,
      });

      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues.map((issue) => issue.path.join("."))).toContain(field);
    }
  });

  it("accepts signed whole leaderboard net profit amounts", () => {
    const leaderboard = LeaderboardUpsertSchema.safeParse({
      userId: "user-1",
      guildId: "guild-1",
      username: "Charly",
      totalMoney: -25,
      joinedServerAt: new Date(),
    });

    expect(leaderboard.success).toBe(true);
    expect(leaderboard.success ? leaderboard.data.totalMoney : null).toBe(-25);
  });

  it("rejects negative roulette win amounts while keeping leaderboard totals signed", () => {
    const roulette = RouletteBetSchema.safeParse({
      userId: "user-1",
      guildId: "guild-1",
      amount: 20,
      betType: "color",
      betValue: "red",
      winAmount: -1,
    });
    const leaderboard = LeaderboardUpsertSchema.safeParse({
      userId: "user-1",
      guildId: "guild-1",
      username: "Charly",
      totalMoney: -25,
      joinedServerAt: new Date(),
    });

    expect(roulette.success).toBe(false);
    expect(leaderboard.success).toBe(true);
  });
});
