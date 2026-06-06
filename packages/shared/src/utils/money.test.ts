import { describe, expect, it } from "vitest";

import {
  MoneyAmountSchema,
  PositiveMoneyAmountSchema,
  assertMoneyAmount,
  assertNonNegativeMoneyAmount,
  calculatePercentageAmount,
  formatMoney,
  toNonNegativeMoneyAmount,
  toMoneyAmount,
} from "./money";

describe("money utilities", () => {
  it("normalizes decimal inputs to whole amounts using round-half-up", () => {
    expect(toMoneyAmount(12.49)).toBe(12);
    expect(toMoneyAmount(12.5)).toBe(13);
  });

  it("rejects non-integer persisted money amounts", () => {
    expect(() => assertMoneyAmount(10)).not.toThrow();
    expect(() => assertMoneyAmount(10.5)).toThrow("Money amount must be an integer");
  });

  it("rejects negative inputs for non-negative whole amounts before rounding", () => {
    expect(toNonNegativeMoneyAmount(12.6)).toBe(13);
    expect(assertNonNegativeMoneyAmount(0)).toBe(0);
    expect(() => toNonNegativeMoneyAmount(-0.4)).toThrow("Money amount cannot be negative");
  });

  it("rounds percentage-derived amounts to whole integers", () => {
    expect(calculatePercentageAmount(105, 0.1)).toBe(11);
    expect(calculatePercentageAmount(250, 0.25)).toBe(63);
  });

  it("formats whole amounts without forcing decimal places", () => {
    expect(formatMoney(12345)).toBe("12,345");
    expect(formatMoney(-500, { prefix: "$" })).toBe("-$500");
  });

  it("exposes reusable integer money schemas", () => {
    expect(MoneyAmountSchema.parse(0)).toBe(0);
    expect(PositiveMoneyAmountSchema.parse(1)).toBe(1);
    expect(() => MoneyAmountSchema.parse(1.2)).toThrow();
    expect(() => PositiveMoneyAmountSchema.parse(0)).toThrow();
  });
});
