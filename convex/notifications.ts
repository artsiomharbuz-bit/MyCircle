import { mutation, query, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { requireUser } from './lib/session';

async function userSummary(ctx: QueryCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarStorageId ? await ctx.storage.getUrl(user.avatarStorageId) : null,
    avatarGradient: user.avatarGradient,
    isVerified: user.isVerified ?? false,
  };
}

// Built straight off the follows/likes/comments tables (no separate
// notifications table to keep in sync) — a follow row is a "started
// following you" event, a like or comment on one of the viewer's own posts
// is a "liked"/"commented" event. Anything at or before the viewer's last
// "Clear" cutoff is left out. Shared by both listNotifications (the screen)
// and the unseen-count badge, so the two never disagree on what counts.
async function gatherNotifications(ctx: QueryCtx, userId: Id<'users'>) {
  const clearRow = await ctx.db
    .query('notificationClears')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  const clearedAt = clearRow?.clearedAt ?? 0;

  const followRows = await ctx.db
    .query('follows')
    .withIndex('by_following', (q) => q.eq('followingId', userId))
    .collect();

  const myPosts = await ctx.db
    .query('posts')
    .withIndex('by_author', (q) => q.eq('authorId', userId))
    .collect();
  const postById = new Map(myPosts.map((post) => [post._id, post]));

  const likeRows = (
    await Promise.all(
      myPosts.map((post) =>
        ctx.db
          .query('likes')
          .withIndex('by_post', (q) => q.eq('postId', post._id))
          .collect()
      )
    )
  ).flat();

  const commentRows = (
    await Promise.all(
      myPosts.map((post) =>
        ctx.db
          .query('comments')
          .withIndex('by_post', (q) => q.eq('postId', post._id))
          .collect()
      )
    )
  ).flat();

  const followNotifs = await Promise.all(
    followRows
      .filter((row) => row._creationTime > clearedAt)
      .map(async (row) => {
        const fromUser = await userSummary(ctx, row.followerId);
        if (!fromUser) return null;
        return {
          _id: row._id,
          type: 'follow' as const,
          createdAt: row._creationTime,
          fromUser,
        };
      })
  );

  const likeNotifs = await Promise.all(
    likeRows
      .filter((row) => row.userId !== userId && row._creationTime > clearedAt)
      .map(async (row) => {
        const fromUser = await userSummary(ctx, row.userId);
        const post = postById.get(row.postId);
        if (!fromUser || !post) return null;
        return {
          _id: row._id,
          type: 'like' as const,
          createdAt: row._creationTime,
          postId: post._id,
          postMediaUrl: await ctx.storage.getUrl(post.mediaStorageId),
          fromUser,
        };
      })
  );

  const commentNotifs = await Promise.all(
    commentRows
      .filter((row) => row.authorId !== userId && row._creationTime > clearedAt)
      .map(async (row) => {
        const fromUser = await userSummary(ctx, row.authorId);
        const post = postById.get(row.postId);
        if (!fromUser || !post) return null;
        return {
          _id: row._id,
          type: 'comment' as const,
          createdAt: row._creationTime,
          postId: post._id,
          postMediaUrl: await ctx.storage.getUrl(post.mediaStorageId),
          commentText: row.text,
          fromUser,
        };
      })
  );

  // Warnings and strikes land in the notification list too, not just in the
  // popup — so the user can still find out what happened after dismissing it.
  // These are from the moderation team rather than another user, so they
  // carry no fromUser and render with their own icon.
  const alertRows = await ctx.db
    .query('userAlerts')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();

  const alertNotifs = alertRows
    .filter((row) => row._creationTime > clearedAt)
    .map((row) => ({
      _id: row._id,
      type: 'moderation' as const,
      alertType: row.type,
      createdAt: row._creationTime,
      message: row.message,
      fromUser: null,
    }));

  // Ad approvals/rejections — a quiet trail separate from userAlerts (see
  // adNotifications' own comment in schema.ts), so it never triggers the
  // hard "acknowledge" popup that warnings/strikes do.
  const adStatusRows = await ctx.db
    .query('adNotifications')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();

  const adStatusNotifs = adStatusRows
    .filter((row) => row._creationTime > clearedAt)
    .map((row) => ({
      _id: row._id,
      type: 'ad_status' as const,
      status: row.status,
      adId: row.adId,
      createdAt: row._creationTime,
      message: row.message ?? null,
      fromUser: null,
    }));

  const all = [
    ...followNotifs,
    ...likeNotifs,
    ...commentNotifs,
    ...alertNotifs,
    ...adStatusNotifs,
  ].filter((n): n is NonNullable<typeof n> => n !== null);
  all.sort((a, b) => b.createdAt - a.createdAt);
  return all;
}

export const listNotifications = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const all = await gatherNotifications(ctx, userId);
    return all.slice(0, 200);
  },
});

export const clearNotifications = mutation({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const existing = await ctx.db
      .query('notificationClears')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { clearedAt: Date.now() });
    } else {
      await ctx.db.insert('notificationClears', { userId, clearedAt: Date.now() });
    }
  },
});

// Powers the bell icon's red badge — how many (still-listed) notifications
// arrived since the user last opened the Notifications screen.
export const getUnseenNotificationCount = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const readRow = await ctx.db
      .query('notificationReads')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const lastSeenAt = readRow?.lastSeenAt ?? 0;

    const all = await gatherNotifications(ctx, userId);
    return all.filter((n) => n.createdAt > lastSeenAt).length;
  },
});

// Called when the Notifications screen opens — resets the badge without
// touching notificationClears, so the list itself isn't affected.
export const markNotificationsSeen = mutation({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const existing = await ctx.db
      .query('notificationReads')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: Date.now() });
    } else {
      await ctx.db.insert('notificationReads', { userId, lastSeenAt: Date.now() });
    }
  },
});
