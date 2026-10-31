// Shared, dependency-free auto-delete constants for circles-only posts/clips
// — imported by both the Convex functions (which validate against them) and
// the screens (which render them), same pattern as adPricing.ts /
// moderationOptions.ts / pollOptions.ts.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type ExpiryPresetKey = '1d' | '3d' | '7d' | '30d' | '60d' | 'custom';

export const EXPIRY_PRESETS: { key: ExpiryPresetKey; label: string; ms: number | null }[] = [
  { key: '1d', label: '1 day', ms: DAY },
  { key: '3d', label: '3 days', ms: 3 * DAY },
  { key: '7d', label: '7 days', ms: 7 * DAY },
  { key: '30d', label: '30 days', ms: 30 * DAY },
  { key: '60d', label: '60 days', ms: 60 * DAY },
  { key: 'custom', label: 'Custom', ms: null },
];

// A floor so a fat-fingered "0 minutes" custom duration can't insta-delete a
// post the moment it's posted, and a ceiling matching the largest preset so
// "custom" can't quietly promise something the product doesn't otherwise
// support.
export const MIN_EXPIRY_MS = 5 * MINUTE;
export const MAX_EXPIRY_MS = 60 * DAY;

export function customExpiryMs(days: number, hours: number, minutes: number): number {
  return days * DAY + hours * HOUR + minutes * MINUTE;
}

export function clampExpiryMs(ms: number): number {
  return Math.min(MAX_EXPIRY_MS, Math.max(MIN_EXPIRY_MS, ms));
}
