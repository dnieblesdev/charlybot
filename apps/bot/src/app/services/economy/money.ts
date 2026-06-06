import {
  assertMoneyAmount,
  calculatePercentageAmount,
  formatMoney,
} from "@charlybot/shared";

export function formatEconomyAmount(amount: number): string {
  return formatMoney(amount, { prefix: "$" });
}

export function calculateWholeAmountPercentage(
  amount: number,
  percentage: number,
): number {
  return calculatePercentageAmount(assertMoneyAmount(amount), percentage);
}

export function calculateNetProfitSnapshot(
  totalEarned: number,
  totalLost: number,
): number {
  return assertMoneyAmount(
    assertMoneyAmount(totalEarned) - assertMoneyAmount(totalLost),
  );
}
