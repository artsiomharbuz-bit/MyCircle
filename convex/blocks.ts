import { ConvexError, v } from 'convex/values';
import { mutation, query, QueryCtx } from './_generated/server';
import { Id } from './_generated/dataModel';
import { rateLimiter } from './lib/rateLimit';
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

// Every user id that should be invisible to `userId` right now — either
// side of a block. Used by every feed/profile/comment/search query so a
// block hides content in both directions with one check.
export async function getHiddenUserIds(
  ctx: QueryCtx,
  userId: Id<'users'>
): Promise<Set<Id<'users'>>> {
  const blockedByMe = await ctx.db
    .query('blocks')
    .withIndex('by_blocker', (q) => q.eq('blockerId', userId))
    .collect();
  const blockedMe = await ctx.db
    .query('blocks')
    .withIndex('by_blocked', (q) => q.eq('blockedId', userId))
    .collect();

  return new Set([
    ...blockedByMe.map((row) => row.blockedId),
    ...blockedMe.map((row) => row.blockerId),
  ]);
}

export async function isBlockedEitherWay(
  ctx: QueryCtx,
  userA: Id<'users'>,
  userB: Id<'users'>
): Promise<boolean> {
  const forward = await ctx.db
    .query('blocks')
    .withIndex('by_blocker_blocked', (q) => q.eq('blockerId', userA).eq('blockedId', userB))
    .unique();
  if (forward) return true;
  const backward = await ctx.db
    .query('blocks')
    .withIndex('by_blocker_blocked', (q) => q.eq('blockerId', userB).eq('blockedId', userA))
    .unique();
  return backward !== null;
}

export const isBlocked = query({
  args: { viewerId: v.id('users'), otherUserId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { viewerId, otherUserId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);

    const blockedByMe = await ctx.db
      .query('blocks')
      .withIndex('by_blocker_blocked', (q) => q.eq('blockerId', viewerId).eq('blockedId', otherUserId))
      .unique();
    const blockedMe = await ctx.db
      .query('blocks')
      .withIndex('by_blocker_blocked', (q) => q.eq('blockerId', otherUserId).eq('blockedId', viewerId))
      .unique();

    return {
      blockedByMe: blockedByMe !== null,
      blockedMe: blockedMe !== null,
    };
  },
});

export const blockUser = mutation({
  args: { blockerId: v.id('users'), blockedId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { blockerId, blockedId, sessionToken }) => {
    await requireUser(ctx, blockerId, sessionToken);
    await rateLimiter.limit(ctx, 'blockUser', { key: blockerId, throws: true });
    if (blockerId === blockedId) throw new ConvexError('You cannot block yourself.');

    const existing = await ctx.db
      .query('blocks')
      .withIndex('by_blocker_blocked', (q) => q.eq('blockerId', blockerId).eq('blockedId', blockedId))
      .unique();
    if (!existing) {
      await ctx.db.insert('blocks', { blockerId, blockedId });
    }

    // A block ends any existing follow, both directions — blocked accounts
    // are never "friends" again unless the block is lifted and they
    // re-follow each other.
    const forwardFollow = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', blockerId).eq('followingId', blockedId))
      .unique();
    if (forwardFollow) await ctx.db.delete(forwardFollow._id);

    const backwardFollow = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', blockedId).eq('followingId', blockerId))
      .unique();
    if (backwardFollow) await ctx.db.delete(backwardFollow._id);
  },
});

export const unblockUser = mutation({
  args: { blockerId: v.id('users'), blockedId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { blockerId, blockedId, sessionToken }) => {
    await requireUser(ctx, blockerId, sessionToken);

    const existing = await ctx.db
      .query('blocks')
      .withIndex('by_blocker_blocked', (q) => q.eq('blockerId', blockerId).eq('blockedId', blockedId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const listBlockedUsers = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const rows = await ctx.db
      .query('blocks')
      .withIndex('by_blocker', (q) => q.eq('blockerId', userId))
      .collect();

    const users = await Promise.all(rows.map((row) => userSummary(ctx, row.blockedId)));
    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});
