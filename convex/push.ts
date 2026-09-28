import { v } from 'convex/values';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from './_generated/server';
import { internal } from './_generated/api';
import { requireUser } from './lib/session';

// Registered (or re-homed) the moment the client gets an Expo push token —
// see App.tsx's registerForPushNotificationsAsync. A token belongs to one
// device/app install, never one account, so a device that logs into a
// different account just moves the same row over instead of duplicating it.
export const registerPushToken = mutation({
  args: {
    userId: v.id('users'),
    sessionToken: v.string(),
    token: v.string(),
    platform: v.optional(v.union(v.literal('ios'), v.literal('android'), v.literal('web'))),
  },
  handler: async (ctx, { userId, sessionToken, token, platform }) => {
    await requireUser(ctx, userId, sessionToken);

    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { userId, platform, updatedAt: Date.now() });
    } else {
      await ctx.db.insert('pushTokens', { userId, token, platform, updatedAt: Date.now() });
    }
  },
});

// Called on logout so a shared/reset device stops getting this account's
// pushes once nobody's signed into it there.
export const unregisterPushToken = mutation({
  args: { userId: v.id('users'), sessionToken: v.string(), token: v.string() },
  handler: async (ctx, { userId, sessionToken, token }) => {
    await requireUser(ctx, userId, sessionToken);

    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (existing && existing.userId === userId) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getTokensForUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('pushTokens')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
  },
});

export const deleteTokens = internalMutation({
  args: { ids: v.array(v.id('pushTokens')) },
  handler: async (ctx, { ids }) => {
    await Promise.all(ids.map((id) => ctx.db.delete(id)));
  },
});

// Fire-and-forget from a mutation via ctx.scheduler.runAfter(0, ...) — see
// convex/lib/notify.ts's sendPush, which every notification-triggering
// mutation calls. Runs in the default (non-Node) action runtime, which has
// `fetch`, so no extra Node dependency is needed just to call Expo's API.
export const sendPushToUser = internalAction({
  args: {
    userId: v.id('users'),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, { userId, title, body, data }) => {
    const tokens = await ctx.runQuery(internal.push.getTokensForUser, { userId });
    if (tokens.length === 0) return;

    const messages = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data: data ?? {},
      sound: 'default',
    }));

    let receipts: Array<{ status: string; details?: { error?: string } }> = [];
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });
      const json = (await res.json()) as { data?: typeof receipts };
      receipts = json.data ?? [];
    } catch {
      // Best-effort — a failed push send must never surface to the caller.
      return;
    }

    // Prune tokens Expo reports as dead (uninstalled app, etc.) so future
    // sends don't keep paying the round trip for them.
    const deadIds = receipts
      .map((receipt, i) =>
        receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered'
          ? tokens[i]?._id
          : null
      )
      .filter((id): id is NonNullable<typeof id> => id !== null);

    if (deadIds.length > 0) {
      await ctx.runMutation(internal.push.deleteTokens, { ids: deadIds });
    }
  },
});

// Lets a device test its own push setup end to end from Settings, without
// needing a second account to trigger a real notification.
export const sendTestPush = action({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await ctx.runMutation(internal.push.assertSession, { userId, sessionToken });
    await ctx.runAction(internal.push.sendPushToUser, {
      userId,
      title: 'MyCircle',
      body: "Push notifications are set up on this device.",
    });
  },
});

export const assertSession = internalMutation({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
  },
});
