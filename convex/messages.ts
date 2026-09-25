import { mutation, query, QueryCtx } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { bumpMeaningfulInteraction } from './users';
import { rateLimiter } from './lib/rateLimit';
import { isBlockedEitherWay } from './blocks';
import { requireUser } from './lib/session';

// Exported so convex/affinity.ts can look up DM volume between two users
// through the same stable conversation id, without a second definition.
export function conversationId(a: Id<'users'>, b: Id<'users'>) {
  return [a, b].sort().join(':');
}

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

export const generateUploadUrl = mutation({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    await rateLimiter.limit(ctx, 'generateUploadUrl', { key: userId, throws: true });
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendMessage = mutation({
  args: {
    senderId: v.id('users'),
    recipientId: v.id('users'),
    text: v.string(),
    sharedPostId: v.optional(v.id('posts')),
    stickerId: v.optional(v.id('stickers')),
    mediaStorageId: v.optional(v.id('_storage')),
    mediaType: v.optional(v.union(v.literal('photo'), v.literal('video'))),
    sessionToken: v.string(),
  },
  handler: async (
    ctx,
    { senderId, recipientId, text, sharedPostId, stickerId, mediaStorageId, mediaType, sessionToken }
  ) => {
    await requireUser(ctx, senderId, sessionToken);

    const trimmed = text.trim();
    if (!trimmed && !sharedPostId && !stickerId && !mediaStorageId) return;

    await rateLimiter.limit(ctx, 'sendMessage', { key: senderId, throws: true });

    if (await isBlockedEitherWay(ctx, senderId, recipientId)) {
      throw new ConvexError("You can't message this person.");
    }

    await ctx.db.insert('messages', {
      conversationId: conversationId(senderId, recipientId),
      senderId,
      recipientId,
      text:
        trimmed ||
        (mediaStorageId ? (mediaType === 'video' ? 'Sent a video' : 'Sent a photo') : undefined) ||
        (stickerId ? 'Sent a sticker' : 'Shared a post'),
      sharedPostId,
      stickerId,
      mediaStorageId,
      mediaType,
    });

    if (sharedPostId) {
      await ctx.db.insert('postShares', { postId: sharedPostId, sharerId: senderId, sharedAt: Date.now() });
      // Sharing something is a stronger signal of interest than most other
      // interactions — counts toward the cold-start ramp same as a like.
      await bumpMeaningfulInteraction(ctx, senderId);
    }
  },
});

async function getClearedAt(ctx: QueryCtx, convId: string, userId: Id<'users'>): Promise<number> {
  const row = await ctx.db
    .query('messageClears')
    .withIndex('by_conversation_user', (q) => q.eq('conversationId', convId).eq('userId', userId))
    .unique();
  return row?.clearedAt ?? 0;
}

// The full back-and-forth between two people, oldest first — anything at or
// before this viewer's own "Clear chat" cutoff (see clearConversation) is
// left out, though it's still there for the other participant.
export const listMessages = query({
  args: { userId: v.id('users'), otherUserId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, otherUserId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const convId = conversationId(userId, otherUserId);
    const clearedAt = await getClearedAt(ctx, convId, userId);

    const allRows = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', convId))
      .order('asc')
      .collect();
    const rows = allRows.filter((row) => row._creationTime > clearedAt);

    return await Promise.all(
      rows.map(async (row) => {
        const circle = row.circleInviteId ? await ctx.db.get(row.circleInviteId) : null;
        const group = row.groupInviteId ? await ctx.db.get(row.groupInviteId) : null;
        const sticker = row.stickerId ? await ctx.db.get(row.stickerId) : null;
        const membership = row.circleInviteId
          ? await ctx.db
              .query('circleMemberships')
              .withIndex('by_circle_user', (q) =>
                q.eq('circleId', row.circleInviteId!).eq('userId', userId)
              )
              .unique()
          : null;
        const groupMembership = row.groupInviteId
          ? await ctx.db
              .query('groupMemberships')
              .withIndex('by_group_user', (q) =>
                q.eq('groupId', row.groupInviteId!).eq('userId', userId)
              )
              .unique()
          : null;

        return {
          _id: row._id,
          _creationTime: row._creationTime,
          text: row.text,
          sharedPostId: row.sharedPostId,
          mediaType: row.mediaType,
          mediaUrl: row.mediaStorageId ? await ctx.storage.getUrl(row.mediaStorageId) : null,
          sticker: sticker ? { _id: sticker._id, name: sticker.name, imageUrl: await ctx.storage.getUrl(sticker.imageStorageId) } : null,
          circleInviteId: row.circleInviteId,
          circleInvite: circle
            ? {
                _id: circle._id,
                name: circle.name,
                color: circle.color,
                status: membership?.status ?? 'none',
              }
            : null,
          groupInviteId: row.groupInviteId,
          groupInvite: group
            ? {
                _id: group._id,
                name: group.name,
                status: groupMembership?.status ?? 'none',
              }
            : null,
          isMine: row.senderId === userId,
        };
      })
    );
  },
});

// One row per conversation this user is part of, newest first, with the
// other participant's info and a preview of the latest message.
export const listConversations = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const sent = await ctx.db
      .query('messages')
      .withIndex('by_sender', (q) => q.eq('senderId', userId))
      .collect();
    const received = await ctx.db
      .query('messages')
      .withIndex('by_recipient', (q) => q.eq('recipientId', userId))
      .collect();

    const allMessages = [...sent, ...received];
    const conversationIds = [...new Set(allMessages.map((m) => m.conversationId))];
    const clearedAtByConversation = new Map(
      await Promise.all(
        conversationIds.map(async (convId) => [convId, await getClearedAt(ctx, convId, userId)] as const)
      )
    );

    const latestByConversation = new Map<string, (typeof sent)[number]>();
    for (const row of allMessages) {
      if (row._creationTime <= (clearedAtByConversation.get(row.conversationId) ?? 0)) continue;
      const existing = latestByConversation.get(row.conversationId);
      if (!existing || row._creationTime > existing._creationTime) {
        latestByConversation.set(row.conversationId, row);
      }
    }

    const conversations = await Promise.all(
      [...latestByConversation.values()].map(async (row) => {
        const otherUserId = row.senderId === userId ? row.recipientId : row.senderId;
        const otherUser = await userSummary(ctx, otherUserId);
        if (!otherUser) return null;
        const read = await ctx.db
          .query('reads')
          .withIndex('by_conversation_user', (q) =>
            q.eq('conversationId', row.conversationId).eq('userId', userId)
          )
          .unique();
        const clearedAt = clearedAtByConversation.get(row.conversationId) ?? 0;
        const unreadCount = received.filter(
          (message) =>
            message.conversationId === row.conversationId &&
            message._creationTime > Math.max(read?.lastReadAt ?? 0, clearedAt)
        ).length;
        const preview = row.mediaType === 'video' ? '🎥 Video' : row.mediaType === 'photo' ? '📷 Photo' : row.text;
        return {
          otherUser,
          lastMessage: preview,
          lastMessageAt: row._creationTime,
          lastMessageIsMine: row.senderId === userId,
          unreadCount,
        };
      })
    );

    return conversations
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

// Call when a user has the thread open / a new message arrives while they're
// looking at it — marks everything up to now as read by them.
export const markRead = mutation({
  args: { userId: v.id('users'), otherUserId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, otherUserId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const convId = conversationId(userId, otherUserId);
    const existing = await ctx.db
      .query('reads')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', convId).eq('userId', userId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastReadAt: Date.now() });
    } else {
      await ctx.db.insert('reads', { conversationId: convId, userId, lastReadAt: Date.now() });
    }
  },
});

// How recently the other person last had this thread open — compared
// against a message's _creationTime to decide "Sent" vs "Seen".
export const getOtherLastRead = query({
  args: { userId: v.id('users'), otherUserId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, otherUserId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const row = await ctx.db
      .query('reads')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', conversationId(userId, otherUserId)).eq('userId', otherUserId)
      )
      .unique();
    return row?.lastReadAt ?? null;
  },
});

