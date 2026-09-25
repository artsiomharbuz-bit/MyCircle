// Real, server-verified sessions — replaces the old model where every
// mutation/query just trusted whatever `userId` the client happened to send
// as its own identity. Login/register (see ../auth.ts) mint a token here;
// every mutation/query that acts "as" a user now calls `requireUser` with
// that token before doing anything, the same way moderator-only actions
// already required a separate password-backed token (see moderation.ts's
// requireUnlockedModerator, which this mirrors).
import { ConvexError } from 'convex/values';
import { Doc, Id } from '../_generated/dataModel';
import { MutationCtx, QueryCtx } from '../_generated/server';

const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

// 256 bits from the platform CSPRNG. Web Crypto (`crypto.getRandomValues`)
// is available in both Convex's default V8 runtime and the 'use node'
// action runtime, so this one function works from either — no need to
// special-case actions the way bcrypt (a real Node dependency) does.
export function createSessionToken(): string {
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (!webCrypto?.getRandomValues) {
    throw new ConvexError('Secure random numbers are unavailable on the server.');
  }
  const bytes = new Uint8Array(32);
  webCrypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function sessionExpiry(now: number = Date.now()): number {
  return now + SESSION_TTL_MS;
}

// Verifies that `token` really is a live session belonging to `claimedUserId`
// — throws if not. Every mutation/query that takes e.g. `viewerId` or
// `senderId` as "the user performing this action" should take a matching
// `sessionToken` arg and call this first, so that id can no longer just be
// asserted by whoever's calling.
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  claimedUserId: Id<'users'>,
  sessionToken: string
): Promise<Doc<'users'>> {
  const session = await ctx.db
    .query('userSessions')
    .withIndex('by_token', (q) => q.eq('token', sessionToken))
    .unique();

  if (!session || session.userId !== claimedUserId || session.expiresAt < Date.now()) {
    throw new ConvexError('Your session has expired. Please log in again.');
  }

  const user = await ctx.db.get(claimedUserId);
  if (!user) {
    throw new ConvexError('That account no longer exists.');
  }
  return user;
}
