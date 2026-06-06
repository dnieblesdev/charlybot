import { describe, expect, it } from "vitest";
import {
  calculateNetProfitSnapshot,
  calculateWholeAmountPercentage,
  formatEconomyAmount,
} from "../../src/app/services/economy/money.js";

describe("economy money helpers", () => {
  it("formats whole amounts without decimal places", () => {
    expect(formatEconomyAmount(1234)).toBe("$1,234");
    expect(formatEconomyAmount(0)).toBe("$0");
  });

  it("formats negative leaderboard snapshots consistently", () => {
    expect(formatEconomyAmount(-75)).toBe("-$75");
  });

  it("rounds percentage-derived amounts to whole integers", () => {
    expect(calculateWholeAmountPercentage(101, 0.5)).toBe(51);
    expect(calculateWholeAmountPercentage(333, 0.2)).toBe(67);
  });

  it("keeps leaderboard snapshot values signed integers", () => {
    expect(calculateNetProfitSnapshot(500, 900)).toBe(-400);
    expect(calculateNetProfitSnapshot(901, 900)).toBe(1);
  });
});
