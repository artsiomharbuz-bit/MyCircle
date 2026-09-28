// Central rate-limit policy for the whole backend — every mutation that
// writes on a user's behalf (or costs storage/compute) should be listed
// here and gated with `await rateLimiter.limit(ctx, "name", { key, throws:
// true })` as the first line of its handler, so a single call site can't
// forget to define reasonable numbers.
//
// "key" is almost always the acting user's id (per-account limiting) — a
// couple of auth-adjacent limits below are keyed by email instead (they run
// before we know who's calling) plus an unkeyed global bucket as a blunt
// backstop against distributed signup/credential-stuffing bots.
import { RateLimiter, MINUTE, HOUR, DAY } from '@convex-dev/rate-limiter';
import { components } from '../_generated/api';

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // ---- Auth — no account exists yet to key these by, so email (register)
  // or the attempted email (login, to slow credential stuffing against one
  // target) stand in, backed by a coarse global bucket either way. ----
  registerByEmail: { kind: 'fixed window', rate: 3, period: HOUR },
  registerGlobal: { kind: 'token bucket', rate: 60, period: MINUTE, capacity: 20 },
  loginByEmail: { kind: 'fixed window', rate: 8, period: 15 * MINUTE },
  loginGlobal: { kind: 'token bucket', rate: 120, period: MINUTE, capacity: 40 },
  modUnlock: { kind: 'fixed window', rate: 5, period: 15 * MINUTE },

  // ---- Content creation ----
  createPost: { kind: 'token bucket', rate: 10, period: HOUR, capacity: 4 },
  createStory: { kind: 'token bucket', rate: 15, period: HOUR, capacity: 5 },
  createHighlight: { kind: 'fixed window', rate: 15, period: DAY },
  createRemix: { kind: 'token bucket', rate: 15, period: HOUR, capacity: 5 },
  createAd: { kind: 'fixed window', rate: 10, period: DAY },
  addComment: { kind: 'token bucket', rate: 30, period: 10 * MINUTE, capacity: 8 },
  sendMessage: { kind: 'token bucket', rate: 30, period: MINUTE, capacity: 10 },
  sendGroupMessage: { kind: 'token bucket', rate: 30, period: MINUTE, capacity: 10 },
  generateUploadUrl: { kind: 'token bucket', rate: 30, period: HOUR, capacity: 10 },

  // ---- Lightweight social actions — generous, but not unlimited ----
  toggleLike: { kind: 'token bucket', rate: 60, period: MINUTE, capacity: 20 },
  toggleBookmark: { kind: 'token bucket', rate: 60, period: MINUTE, capacity: 20 },
  follow: { kind: 'token bucket', rate: 30, period: MINUTE, capacity: 10 },
  createCircle: { kind: 'fixed window', rate: 10, period: DAY },
  createGroup: { kind: 'fixed window', rate: 10, period: DAY },
  inviteToCircle: { kind: 'token bucket', rate: 30, period: 10 * MINUTE, capacity: 10 },

  // ---- Abuse-sensitive / trust & safety surfaces ----
  report: { kind: 'token bucket', rate: 10, period: HOUR, capacity: 5 },
  blockUser: { kind: 'token bucket', rate: 20, period: MINUTE, capacity: 10 },
});

// `search` is deliberately not in the table above: it's a reactive `query`
// (Convex re-runs it on every keystroke's new args, not a one-shot RPC), so
// throwing on it the way `limit()` does would surface as a persistent error
// in the search box rather than real abuse prevention. If search ever needs
// protecting, it should be `.check()` (non-consuming) client-side debounced,
// not `.limit()`.