// Powers the DMs tab's red badge — total unread messages across every
// conversation (each conversation's own lastReadAt row, or the beginning of
// time if that conversation was never opened).
export const getUnreadMessageCount = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const received = await ctx.db
      .query('messages')
      .withIndex('by_recipient', (q) => q.eq('recipientId', userId))
      .collect();
    if (received.length === 0) return 0;

    const conversationIds = [...new Set(received.map((m) => m.conversationId))];
    const lastReadByConversation = new Map(
      await Promise.all(
        conversationIds.map(async (convId) => {
          const row = await ctx.db
            .query('reads')
            .withIndex('by_conversation_user', (q) =>
              q.eq('conversationId', convId).eq('userId', userId)
            )
            .unique();
          return [convId, row?.lastReadAt ?? 0] as const;
        })
      )
    );

    return received.filter(
      (m) => m._creationTime > (lastReadByConversation.get(m.conversationId) ?? 0)
    ).length;
  },
});

// "Clear chat" — a per-viewer cutoff, not a delete (see messageClears in
// schema.ts). Bumping it to now hides every message that exists right now
// from this viewer's listMessages/listConversations; anything sent after
// this call is unaffected.
export const clearConversation = mutation({
  args: { userId: v.id('users'), otherUserId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, otherUserId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const convId = conversationId(userId, otherUserId);
    const existing = await ctx.db
      .query('messageClears')
      .withIndex('by_conversation_user', (q) => q.eq('conversationId', convId).eq('userId', userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { clearedAt: Date.now() });
    } else {
      await ctx.db.insert('messageClears', { conversationId: convId, userId, clearedAt: Date.now() });
    }
  },
});

// Every photo/video attachment in this conversation, newest first — powers
// the "Media in this chat" grid on the contact-info screen. Respects the
// same per-viewer clear cutoff as the message list itself.
export const listChatMedia = query({
  args: { userId: v.id('users'), otherUserId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, otherUserId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const convId = conversationId(userId, otherUserId);
    const clearedAt = await getClearedAt(ctx, convId, userId);

    const rows = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', convId))
      .order('desc')
      .collect();

    const media = rows.filter((row) => row._creationTime > clearedAt && row.mediaStorageId);
    return await Promise.all(
      media.map(async (row) => ({
        _id: row._id,
        _creationTime: row._creationTime,
        mediaType: row.mediaType!,
        mediaUrl: await ctx.storage.getUrl(row.mediaStorageId!),
      }))
    );
  },
});
