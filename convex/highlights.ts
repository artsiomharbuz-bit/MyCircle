import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getHiddenUserIds } from './blocks';
import { rateLimiter } from './lib/rateLimit';
import { requireUser } from './lib/session';

const RECENT_STORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const generateUploadUrl = mutation({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    await rateLimiter.limit(ctx, 'generateUploadUrl', { key: userId, throws: true });
    return await ctx.storage.generateUploadUrl();
  },
});

// The owner's own stories from the last 7 days (active right now, or expired
// out of the public 24h feed sometime in the last week) — the pool a
// highlight can be built from. Stories are never hard-deleted on expiry (see
// convex/stories.ts), so this is a plain time-window read, not a special case.
export const listRecentStoriesForHighlight = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const cutoff = Date.now() - RECENT_STORY_WINDOW_MS;
    const mine = await ctx.db
      .query('stories')
      .withIndex('by_author', (q) => q.eq('authorId', userId))
      .collect();
    const recent = mine
      .filter((s) => s._creationTime > cutoff)
      .sort((a, b) => b._creationTime - a._creationTime);

    return await Promise.all(
      recent.map(async (s) => ({
        _id: s._id,
        _creationTime: s._creationTime,
        mediaUrl: await ctx.storage.getUrl(s.mediaStorageId),
        mediaType: s.mediaType,
        textOverlay: s.textOverlay ?? null,
      }))
    );
  },
});

export const createHighlight = mutation({
  args: {
    ownerId: v.id('users'),
    name: v.string(),
    coverStorageId: v.id('_storage'),
    // Existing stories to copy in — resolved server-side from the stories
    // table (never trusting a client-supplied storageId for these) so a
    // highlight can't be built from someone else's story.
    storyIds: v.array(v.id('stories')),
    // Freshly uploaded media, added directly rather than copied from a story.
    uploadedItems: v.array(
      v.object({
        mediaStorageId: v.id('_storage'),
        mediaType: v.union(v.literal('photo'), v.literal('video')),
      })
    ),
    sessionToken: v.string(),
  },
  handler: async (ctx, { ownerId, name, coverStorageId, storyIds, uploadedItems, sessionToken }) => {
    await requireUser(ctx, ownerId, sessionToken);
    await rateLimiter.limit(ctx, 'createHighlight', { key: ownerId, throws: true });

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Give your highlight a name.');
    if (storyIds.length === 0 && uploadedItems.length === 0) {
      throw new Error('Add at least one photo, video, or story.');
    }

    const stories = await Promise.all(storyIds.map((id) => ctx.db.get(id)));
    for (const story of stories) {
      if (!story || story.authorId !== ownerId) {
        throw new Error('One of the selected stories is no longer available.');
      }
    }

    const existing = await ctx.db
      .query('highlights')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .collect();
    const sortOrder = existing.length;

    const highlightId = await ctx.db.insert('highlights', {
      ownerId,
      name: trimmedName,
      coverStorageId,
      sortOrder,
    });

    let position = 0;
    for (const story of stories) {
      if (!story) continue;
      await ctx.db.insert('highlightItems', {
        highlightId,
        mediaStorageId: story.mediaStorageId,
        mediaType: story.mediaType,
        textOverlay: story.textOverlay,
        sourceStoryId: story._id,
        sortOrder: position++,
      });
    }
    for (const item of uploadedItems) {
      await ctx.db.insert('highlightItems', {
        highlightId,
        mediaStorageId: item.mediaStorageId,
        mediaType: item.mediaType,
        sortOrder: position++,
      });
    }

    return highlightId;
  },
});

// One row per highlight on a profile, for the bubble row under the header.
export const listHighlights = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const rows = await ctx.db
      .query('highlights')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .collect();
    rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    return await Promise.all(
      rows.map(async (h) => ({
        _id: h._id,
        name: h.name,
        coverUrl: await ctx.storage.getUrl(h.coverStorageId),
      }))
    );
  },
});

// The playable items for one highlight, oldest-added first — used by the
// highlight viewer once a bubble has been tapped.
export const getHighlightItems = query({
  args: { highlightId: v.id('highlights'), viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { highlightId, viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const highlight = await ctx.db.get(highlightId);
    if (!highlight) return null;

    const hidden = await getHiddenUserIds(ctx, viewerId);
    if (hidden.has(highlight.ownerId)) return null;

    const owner = await ctx.db.get(highlight.ownerId);
    const items = await ctx.db
      .query('highlightItems')
      .withIndex('by_highlight', (q) => q.eq('highlightId', highlightId))
      .collect();
    items.sort((a, b) => a.sortOrder - b.sortOrder);

    return {
      _id: highlight._id,
      name: highlight.name,
      ownerId: highlight.ownerId,
      owner: owner
        ? {
            name: owner.name,
            username: owner.username,
            avatarUrl: owner.avatarStorageId ? await ctx.storage.getUrl(owner.avatarStorageId) : null,
            avatarGradient: owner.avatarGradient,
          }
        : null,
      items: await Promise.all(
        items.map(async (item) => ({
          _id: item._id,
          mediaUrl: await ctx.storage.getUrl(item.mediaStorageId),
          mediaType: item.mediaType,
          textOverlay: item.textOverlay ?? null,
        }))
      ),
    };
  },
});

export const deleteHighlight = mutation({
  args: { highlightId: v.id('highlights'), ownerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { highlightId, ownerId, sessionToken }) => {
    await requireUser(ctx, ownerId, sessionToken);
    const highlight = await ctx.db.get(highlightId);
    if (!highlight || highlight.ownerId !== ownerId) {
      throw new Error('That highlight is no longer available.');
    }

    const items = await ctx.db
      .query('highlightItems')
      .withIndex('by_highlight', (q) => q.eq('highlightId', highlightId))
      .collect();
    for (const item of items) {
      // Only delete storage this item actually owns — an item copied in
      // from a story shares its file with that (still-existing) story.
      if (!item.sourceStoryId) {
        await ctx.storage.delete(item.mediaStorageId);
      }
      await ctx.db.delete(item._id);
    }
    await ctx.storage.delete(highlight.coverStorageId);
    await ctx.db.delete(highlightId);
  },
});
