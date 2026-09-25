import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const setTyping = mutation({
  args: { senderId: v.id('users'), recipientId: v.id('users'), isTyping: v.boolean(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { senderId, recipientId, isTyping }) => {
    const existing = await ctx.db
      .query('typing')
      .withIndex('by_sender_recipient', (q) =>
        q.eq('senderId', senderId).eq('recipientId', recipientId)
      )
      .unique();

    if (existing) {
      if (existing.isTyping !== isTyping) {
        await ctx.db.patch(existing._id, { isTyping });
      }
    } else if (isTyping) {
      await ctx.db.insert('typing', { senderId, recipientId, isTyping });
    }
  },
});

// Is the other person, right now, typing a message to me? For the open chat thread.
export const getTypingStatus = query({
  args: { userId: v.id('users'), otherUserId: v.id('users'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId, otherUserId }) => {
    const row = await ctx.db
      .query('typing')
      .withIndex('by_sender_recipient', (q) =>
        q.eq('senderId', otherUserId).eq('recipientId', userId)
      )
      .unique();
    return row?.isTyping ?? false;
  },
});

// Every user id currently typing something to me — for the Messages list,
// where we show a "Typing..." row without opening the thread.
export const listTypingSenders = query({
  args: { userId: v.id('users'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('typing')
      .withIndex('by_recipient', (q) => q.eq('recipientId', userId))
      .collect();
    return rows.filter((row) => row.isTyping).map((row) => row.senderId);
  },
});
