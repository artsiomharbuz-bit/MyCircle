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
  };
}

export const createCircle = mutation({
  args: { ownerId: v.id('users'), name: v.string(), color: v.string(), sessionToken: v.string() },
  handler: async (ctx, { ownerId, name, color, sessionToken }) => {
    await requireUser(ctx, ownerId, sessionToken);
    await rateLimiter.limit(ctx, 'createCircle', { key: ownerId, throws: true });

    const trimmed = name.trim();
    if (!trimmed) throw new Error('Circle name is required.');

    const owned = await ctx.db
      .query('userCircles')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .collect();
    const circleId = await ctx.db.insert('userCircles', {
      ownerId,
      name: trimmed,
      color,
      sortOrder: owned.length,
    });
    await ctx.db.insert('circleMemberships', { circleId, userId: ownerId, status: 'joined' });
    return circleId;
  },
});

// Every circle (owned or joined) this user is currently a member of —
// what CircleSelector renders as extra tabs beyond All/Best Friends.
export const listMyCircles = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const memberships = await ctx.db
      .query('circleMemberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const joined = memberships.filter((m) => m.status === 'joined');

    const circles = await Promise.all(
      joined.map(async (m) => {
        const circle = await ctx.db.get(m.circleId);
        if (!circle) return null;
        return {
          _id: circle._id,
          name: circle.name,
          color: circle.color,
          ownerId: circle.ownerId,
          sortOrder: circle.sortOrder,
        };
      })
    );
    return circles
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
});

export const reorderCircle = mutation({
  args: { userId: v.id('users'), circleId: v.id('userCircles'), sortOrder: v.number(), sessionToken: v.string() },
  handler: async (ctx, { userId, circleId, sortOrder, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const circle = await ctx.db.get(circleId);
    if (!circle || circle.ownerId !== userId) throw new Error('Only the circle owner can reorder it.');
    await ctx.db.patch(circleId, { sortOrder });
  },
});

// The set of userCircles ids this user has joined — used to check post/
// story visibility for circle-scoped content that isn't "Best Friends".
export const getJoinedCircleIds = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const memberships = await ctx.db
      .query('circleMemberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    return memberships.filter((m) => m.status === 'joined').map((m) => m.circleId);
  },
});

// Adds someone straight into the circle — there is no invite to accept. They
// get a plain chat message saying they were added, and can leave any time
// (see leaveCircle).
export const inviteToCircle = mutation({
  args: { circleId: v.id('userCircles'), inviterId: v.id('users'), inviteeId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { circleId, inviterId, inviteeId, sessionToken }) => {
    await requireUser(ctx, inviterId, sessionToken);
    await rateLimiter.limit(ctx, 'inviteToCircle', { key: inviterId, throws: true });

    const circle = await ctx.db.get(circleId);
    if (!circle) return;

    // Only a joined member can add people — otherwise a stranger to the
    // circle could add arbitrary people into it (and DM them about it) with
    // no relationship to it at all.
    const inviterMembership = await ctx.db
      .query('circleMemberships')
      .withIndex('by_circle_user', (q) => q.eq('circleId', circleId).eq('userId', inviterId))
      .unique();
    if (inviterMembership?.status !== 'joined') {
      throw new ConvexError("You're not a member of this circle.");
    }

    const existing = await ctx.db
      .query('circleMemberships')
      .withIndex('by_circle_user', (q) => q.eq('circleId', circleId).eq('userId', inviteeId))
      .unique();
    if (existing?.status === 'joined') return;
    if (existing) {
      await ctx.db.patch(existing._id, { status: 'joined' });
    } else {
      await ctx.db.insert('circleMemberships', { circleId, userId: inviteeId, status: 'joined' });
    }

    const conversationId = [inviterId, inviteeId].sort().join(':');
    await ctx.db.insert('messages', {
      conversationId,
      senderId: inviterId,
      recipientId: inviteeId,
      text: `Added you to the circle "${circle.name}"`,
    });
  },
});

// Leaving removes your own membership. The owner can't leave their own circle.
export const leaveCircle = mutation({
  args: { circleId: v.id('userCircles'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { circleId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const circle = await ctx.db.get(circleId);
    if (circle && circle.ownerId === userId) {
      throw new ConvexError("You can't leave a circle you own.");
    }

    const membership = await ctx.db
      .query('circleMemberships')
      .withIndex('by_circle_user', (q) => q.eq('circleId', circleId).eq('userId', userId))
      .unique();
    if (membership) await ctx.db.delete(membership._id);
  },
});

export const joinCircle = mutation({
  args: { circleId: v.id('userCircles'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { circleId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const existing = await ctx.db
      .query('circleMemberships')
      .withIndex('by_circle_user', (q) => q.eq('circleId', circleId).eq('userId', userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { status: 'joined' });
    } else {
      await ctx.db.insert('circleMemberships', { circleId, userId, status: 'joined' });
    }
  },
});

// Powers the invite card in chat — name/color plus whether this viewer has
// already joined, is still invited, or has no relationship to it at all.
export const getCircleInviteInfo = query({
  args: { circleId: v.id('userCircles'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { circleId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const circle = await ctx.db.get(circleId);
    if (!circle) return null;

    const membership = await ctx.db
      .query('circleMemberships')
      .withIndex('by_circle_user', (q) => q.eq('circleId', circleId).eq('userId', userId))
      .unique();

    return {
      _id: circle._id,
      name: circle.name,
      color: circle.color,
      status: membership?.status ?? 'none',
    };
  },
});

// Joined members of a circle — used when picking who to invite (to skip
// people already in) and could later back a "members" list screen.
export const listCircleMembers = query({
  args: { circleId: v.id('userCircles'), viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { circleId, viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);

    const memberships = await ctx.db
      .query('circleMemberships')
      .withIndex('by_circle', (q) => q.eq('circleId', circleId))
      .collect();
    const joined = memberships.filter((m) => m.status === 'joined');
    const users = await Promise.all(joined.map((m) => userSummary(ctx, m.userId)));
    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});
