'use node';

import { ConvexError, v } from 'convex/values';
import bcrypt from 'bcryptjs';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { rateLimiter } from './lib/rateLimit';
import { createSessionToken, sessionExpiry } from './lib/session';

// Deliberately permissive (matches common practice: reject obviously invalid
// input, don't try to be a full RFC 5322 validator) — this is a defense-in-
// depth backstop behind whatever the client already checks, not the only
// check in the system.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export const register = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }): Promise<{ userId: string; sessionToken: string }> => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new ConvexError('Enter a valid email address.');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ConvexError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    // Keyed by email first (stops someone hammering registration for one
    // address) plus a coarse global bucket (slows a distributed bot signup
    // wave) — there's no account yet to key a per-user limit off of.
    await rateLimiter.limit(ctx, 'registerByEmail', { key: normalizedEmail, throws: true });
    await rateLimiter.limit(ctx, 'registerGlobal', { throws: true });

    const existing = await ctx.runQuery(internal.users.getByEmail, {
      email: normalizedEmail,
    });
    if (existing) {
      throw new ConvexError('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userId = await ctx.runMutation(internal.users.insertUser, {
      email: normalizedEmail,
      passwordHash,
    });

    const sessionToken = createSessionToken();
    await ctx.runMutation(internal.users.createSession, {
      userId,
      token: sessionToken,
      expiresAt: sessionExpiry(),
    });

    return { userId, sessionToken };
  },
});

export const login = action({
  args: { email: v.string(), password: v.string() },
  handler: async (
    ctx,
    { email, password }
  ): Promise<{ userId: string; sessionToken: string; onboardingComplete: boolean }> => {
    const normalizedEmail = email.trim().toLowerCase();

    // Same reasoning as register — keyed by the *attempted* email so one
    // targeted account can't be brute-forced, plus a global backstop.
    await rateLimiter.limit(ctx, 'loginByEmail', { key: normalizedEmail, throws: true });
    await rateLimiter.limit(ctx, 'loginGlobal', { throws: true });

    const user = await ctx.runQuery(internal.users.getByEmail, {
      email: normalizedEmail,
    });
    if (!user) {
      // Same message as a wrong password below — confirming an email
      // exists (or doesn't) via a different error is its own information
      // leak, so both paths read identically to the caller.
      throw new ConvexError('Incorrect email or password.');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new ConvexError('Incorrect email or password.');
    }

    const sessionToken = createSessionToken();
    await ctx.runMutation(internal.users.createSession, {
      userId: user._id,
      token: sessionToken,
      expiresAt: sessionExpiry(),
    });

    return { userId: user._id, sessionToken, onboardingComplete: user.onboardingComplete };
  },
});
