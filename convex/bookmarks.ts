import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { bumpMeaningfulInteraction } from './users';
import { rateLimiter } from './lib/rateLimit';
import { requireUser } from './lib/session';

export const toggleBookmark = mutation({
  args: { postId: v.id('posts'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { postId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    await rateLimiter.limit(ctx, 'toggleBookmark', { key: userId, throws: true });

    const existing = await ctx.db
      .query('bookmarks')
      .withIndex('by_post_user', (q) => q.eq('postId', postId).eq('userId', userId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }

    await ctx.db.insert('bookmarks', { postId, userId });
    await bumpMeaningfulInteraction(ctx, userId);
    return true;
  },
});
