// Shared, dependency-free moderation constants — imported by both the Convex
// functions (which validate against them) and the screens (which render
// them), so a duration or reason can never drift between the two.

// Sentinel for a sanction that never expires. Stored in place of a timestamp
// in users.restrictedUntil / users.bannedUntil.
export const FOREVER = -1;

// The one account that can appoint and revoke moderators, and that no
// moderator action can ever touch. Matched case-insensitively on username.
export const MAIN_ADMIN_USERNAME = 'artsiomharbuz';

// A user is banned forever once they collect this many strikes.
export const MAX_STRIKES = 3;

const DAY = 24 * 60 * 60 * 1000;

export type DurationKey = '1d' | '7d' | '14d' | '30d' | '1y' | 'forever';

export const DURATIONS: { key: DurationKey; label: string; ms: number }[] = [
  { key: '1d', label: '1 day', ms: DAY },
  { key: '7d', label: '7 days', ms: 7 * DAY },
  { key: '14d', label: '14 days', ms: 14 * DAY },
  { key: '30d', label: '30 days', ms: 30 * DAY },
  { key: '1y', label: '1 year', ms: 365 * DAY },
  { key: 'forever', label: 'Forever', ms: FOREVER },
];

export function durationLabel(key: DurationKey): string {
  return DURATIONS.find((d) => d.key === key)?.label ?? key;
}

// Resolves a duration choice to the absolute expiry stored on the user row.
export function expiryFor(key: DurationKey, now: number): number {
  const duration = DURATIONS.find((d) => d.key === key);
  if (!duration || duration.ms === FOREVER) return FOREVER;
  return now + duration.ms;
}

// Whether a stored expiry is still in force right now.
export function isSanctionActive(until: number | undefined): boolean {
  if (until === undefined) return false;
  return until === FOREVER || until > Date.now();
}

export function formatSanctionExpiry(until: number | undefined): string {
  if (until === undefined) return '';
  if (until === FOREVER) return 'permanently';
  return `until ${new Date(until).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

// A short countdown for however long is left on a restriction or ban — what
// the moderation menu and the account's own "you're restricted" notice show
// instead of (or alongside) the flat expiry date.
export function formatTimeLeft(until: number | undefined): string {
  if (until === undefined) return '';
  if (until === FOREVER) return 'Forever';

  const remainingMs = until - Date.now();
  if (remainingMs <= 0) return 'Expired';

  const days = Math.floor(remainingMs / DAY);
  const hours = Math.floor((remainingMs % DAY) / HOUR);
  const minutes = Math.floor((remainingMs % HOUR) / MINUTE);

  if (days >= 1) {
    return hours > 0 ? `${days}d ${hours}h left` : `${days}d left`;
  }
  if (hours >= 1) {
    return minutes > 0 ? `${hours}h ${minutes}m left` : `${hours}h left`;
  }
  if (minutes >= 1) return `${minutes}m left`;
  return 'Less than a minute left';
}

// The fixed menu shown after tapping Report on a post or clip. Profile
// reports take free text instead, so they have no list here.
export const POST_REPORT_REASONS = [
  'Nudity or sexual content',
  'Violence or dangerous acts',
  'Hate speech or symbols',
  'Bullying or harassment',
  'False information',
  'Scam or fraud',
  'Spam',
  'Intellectual property violation',
  'Something else',
];

export const SOUND_REPORT_REASONS = [
  'Copyright or intellectual property violation',
  'Offensive or hateful content',
  'Misleading name or attribution',
  'Spam',
  'Something else',
];
