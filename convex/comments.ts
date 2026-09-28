import { mutation, query, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { assertCanPublish } from './moderation';
import { getHiddenUserIds } from './blocks';
import { bumpMeaningfulInteraction } from './users';
import { rateLimiter } from './lib/rateLimit';
import { requireUser } from './lib/session';
import { displayName, pushPreview, sendPush } from './lib/notify';

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

export const addComment = mutation({
  args: {
    postId: v.id('posts'),
    authorId: v.id('users'),
    text: v.string(),
    stickerId: v.optional(v.id('stickers')),
    parentCommentId: v.optional(v.id('comments')),
    replyToUserId: v.optional(v.id('users')),
    sessionToken: v.string(),
  },
  handler: async (ctx, { postId, authorId, text, stickerId, parentCommentId, replyToUserId, sessionToken }) => {
    await requireUser(ctx, authorId, sessionToken);

    const trimmed = text.trim();
    if (!trimmed && !stickerId) return;

    await rateLimiter.limit(ctx, 'addComment', { key: authorId, throws: true });

    // Commenting is the first thing a restriction takes away.
    await assertCanPublish(ctx, authorId, 'comment');

    await ctx.db.insert('comments', {
      postId,
      authorId,
      text: trimmed,
      stickerId,
      parentCommentId,
      replyToUserId,
    });
    await bumpMeaningfulInteraction(ctx, authorId);

    const commenter = await ctx.db.get(authorId);
    const preview = pushPreview(trimmed || 'Sent a sticker');

    // A reply notifies whoever it's addressed to (falling back to the
    // parent comment's author when replyToUserId wasn't set); a top-level
    // comment notifies the post's author. Never both, and never yourself.
    const replyTarget =
      replyToUserId ??
      (parentCommentId ? (await ctx.db.get(parentCommentId))?.authorId : undefined);

    if (replyTarget && replyTarget !== authorId) {
      await sendPush(ctx, replyTarget, 'New reply', `${displayName(commenter)} replied: "${preview}"`, {
        type: 'reply',
        postId,
        commentId: parentCommentId,
      });
    } else {
      const post = await ctx.db.get(postId);
      if (post && post.authorId !== authorId) {
        await sendPush(
          ctx,
          post.authorId,
          'New comment',
          `${displayName(commenter)} commented: "${preview}"`,
          { type: 'comment', postId }
        );
      }
    }
  },
});

// Flat, chronological (oldest first) — the client groups replies under their
// parentCommentId itself rather than this query doing it, since a post's
// comment count here is small enough that fetching everything at once and
// grouping client-side keeps things reactive with one query.
export const listComments = query({
  args: { postId: v.id('posts'), viewerId: v.id('users'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { postId, viewerId }) => {
    const rows = await ctx.db
      .query('comments')
      .withIndex('by_post', (q) => q.eq('postId', postId))
      .order('asc')
      .collect();

    const hidden = await getHiddenUserIds(ctx, viewerId);
    const visibleRows = rows.filter((row) => !hidden.has(row.authorId));

    return await Promise.all(
      visibleRows.map(async (row) => {
        const author = await userSummary(ctx, row.authorId);
        const replyToUser = row.replyToUserId ? await userSummary(ctx, row.replyToUserId) : null;
        const commentLikes = await ctx.db
          .query('commentLikes')
          .withIndex('by_comment', (q) => q.eq('commentId', row._id))
          .collect();
        return {
          _id: row._id,
          _creationTime: row._creationTime,
          text: row.text,
          sticker: row.stickerId ? await ctx.db.get(row.stickerId).then(async sticker => sticker ? ({ _id: sticker._id, name: sticker.name, imageUrl: await ctx.storage.getUrl(sticker.imageStorageId) }) : null) : null,
          author,
          parentCommentId: row.parentCommentId,
          replyToUser,
          likeCount: commentLikes.length,
          isLiked: commentLikes.some((like) => like.userId === viewerId),
        };
      })
    );
  },
});

export const toggleCommentLike = mutation({
  args: { commentId: v.id('comments'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { commentId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const existing = await ctx.db
      .query('commentLikes')
      .withIndex('by_comment_user', (q) => q.eq('commentId', commentId).eq('userId', userId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert('commentLikes', { commentId, userId });
    }
  },
});

export const getCommentCount = query({
  args: { postId: v.id('posts'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { postId }) => {
    const rows = await ctx.db
      .query('comments')
      .withIndex('by_post', (q) => q.eq('postId', postId))
      .collect();
    return rows.length;
  },
});
