import { ConvexError, v } from 'convex/values';
import { mutation, query, QueryCtx } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import { assertCanPublish } from './moderation';
import { canViewCirclePost, getViewerCircleAccess } from './posts';
import { getHiddenUserIds } from './blocks';
import { soundVelocityFromTimestamps } from './lib/sound';
import { rateLimiter } from './lib/rateLimit';
import { requireUser } from './lib/session';

const VELOCITY_EVENT_SAMPLE = 300;

// Recent-momentum trend signal (see convex/lib/sound.ts) — deliberately
// bounded to the most recent VELOCITY_EVENT_SAMPLE usage events rather than
// every use in the sound's lifetime, so a long-lived viral sound doesn't
// force a full-table-style scan every time a clip using it is ranked.
export async function getSoundVelocityForSound(
  ctx: QueryCtx,
  soundId: Id<'sounds'>
): Promise<number> {
  const events = await ctx.db
    .query('soundUsageEvents')
    .withIndex('by_sound', (q) => q.eq('soundId', soundId))
    .order('desc')
    .take(VELOCITY_EVENT_SAMPLE);

  return soundVelocityFromTimestamps(events.map((e) => e.usedAt));
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

async function formatSound(ctx: QueryCtx, sound: Doc<'sounds'>, viewerId: Id<'users'>) {
  const deleted = sound.status === 'deleted';
  const owner = await userSummary(ctx, sound.ownerId);
  const saved = await ctx.db
    .query('savedSounds')
    .withIndex('by_user_sound', (q) => q.eq('userId', viewerId).eq('soundId', sound._id))
    .unique();

  return {
    _id: sound._id,
    name: deleted ? 'Deleted sound' : sound.name,
    pictureUrl: sound.pictureStorageId ? await ctx.storage.getUrl(sound.pictureStorageId) : null,
    audioUrl: deleted ? null : await ctx.storage.getUrl(sound.audioStorageId),
    isGlobal: sound.isGlobal,
    useCount: sound.useCount,
    isDeleted: deleted,
    isOwner: sound.ownerId === viewerId,
    isSaved: !!saved,
    owner,
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

// Trending (most-used global sounds) or Saved (this viewer's saved list),
// each optionally narrowed by a search term — what "Add sound" browses.
export const browseSounds = query({
  args: {
    viewerId: v.id('users'),
    tab: v.union(v.literal('trending'), v.literal('saved')),
    search: v.optional(v.string()),
    sessionToken: v.string(),
  },
  handler: async (ctx, { viewerId, tab, search, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const term = search?.trim().toLowerCase() ?? '';

    let sounds: Doc<'sounds'>[];
    if (tab === 'trending') {
      // Candidate generation: bounded to the top 100 by lifetime use (cheap,
      // indexed). Feature calculation + rerank: blend that lifetime count
      // with recent velocity, so a sound picking up steam right now can
      // outrank an old sound that's merely accumulated a big total — without
      // letting a brand-new sound with 2 uses beat an actually-popular one.
      const candidates = await ctx.db
        .query('sounds')
        .withIndex('by_status_global_useCount', (q) =>
          q.eq('status', 'active').eq('isGlobal', true)
        )
        .order('desc')
        .take(100);

      const scored = await Promise.all(
        candidates.map(async (sound) => {
          const velocity = await getSoundVelocityForSound(ctx, sound._id);
          return { sound, score: Math.log(1 + sound.useCount) * (1 + velocity) };
        })
      );
      sounds = scored.sort((a, b) => b.score - a.score).map((s) => s.sound);
    } else {
      const savedRows = await ctx.db
        .query('savedSounds')
        .withIndex('by_user', (q) => q.eq('userId', viewerId))
        .order('desc')
        .collect();
      const savedSoundsRaw = await Promise.all(savedRows.map((row) => ctx.db.get(row.soundId)));
      sounds = savedSoundsRaw.filter((s): s is Doc<'sounds'> => s !== null);
    }

    const filtered = term
      ? sounds.filter((s) => s.status === 'active' && s.name.toLowerCase().includes(term))
      : sounds;

    return await Promise.all(filtered.slice(0, 50).map((s) => formatSound(ctx, s, viewerId)));
  },
});

export const getSound = query({
  args: { soundId: v.id('sounds'), viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { soundId, viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const sound = await ctx.db.get(soundId);
    if (!sound) return null;
    return await formatSound(ctx, sound, viewerId);
  },
});

// A user's own sounds — the list Settings > Sounds shows for reference and
// for jumping into the edit screen for one of them.
export const listMySounds = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const rows = await ctx.db
      .query('sounds')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .order('desc')
      .collect();
    return await Promise.all(rows.map((sound) => formatSound(ctx, sound, userId)));
  },
});

export const toggleSaveSound = mutation({
  args: { soundId: v.id('sounds'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { soundId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const existing = await ctx.db
      .query('savedSounds')
      .withIndex('by_user_sound', (q) => q.eq('userId', userId).eq('soundId', soundId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert('savedSounds', { userId, soundId });
    }
  },
});

// Owner-only — renames the sound and/or swaps its picture. Available from
// the sound's own screen for whoever made it.
export const updateSound = mutation({
  args: {
    soundId: v.id('sounds'),
    userId: v.id('users'),
    name: v.string(),
    pictureStorageId: v.optional(v.id('_storage')),
    sessionToken: v.string(),
  },
  handler: async (ctx, { soundId, userId, name, pictureStorageId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const sound = await ctx.db.get(soundId);
    if (!sound) throw new ConvexError('That sound no longer exists.');
    if (sound.ownerId !== userId) throw new ConvexError('Only the creator can edit this sound.');
    if (sound.status === 'deleted') throw new ConvexError('This sound has been removed.');

    const trimmed = name.trim();
    if (!trimmed) throw new ConvexError('Give the sound a name.');

    await ctx.db.patch(soundId, {
      name: trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed,
      ...(pictureStorageId ? { pictureStorageId } : {}),
    });
  },
});

// Settings > Sounds: turn an uploaded mp3, or a video's audio (played
// audio-only — there's no on-device way to physically strip the video track
// in this project, so it's referenced and rendered exactly like a sound
// "born" from a clip), into a sound anyone can search for and use right away.
export const createUploadedSound = mutation({
  args: {
    ownerId: v.id('users'),
    name: v.string(),
    audioStorageId: v.id('_storage'),
    audioIsVideo: v.boolean(),
    sessionToken: v.string(),
  },
  handler: async (ctx, { ownerId, name, audioStorageId, audioIsVideo, sessionToken }) => {
    await requireUser(ctx, ownerId, sessionToken);
    await assertCanPublish(ctx, ownerId, 'post');

    const trimmed = name.trim();
    if (!trimmed) throw new ConvexError('Give the sound a name.');

    return await ctx.db.insert('sounds', {
      ownerId,
      name: trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed,
      audioStorageId,
      audioIsVideo,
      isGlobal: true,
      useCount: 0,
      status: 'active',
    });
  },
});

export const reportSound = mutation({
  args: { soundId: v.id('sounds'), reporterId: v.id('users'), reason: v.string(), sessionToken: v.string() },
  handler: async (ctx, { soundId, reporterId, reason, sessionToken }) => {
    await requireUser(ctx, reporterId, sessionToken);
    await rateLimiter.limit(ctx, 'report', { key: reporterId, throws: true });

    const sound = await ctx.db.get(soundId);
    if (!sound || sound.status !== 'active') {
      throw new ConvexError('That sound is no longer available.');
    }
    if (sound.ownerId === reporterId) {
      throw new ConvexError('You cannot report your own sound.');
    }

    const existing = await ctx.db
      .query('reports')
      .withIndex('by_sound', (q) => q.eq('soundId', soundId))
      .collect();
    if (existing.some((row) => row.reporterId === reporterId && row.status !== 'resolved')) {
      return;
    }

    await ctx.db.insert('reports', {
      kind: 'sound',
      soundId,
      targetUserId: sound.ownerId,
      reporterId,
      reason: reason.trim(),
      status: 'open',
    });
  },
});

// The posts or clips currently carrying a given sound — what the sound's own
// screen lists below its header, subject to the exact same audience rules
// as everywhere else a feed is shown (a circles-only post using this sound
// still only shows to viewers who'd normally be allowed to see it).
export const listContentForSound = query({
  args: {
    soundId: v.id('sounds'),
    contentKind: v.union(v.literal('post'), v.literal('clip')),
    viewerId: v.id('users'),
    sessionToken: v.string(),
  },
  handler: async (ctx, { soundId, contentKind, viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_sound', (q) => q.eq('soundId', soundId))
      .order('desc')
      .collect();

    const access = await getViewerCircleAccess(ctx, viewerId);
    const hidden = await getHiddenUserIds(ctx, viewerId);
    const visible = posts.filter(
      (post) =>
        !hidden.has(post.authorId) &&
        (post.kind ?? 'post') === contentKind &&
        (post.audience === 'global' || canViewCirclePost(post, viewerId, access))
    );

    return await Promise.all(
      visible.map(async (post) => {
        const author = await userSummary(ctx, post.authorId);
        return {
          _id: post._id,
          title: post.title,
          mediaType: post.mediaType,
          mediaUrl: await ctx.storage.getUrl(post.mediaStorageId),
          kind: post.kind ?? 'post',
          author,
        };
      })
    );
  },
});
