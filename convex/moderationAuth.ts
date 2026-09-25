'use node';

import { ConvexError, v } from 'convex/values';
import bcrypt from 'bcryptjs';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { rateLimiter } from './lib/rateLimit';

// Moderator tools stay locked until the moderator re-enters their own account
// password. The token this mints lives only in the client's memory, so
// closing the app loses it and the password is required again next session.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

// 256 bits from the platform CSPRNG. Reached through globalThis (Web Crypto,
// present in the Node runtime these actions use) rather than `node:crypto`,
// so the project needs no Node type definitions to build.
function createSessionToken(): string {
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (!webCrypto?.getRandomValues) {
    throw new ConvexError('Secure random numbers are unavailable on the server.');
  }
  const bytes = new Uint8Array(32);
  webCrypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const unlock = action({
  args: { userId: v.id('users'), password: v.string() },
  handler: async (
    ctx,
    { userId, password }
  ): Promise<{ token: string; expiresAt: number }> => {
    await rateLimiter.limit(ctx, 'modUnlock', { key: userId, throws: true });

    const user = await ctx.runQuery(internal.moderation.getUserForAuth, { userId });
    if (!user) {
      throw new ConvexError('That account no longer exists.');
    }
    if (!user.isMainAdmin && user.role !== 'mod') {
      throw new ConvexError('You do not have moderator access.');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new ConvexError('Incorrect password.');
    }

    const token = createSessionToken();
    const expiresAt = Date.now() + SESSION_TTL_MS;
    await ctx.runMutation(internal.moderation.createUnlockSession, {
      userId,
      token,
      expiresAt,
    });

    return { token, expiresAt };
  },
});

// Manage Admins is stricter than the rest of the tools: the Main Admin
// confirms *every* promotion or revocation with their password, so this takes
// the password itself rather than a session token.
export const setModRole = action({
  args: {
    adminId: v.id('users'),
    targetUserId: v.id('users'),
    makeMod: v.boolean(),
    password: v.string(),
  },
  handler: async (
    ctx,
    { adminId, targetUserId, makeMod, password }
  ): Promise<{ username: string; isMod: boolean }> => {
    await rateLimiter.limit(ctx, 'modUnlock', { key: adminId, throws: true });

    const admin = await ctx.runQuery(internal.moderation.getUserForAuth, { userId: adminId });
    if (!admin || !admin.isMainAdmin) {
      throw new ConvexError('Only the Main Admin can manage moderators.');
    }

    const matches = await bcrypt.compare(password, admin.passwordHash);
    if (!matches) {
      throw new ConvexError('Incorrect password.');
    }

    return await ctx.runMutation(internal.moderation.applyModRole, {
      adminId,
      targetUserId,
      makeMod,
    });
  },
});
