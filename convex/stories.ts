import { mutation, query, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { Doc, Id } from './_generated/dataModel';
import { getHiddenUserIds } from './blocks';
import { rateLimiter } from './lib/rateLimit';
import { requireUser } from './lib/session';
import { resolveCircleLabels } from './posts';

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

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

// A story with no selected circles is the default "Friends" audience (mutual
// follows only); a story with selected circles is restricted to members of
// any selected circle, independent of follow status. Expiry is a read-time
// filter (createdAt within the last 24h), not a delete.
async function getVisibleActiveStories(ctx: QueryCtx, viewerId: Id<'users'>) {
  const cutoff = Date.now() - STORY_LIFETIME_MS;
  const all = await ctx.db.query('stories').collect();
  const active = all.filter((s) => s._creationTime > cutoff);

  const followingRows = await ctx.db
    .query('follows')
    .withIndex('by_follower_following', (q) => q.eq('followerId', viewerId))
    .collect();
  const followingIds = new Set(followingRows.map((r) => r.followingId));
  const followerRows = await ctx.db
    .query('follows')
    .withIndex('by_following', (q) => q.eq('followingId', viewerId))
    .collect();
  const followerIds = new Set(followerRows.map((r) => r.followerId));
  const friendIds = new Set([...followingIds].filter((id) => followerIds.has(id)));

  const memberships = await ctx.db
    .query('circleMemberships')
    .withIndex('by_user', (q) => q.eq('userId', viewerId))
    .collect();
  const joinedCircleIds = new Set(
    memberships.filter((m) => m.status === 'joined').map((m) => m.circleId)
  );

  const hidden = await getHiddenUserIds(ctx, viewerId);

  return active.filter((s) => {
    if (s.authorId === viewerId) return true;
    if (hidden.has(s.authorId)) return false;
    const circleIds = s.circleIds ?? (s.circleId ? [s.circleId] : []);
    if (circleIds.length > 0) return circleIds.some((id) => joinedCircleIds.has(id));
    return friendIds.has(s.authorId);
  });
}

export const createStory = mutation({
  args: {
    authorId: v.id('users'),
    mediaStorageId: v.id('_storage'),
    mediaType: v.union(v.literal('photo'), v.literal('video')),
    circleIds: v.optional(v.array(v.id('userCircles'))),
    textOverlay: v.optional(
      v.object({
        text: v.string(),
        color: v.string(),
        fontFamily: v.optional(v.string()),
        translateX: v.number(),
        translateY: v.number(),
        scale: v.number(),
        rotation: v.number(),
      })
    ),
    sessionToken: v.string(),
  },
  handler: async (ctx, { sessionToken, ...args }) => {
    await requireUser(ctx, args.authorId, sessionToken);
    await rateLimiter.limit(ctx, 'createStory', { key: args.authorId, throws: true });

    if (args.circleIds && args.circleIds.length > 0) {
      const memberships = await ctx.db
        .query('circleMemberships')
        .withIndex('by_user', (q) => q.eq('userId', args.authorId))
        .collect();
      const joinedCircleIds = new Set(
        memberships.filter((membership) => membership.status === 'joined').map((m) => m.circleId)
      );
      if (args.circleIds.some((circleId) => !joinedCircleIds.has(circleId))) {
        throw new Error('You can only share a story to circles you have joined.');
      }
    }
    return await ctx.db.insert('stories', args);
  },
});

// One entry per author with an active, visible-to-viewer story — what the
// Home stories row renders. The viewer's own entry (if any) sorts first.
export const listActiveStoriesForViewer = query({
  args: { viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const visible = await getVisibleActiveStories(ctx, viewerId);

    const byAuthor = new Map<Id<'users'>, Doc<'stories'>[]>();
    for (const story of visible) {
      const list = byAuthor.get(story.authorId) ?? [];
      list.push(story);
      byAuthor.set(story.authorId, list);
    }

    const groups = await Promise.all(
      [...byAuthor.entries()].map(async ([authorId, stories]) => {
        const author = await userSummary(ctx, authorId);
        if (!author) return null;
        stories.sort((a, b) => a._creationTime - b._creationTime);
        return {
          author,
          storyCount: stories.length,
          latestAt: stories[stories.length - 1]._creationTime,
        };
      })
    );

    const valid = groups.filter((g): g is NonNullable<typeof g> => g !== null);
    valid.sort((a, b) => {
      if (a.author._id === viewerId) return -1;
      if (b.author._id === viewerId) return 1;
      return b.latestAt - a.latestAt;
    });
    return valid;
  },
});

// Just the set of userIds with an active story visible to this viewer —
// cheap way for Profile/Search/Comments to decide whether to draw a ring.
export const getActiveStoryAuthorIds = query({
  args: { viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const visible = await getVisibleActiveStories(ctx, viewerId);
    return [...new Set(visible.map((s) => s.authorId))];
  },
});

// The actual playable stories for one author, oldest first — used by the
// story viewer screen once a ring has been tapped.
export const getStoriesByAuthor = query({
  args: { authorId: v.id('users'), viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { authorId, viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const visible = await getVisibleActiveStories(ctx, viewerId);
    const mine = visible
      .filter((s) => s.authorId === authorId)
      .sort((a, b) => a._creationTime - b._creationTime);

    return await Promise.all(
      mine.map(async (s) => {
        const likes = await ctx.db
          .query('storyLikes')
          .withIndex('by_story', (q) => q.eq('storyId', s._id))
          .collect();
        const remixSource = s.remixOfPostId ? await ctx.db.get(s.remixOfPostId) : null;
        const remixAuthor = remixSource ? await ctx.db.get(remixSource.authorId) : null;

        return {
          _id: s._id,
          _creationTime: s._creationTime,
          mediaUrl: await ctx.storage.getUrl(s.mediaStorageId),
          mediaType: s.mediaType,
          textOverlay: s.textOverlay,
          likeCount: likes.length,
          isLiked: likes.some((like) => like.userId === viewerId),
          circleLabels: await resolveCircleLabels(ctx, s.circleIds ?? (s.circleId ? [s.circleId] : [])),
          remixColor: s.remixColor ?? null,
          remixOf: remixSource
            ? {
                postId: remixSource._id,
                authorUsername: remixAuthor?.username ?? remixAuthor?.name ?? null,
                authorAvatarUrl: remixAuthor?.avatarStorageId
                  ? await ctx.storage.getUrl(remixAuthor.avatarStorageId)
                  : null,
                authorAvatarGradient: remixAuthor?.avatarGradient ?? null,
              }
            : null,
        };
      })
    );
  },
});

export const toggleStoryLike = mutation({
  args: { storyId: v.id('stories'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { storyId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const existing = await ctx.db
      .query('storyLikes')
      .withIndex('by_story_user', (q) => q.eq('storyId', storyId).eq('userId', userId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert('storyLikes', { storyId, userId });
    }
  },
});
