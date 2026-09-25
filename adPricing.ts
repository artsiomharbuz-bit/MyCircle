// Shared, dependency-free ad pricing constants — imported by both the Convex
// functions (which validate against them) and the screens (which render
// them), same pattern as moderationOptions.ts.

export type AdKind = 'post' | 'clip';

export const AD_DAILY_PRICE: Record<AdKind, number> = {
  post: 7,
  clip: 10,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHLY_DISCOUNT = 0.1;

export function adDailyPrice(kind: AdKind): number {
  return AD_DAILY_PRICE[kind];
}

// 30 days at the daily rate, minus 10% — the "-10% then pay daily" plan.
export function adMonthlyPrice(kind: AdKind): number {
  return Math.round(AD_DAILY_PRICE[kind] * 30 * (1 - MONTHLY_DISCOUNT) * 100) / 100;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function activePeriodMs(plan: 'daily' | 'monthly'): number {
  return plan === 'daily' ? DAY_MS : 30 * DAY_MS;
}

export const AD_KIND_LABEL: Record<AdKind, string> = {
  post: 'Post ad',
  clip: 'Clip ad',
};
