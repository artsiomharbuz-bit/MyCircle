import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireUser } from './lib/session';

// One row per (user, circle) they've ever opened — HomeScreen compares this
// against its already-fetched feed posts' own _creationTime to decide
// whether a circle tab needs a "new post" dot, so this table only tracks the
// timestamp, not which posts exist.
export const getCircleLastViewed = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const rows = await ctx.db
      .query('circleReads')
      .withIndex('by_user_circle', (q) => q.eq('userId', userId))
      .collect();
    return Object.fromEntries(rows.map((row) => [row.circleId, row.lastViewedAt]));
  },
});

export const markCircleViewed = mutation({
  args: { userId: v.id('users'), circleId: v.string(), sessionToken: v.string() },
  handler: async (ctx, { userId, circleId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const existing = await ctx.db
      .query('circleReads')
      .withIndex('by_user_circle', (q) => q.eq('userId', userId).eq('circleId', circleId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { lastViewedAt: Date.now() });
    } else {
      await ctx.db.insert('circleReads', { userId, circleId, lastViewedAt: Date.now() });
    }
  },
});
