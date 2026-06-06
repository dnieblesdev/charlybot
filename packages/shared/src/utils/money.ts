import { z } from "zod";

declare const moneyAmountBrand: unique symbol;

export type MoneyAmount = number & { readonly [moneyAmountBrand]: "MoneyAmount" };

export const MoneyAmountSchema = z
  .number()
  .int("Money amount must be an integer")
  .finite("Money amount must be finite");

export const NonNegativeMoneyAmountSchema = MoneyAmountSchema.min(0, "Money amount cannot be negative");

export const PositiveMoneyAmountSchema = MoneyAmountSchema.positive("Money amount must be greater than zero");

export function toMoneyAmount(value: number): MoneyAmount {
  if (!Number.isFinite(value)) {
    throw new TypeError("Money amount must be finite");
  }

  return Math.round(value) as MoneyAmount;
}

export function assertMoneyAmount(value: number): MoneyAmount {
  return MoneyAmountSchema.parse(value) as MoneyAmount;
}

export function assertNonNegativeMoneyAmount(value: number): MoneyAmount {
  return NonNegativeMoneyAmountSchema.parse(value) as MoneyAmount;
}

export function toNonNegativeMoneyAmount(value: number): MoneyAmount {
  if (!Number.isFinite(value)) {
    throw new TypeError("Money amount must be finite");
  }

  if (value < 0) {
    throw new RangeError("Money amount cannot be negative");
  }

  return assertNonNegativeMoneyAmount(Math.round(value));
}

export function calculatePercentageAmount(
  baseAmount: number,
  percentage: number,
): MoneyAmount {
  if (!Number.isFinite(baseAmount) || !Number.isFinite(percentage)) {
    throw new TypeError("Money percentage inputs must be finite");
  }

  return toMoneyAmount(baseAmount * percentage);
}

export interface FormatMoneyOptions {
  locale?: string;
  prefix?: string;
  suffix?: string;
  useGrouping?: boolean;
}

export function formatMoney(
  amount: number,
  options: FormatMoneyOptions = {},
): string {
  const normalizedAmount = assertMoneyAmount(amount);
  const {
    locale = "en-US",
    prefix = "",
    suffix = "",
    useGrouping = true,
  } = options;

  const absoluteFormatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    useGrouping,
  }).format(Math.abs(normalizedAmount));

  const sign = normalizedAmount < 0 ? "-" : "";
  return `${sign}${prefix}${absoluteFormatted}${suffix}`;
}
