import { internalMutation, internalQuery, mutation, query, QueryCtx } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { assertCanPublish, deletePostCompletely } from './moderation';
import { getHiddenUserIds } from './blocks';
import { MAX_EXPIRY_MS, MIN_EXPIRY_MS } from '../postExpiry';
import { computeAffinity } from './affinity';
import { getImpressionStats, getReportCount, getHideCount, getRecentEngagementCounts } from './engagement';
import { getSoundVelocityForSound } from './sounds';
import { combineLanguageSignals, detectTextLanguage, languageRelevance } from './lib/language';
import { extractHashtags } from './lib/textSearch';
import { timeDecay } from './lib/timeDecay';
import { quality as qualityScore, smoothedRate } from './lib/quality';
import { affinityMultiplier } from './lib/affinity';
import { blendWithColdStart } from './lib/coldStart';
import { diversify } from './lib/diversity';
import { watchReward, ucbScore } from './lib/ucb';
import { FEED_WEIGHTS, CLIPS_WEIGHTS } from './lib/rankingConfig';
import { formatPoll, normalizePoll } from './polls';
import { rateLimiter } from './lib/rateLimit';
import { requireUser } from './lib/session';

export const generateUploadUrl = mutation({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    await rateLimiter.limit(ctx, 'generateUploadUrl', { key: userId, throws: true });
    return await ctx.storage.generateUploadUrl();
  },
});

export const createPost = mutation({
  args: {
    authorId: v.id('users'),
    title: v.optional(v.string()),
    caption: v.optional(v.string()),
    mediaStorageId: v.id('_storage'),
    mediaType: v.union(v.literal('photo'), v.literal('video')),
    // More pictures for a swipeable post (photos only, max 9 extra).
    extraMediaStorageIds: v.optional(v.array(v.id('_storage'))),
    mediaAspect: v.optional(v.number()),
    audience: v.union(v.literal('circles'), v.literal('global')),
    circleIds: v.optional(v.array(v.string())),
    kind: v.optional(v.union(v.literal('post'), v.literal('clip'))),
    containsAi: v.optional(v.boolean()),
    // Creator-selected content language override (see AGENTS.md section 3) —
    // when set, this always wins over the caption/title heuristic below.
    creatorLanguage: v.optional(v.string()),
    // Populated when the uploaded video actually carries a subtitle/caption
    // track or a manually-entered transcript/subtitle text — see
    // convex/languageDetection.ts for why speech-to-text and OCR aren't run
    // automatically in this session (no STT/OCR service is configured yet).
    subtitleLanguages: v.optional(v.array(v.string())),
    subtitleText: v.optional(v.string()),
    // A statement + 2+ options (see convex/polls.ts normalizePoll for the
    // exact bounds) — optional, on either a post or a clip.
    poll: v.optional(v.object({ question: v.string(), options: v.array(v.string()) })),
    // Auto-delete after this many ms (see postExpiry.ts) — only valid for a
    // circles-audience post/clip (see AudienceSelectionScreen: the option
    // only ever shows once "Circles" is selected).
    expiresInMs: v.optional(v.number()),
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
    // An existing sound the author picked via "Add sound" — mutually
    // exclusive with useOwnAudioAsSound below.
    soundId: v.optional(v.id('sounds')),
    soundVolume: v.optional(v.number()),
    originalVolume: v.optional(v.number()),
    audioMode: v.optional(v.union(v.literal('sound-only'), v.literal('both'))),
    // No sound was picked and this is a video — promote its own audio into
    // a personal sound others can browse to and reuse. Ignored for photos
    // (nothing to promote) and ignored if soundId is already set.
    useOwnAudioAsSound: v.optional(v.boolean()),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const {
      soundId: pickedSoundId,
      soundVolume,
      originalVolume,
      audioMode,
      useOwnAudioAsSound,
      creatorLanguage,
      subtitleLanguages,
      subtitleText,
      poll: rawPoll,
      expiresInMs,
      sessionToken,
      ...postFields
    } = args;

    await requireUser(ctx, postFields.authorId, sessionToken);

    // A restricted or banned account can't put anything new out.
    await rateLimiter.limit(ctx, 'createPost', { key: postFields.authorId, throws: true });
    await assertCanPublish(ctx, postFields.authorId, 'post');

    if (postFields.extraMediaStorageIds?.length) {
      if (postFields.mediaType !== 'photo' || postFields.kind === 'clip') {
        throw new ConvexError('Only pictures can be combined into one post.');
      }
      if (postFields.extraMediaStorageIds.length > 9) {
        throw new ConvexError('A post can have at most 10 pictures.');
      }
    }

    if (pickedSoundId) {
      const sound = await ctx.db.get(pickedSoundId);
      if (!sound || sound.status !== 'active') {
        throw new ConvexError('That sound is no longer available.');
      }
    }

    // Auto-delete is only ever offered for circles-audience content — a
    // global post reaching a wide, indefinite audience isn't what this
    // feature is for, and the client never sends it for a global post
    // anyway (see AudienceSelectionScreen), but this is the real
    // enforcement, not just a UI nicety.
    if (expiresInMs !== undefined && postFields.audience !== 'circles') {
      throw new ConvexError('Auto-delete is only available for posts shared to circles.');
    }
    if (expiresInMs !== undefined && (expiresInMs < MIN_EXPIRY_MS || expiresInMs > MAX_EXPIRY_MS)) {
      throw new ConvexError('That auto-delete duration is out of range.');
    }
    const expiresAt = expiresInMs !== undefined ? Date.now() + expiresInMs : undefined;

    // Language: creator override wins outright; otherwise fall back to the
    // caption/title heuristic (the only automatic signal available without
    // an STT/OCR service — see convex/languageDetection.ts). Subtitles are
    // tracked separately and never substitute for this.
    const languageSignal = combineLanguageSignals({
      creator: creatorLanguage ?? null,
      title: detectTextLanguage(postFields.title, 'title'),
      caption: detectTextLanguage(postFields.caption, 'caption'),
    });
    const hashtags = [
      ...extractHashtags(postFields.title),
      ...extractHashtags(postFields.caption),
    ];
    // Throws (min/max options, empty question) before anything is written,
    // same as every other validation in this mutation.
    const poll = normalizePoll(rawPoll);

    const postId = await ctx.db.insert('posts', {
      ...postFields,
      soundId: pickedSoundId,
      soundVolume,
      originalVolume,
      audioMode,
      hashtags: [...new Set(hashtags)],
      language: languageSignal.language ?? undefined,
      languageConfidence: languageSignal.confidence,
      languageSource: languageSignal.source,
      subtitleLanguages: subtitleLanguages && subtitleLanguages.length > 0 ? subtitleLanguages : undefined,
      subtitleText: subtitleText || undefined,
      poll,
      expiresAt,
    });

    if (expiresAt !== undefined) {
      // A precise one-shot scheduled function, not a periodic sweep — the
      // post disappears exactly at expiresAt regardless of how long it sits
      // unvisited, and this is a no-op if it was already deleted some other
      // way (moderation, the author deleting it themselves) by then.
      await ctx.scheduler.runAt(expiresAt, internal.posts.expirePost, { postId });
    }

    if (postFields.mediaType === 'video') {
      // Real speech-to-text (Groq-hosted Whisper — see
      // convex/languageDetection.ts) runs asynchronously after the post
      // already exists, so a slow transcription never blocks the upload
      // flow the user is waiting on. No-ops safely if GROQ_API_KEY isn't
      // configured.
      await ctx.scheduler.runAfter(0, internal.languageDetection.transcribeAndDetectLanguage, {
        postId,
      });
    }

    if (pickedSoundId) {
      const sound = await ctx.db.get(pickedSoundId);
      if (sound) {
        await ctx.db.patch(pickedSoundId, { useCount: sound.useCount + 1 });
        await ctx.db.insert('soundUsageEvents', {
          soundId: pickedSoundId,
          userId: postFields.authorId,
          postId,
          usedAt: Date.now(),
        });
      }
    } else if (useOwnAudioAsSound && postFields.mediaType === 'video') {
      const name = postFields.title || postFields.caption || 'Original sound';
      const newSoundId = await ctx.db.insert('sounds', {
        ownerId: postFields.authorId,
        name: name.length > 60 ? `${name.slice(0, 57)}...` : name,
        audioStorageId: postFields.mediaStorageId,
        audioIsVideo: true,
        originPostId: postId,
        isGlobal: postFields.audience === 'global',
        useCount: 1,
        status: 'active',
      });
      await ctx.db.patch(postId, { soundId: newSoundId });
      await ctx.db.insert('soundUsageEvents', {
        soundId: newSoundId,
        userId: postFields.authorId,
        postId,
        usedAt: Date.now(),
      });
    }

    return postId;
  },
});

// Reposts an existing clip's media (never re-uploaded — the new row just
// points at the same mediaStorageId) as a new post, clip or story. Deliberately
// circle-only: unlike createPost/createStory, there's no 'global' choice
// here at all, enforced below rather than left to the client.
export const createRemix = mutation({
  args: {
    authorId: v.id('users'),
    sourcePostId: v.id('posts'),
    targetKind: v.union(v.literal('post'), v.literal('clip'), v.literal('story')),
    // Loose strings, same as posts.circleIds — 'best-friends' is the "All
    // (your friends)" pseudo-circle, everything else a real userCircles id.
    // Required and non-empty: this is what makes a remix circle-only.
    circleIds: v.array(v.string()),
    title: v.optional(v.string()),
    caption: v.optional(v.string()),
    // Sampled client-side (see dominantColor.ts) from the source clip's own
    // media — stored once here so every future render reuses it instead of
    // resampling.
    remixColor: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, { sessionToken, sourcePostId, targetKind, circleIds, title, caption, remixColor, authorId }) => {
    await requireUser(ctx, authorId, sessionToken);
    await rateLimiter.limit(ctx, 'createRemix', { key: authorId, throws: true });
    await assertCanPublish(ctx, authorId, 'post');

    if (circleIds.length === 0) {
      throw new ConvexError('Pick at least one circle to remix to.');
    }

    const source = await ctx.db.get(sourcePostId);
    if (!source) {
      throw new ConvexError("That clip isn't available anymore.");
    }

    const hidden = await getHiddenUserIds(ctx, authorId);
    if (hidden.has(source.authorId)) {
      throw new ConvexError("That clip isn't available anymore.");
    }
    // Remixing is only for global clips (found via Explore) — never posts,
    // and never anything that lives inside a circle.
    if (source.kind !== 'clip' || source.audience !== 'global') {
      throw new ConvexError('Only clips from Explore can be remixed.');
    }

    if (targetKind === 'story') {
      const isAllFriends = circleIds.length === 1 && circleIds[0] === 'best-friends';
      let storyCircleIds: Id<'userCircles'>[] | undefined;
      if (!isAllFriends) {
        const memberships = await ctx.db
          .query('circleMemberships')
          .withIndex('by_user', (q) => q.eq('userId', authorId))
          .collect();
        const joinedCircleIds = new Set(
          memberships.filter((m) => m.status === 'joined').map((m) => m.circleId)
        );
        if (circleIds.some((id) => !joinedCircleIds.has(id as Id<'userCircles'>))) {
          throw new ConvexError('You can only share a story to circles you have joined.');
        }
        storyCircleIds = circleIds as Id<'userCircles'>[];
      }

      return await ctx.db.insert('stories', {
        authorId,
        mediaStorageId: source.mediaStorageId,
        mediaType: source.mediaType,
        circleIds: storyCircleIds,
        remixOfPostId: sourcePostId,
        remixColor,
      });
    }

    return await ctx.db.insert('posts', {
      authorId,
      title: title || undefined,
      caption: caption || undefined,
      mediaStorageId: source.mediaStorageId,
      mediaType: source.mediaType,
      audience: 'circles',
      circleIds,
      kind: targetKind,
      remixOfPostId: sourcePostId,
      remixColor,
    });
  },
});

// Fired by the scheduler at exactly the expiresAt this post was created
// with (see createPost) — a no-op if the post is already gone (deleted by
// its author, by moderation, or — impossible in practice, but harmless —
// twice).
export const expirePost = internalMutation({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post) return;
    await deletePostCompletely(ctx, postId);
  },
});

// ---------------------------------------------------------------------------
// Speech-to-text wiring (see convex/languageDetection.ts, a "use node" file
// that can only export actions — this query/mutation pair is what its
// action calls into for the actual database read/write).
// ---------------------------------------------------------------------------

const MAX_TRANSCRIPT_LENGTH = 5000;

export const getPostForTranscription = internalQuery({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post) return null;
    return {
      mediaStorageId: post.mediaStorageId,
      mediaType: post.mediaType,
      languageSource: post.languageSource,
    };
  },
});

export const applyDetectedLanguage = internalMutation({
  args: {
    postId: v.id('posts'),
    transcript: v.string(),
    speechLanguage: v.union(v.string(), v.null()),
    speechConfidence: v.number(),
  },
  handler: async (ctx, { postId, transcript, speechLanguage, speechConfidence }) => {
    const post = await ctx.db.get(postId);
    if (!post) return;

    const patch: Partial<Doc<'posts'>> = {};
    if (transcript) patch.transcript = transcript.slice(0, MAX_TRANSCRIPT_LENGTH);

    // Priority order unchanged from combineLanguageSignals: a creator
    // override already won outright at creation time and must stay won.
    // Otherwise, a confident speech result beats whatever the caption/title
    // heuristic guessed (or "none"), same as if speech had been available
    // synchronously at creation.
    if (post.languageSource !== 'creator' && speechLanguage && speechConfidence >= 0.5) {
      patch.language = speechLanguage;
      patch.languageConfidence = speechConfidence;
      patch.languageSource = 'speech';
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(postId, patch);
    }
  },
});

// A viewer's "circles" access: who they're a mutual friend of (the built-in
// "Best Friends" bucket) and which user-created circles they've joined —
// used to decide, per post, whether a circles-audience post is visible.
// Exported so sounds.ts can apply the exact same rule when listing the
// posts/clips that use a given sound.
export async function getViewerCircleAccess(ctx: QueryCtx, viewerId: Id<'users'>) {
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

  const friendIds = new Set<Id<'users'>>([...followingIds].filter((id) => followerIds.has(id)));

  const memberships = await ctx.db
    .query('circleMemberships')
    .withIndex('by_user', (q) => q.eq('userId', viewerId))
    .collect();
  const joinedCircleIds = new Set(
    memberships.filter((m) => m.status === 'joined').map((m) => m.circleId as string)
  );

  return { friendIds, joinedCircleIds };
}

// A circles-audience post is visible if the viewer is the author, or
// qualifies for at least one of the post's circleIds: "best-friends" needs
// mutual friendship with the author, any other id needs joined membership
// in that specific user-created circle.
export function canViewCirclePost(
  post: Doc<'posts'>,
  viewerId: Id<'users'>,
  access: { friendIds: Set<Id<'users'>>; joinedCircleIds: Set<string> }
) {
  if (post.authorId === viewerId) return true;
  return (post.circleIds ?? []).some((circleId) =>
    circleId === 'best-friends'
      ? access.friendIds.has(post.authorId)
      : access.joinedCircleIds.has(circleId)
  );
}

// The scheduled expirePost runs at exactly expiresAt, but reads happening in
// the same instant (or if a scheduled run is ever delayed) shouldn't briefly
// show something the author asked to auto-delete — belt-and-suspenders on
// top of the scheduler, not a replacement for it.
export function isExpired(post: Doc<'posts'>): boolean {
  return post.expiresAt !== undefined && post.expiresAt <= Date.now();
}

// When the viewer has "Hide AI content" on, drops any post labeled
// containsAi — except the viewer's own and their friends' (mutual follows).
// A no-op for everyone else, so every feed query can run it unconditionally.
async function filterHiddenAiContent(
  ctx: QueryCtx,
  viewerId: Id<'users'>,
  posts: Doc<'posts'>[],
  friendIds: Set<Id<'users'>>
) {
  const viewer = await ctx.db.get(viewerId);
  if (!viewer?.hideAiContent) return posts;
  return posts.filter(
    (post) => !post.containsAi || post.authorId === viewerId || friendIds.has(post.authorId)
  );
}

export const listPostsByAuthor = query({
  args: { authorId: v.id('users'), viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { authorId, viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    // A block hides everything, both directions — no posts, no clips.
    const hidden = await getHiddenUserIds(ctx, viewerId);
    if (hidden.has(authorId)) return [];

    const posts = await ctx.db
      .query('posts')
      .withIndex('by_author', (q) => q.eq('authorId', authorId))
      .order('desc')
      .collect();

    const access = await getViewerCircleAccess(ctx, viewerId);
    const audienceVisible = posts.filter(
      (post) =>
        !post.isAd &&
        !isExpired(post) &&
        (post.audience === 'global' || canViewCirclePost(post, viewerId, access))
    );
    const visible = await filterHiddenAiContent(ctx, viewerId, audienceVisible, access.friendIds);

    return await Promise.all(visible.map((post) => formatPost(ctx, post, viewerId)));
  },
});

// The viewer's own liked/saved posts and clips, for the private "Likes" /
// "Saved" tabs on their own profile (never another user's — the client only
// ever calls these with viewerId === the signed-in user). A post can still
// show up in someone's like/bookmark history after it stops being visible to
// them (the author blocked them, a circle post's access changed, the AI
// label got hidden), so this re-runs the same visibility checks as the feed
// rather than trusting the like/bookmark row alone.
async function listEngagedPosts(
  ctx: QueryCtx,
  viewerId: Id<'users'>,
  postIds: Id<'posts'>[]
) {
  const hidden = await getHiddenUserIds(ctx, viewerId);
  const access = await getViewerCircleAccess(ctx, viewerId);

  const posts = (await Promise.all(postIds.map((id) => ctx.db.get(id)))).filter(
    (post): post is Doc<'posts'> => post !== null
  );

  const audienceVisible = posts.filter(
    (post) =>
      !post.isAd &&
      !hidden.has(post.authorId) &&
      !isExpired(post) &&
      (post.audience === 'global' || canViewCirclePost(post, viewerId, access))
  );
  const visible = await filterHiddenAiContent(ctx, viewerId, audienceVisible, access.friendIds);

  return await Promise.all(visible.map((post) => formatPost(ctx, post, viewerId)));
}

export const listLikedPosts = query({
  args: { viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const rows = await ctx.db
      .query('likes')
      .withIndex('by_user', (q) => q.eq('userId', viewerId))
      .order('desc')
      .collect();
    return await listEngagedPosts(ctx, viewerId, rows.map((r) => r.postId));
  },
});

export const listSavedPosts = query({
  args: { viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const rows = await ctx.db
      .query('bookmarks')
      .withIndex('by_user', (q) => q.eq('userId', viewerId))
      .order('desc')
      .collect();
    return await listEngagedPosts(ctx, viewerId, rows.map((r) => r.postId));
  },
});

// The sliver of sound info a post card needs: enough to show the label and
// play it, without pulling in every field getSound would return. A deleted
// sound still resolves — its name is swapped for "Deleted sound" and no
// audio URL is returned, which is what mutes it and relabels it everywhere
// this is used.
async function formatSoundSummary(
  ctx: QueryCtx,
  soundId: Id<'sounds'> | undefined,
  viewerId: Id<'users'>
) {
  if (!soundId) return null;
  const sound = await ctx.db.get(soundId);
  if (!sound) return null;

  const deleted = sound.status === 'deleted';
  const owner = await ctx.db.get(sound.ownerId);
  const saved = await ctx.db
    .query('savedSounds')
    .withIndex('by_user_sound', (q) => q.eq('userId', viewerId).eq('soundId', soundId))
    .unique();

  return {
    _id: sound._id,
    name: deleted ? 'Deleted sound' : sound.name,
    pictureUrl: sound.pictureStorageId ? await ctx.storage.getUrl(sound.pictureStorageId) : null,
    audioUrl: deleted ? null : await ctx.storage.getUrl(sound.audioStorageId),
    ownerUsername: owner?.username,
    isDeleted: deleted,
    isOwner: sound.ownerId === viewerId,
    isSaved: !!saved,
  };
}

export async function formatEngagement(ctx: QueryCtx, postId: Id<'posts'>, viewerId: Id<'users'>) {
  const likes = await ctx.db
    .query('likes')
    .withIndex('by_post', (q) => q.eq('postId', postId))
    .collect();

  const isLiked = likes.some((like) => like.userId === viewerId);

  const bookmark = await ctx.db
    .query('bookmarks')
    .withIndex('by_post_user', (q) => q.eq('postId', postId).eq('userId', viewerId))
    .unique();

  const comments = await ctx.db
    .query('comments')
    .withIndex('by_post', (q) => q.eq('postId', postId))
    .collect();

  // Friends (mutual follows) among the likers — bounded so a viral post
  // doesn't turn every render into hundreds of lookups.
  const friendLikers: {
    _id: Id<'users'>;
    name?: string;
    username?: string;
    avatarUrl: string | null;
    avatarGradient?: string[];
  }[] = [];
  for (const like of likes.slice(0, 40)) {
    if (like.userId === viewerId) continue;
    const [iFollow, theyFollow] = await Promise.all([
      ctx.db
        .query('follows')
        .withIndex('by_follower_following', (q) =>
          q.eq('followerId', viewerId).eq('followingId', like.userId)
        )
        .unique(),
      ctx.db
        .query('follows')
        .withIndex('by_follower_following', (q) =>
          q.eq('followerId', like.userId).eq('followingId', viewerId)
        )
        .unique(),
    ]);
    if (!iFollow || !theyFollow) continue;
    const liker = await ctx.db.get(like.userId);
    if (!liker) continue;
    friendLikers.push({
      _id: liker._id,
      name: liker.name,
      username: liker.username,
      avatarUrl: liker.avatarStorageId ? await ctx.storage.getUrl(liker.avatarStorageId) : null,
      avatarGradient: liker.avatarGradient,
    });
  }

  return {
    likeCount: likes.length,
    isLiked,
    isBookmarked: !!bookmark,
    commentCount: comments.length,
    friendLikers,
  };
}

async function formatRemixOf(ctx: QueryCtx, remixOfPostId: Id<'posts'> | undefined) {
  if (!remixOfPostId) return null;
  const source = await ctx.db.get(remixOfPostId);
  if (!source) return null;
  const author = await ctx.db.get(source.authorId);
  return {
    postId: source._id,
    authorUsername: author?.username ?? author?.name ?? null,
    authorAvatarUrl: author?.avatarStorageId ? await ctx.storage.getUrl(author.avatarStorageId) : null,
    authorAvatarGradient: author?.avatarGradient ?? null,
  };
}

// Names/colors of the circles a post or story was shared to, for the small
// label shown on it. 'best-friends' is the built-in pseudo-circle.
export async function resolveCircleLabels(
  ctx: QueryCtx,
  circleIds: string[] | undefined
): Promise<{ id: string; name: string; color: string }[]> {
  if (!circleIds || circleIds.length === 0) return [];
  const labels = await Promise.all(
    circleIds.map(async (id) => {
      if (id === 'best-friends') return { id, name: 'Best Friends', color: '#f5c542' };
      const normalized = ctx.db.normalizeId('userCircles', id);
      const circle = normalized ? await ctx.db.get(normalized) : null;
      return circle ? { id, name: circle.name, color: circle.color } : null;
    })
  );
  return labels.filter((l): l is { id: string; name: string; color: string } => l !== null);
}

async function formatPost(ctx: QueryCtx, post: Doc<'posts'>, viewerId: Id<'users'>) {
  const author = await ctx.db.get(post.authorId);
  const mediaUrl = await ctx.storage.getUrl(post.mediaStorageId);
  const authorAvatarUrl = author?.avatarStorageId
    ? await ctx.storage.getUrl(author.avatarStorageId)
    : null;
  const { likeCount, isLiked, isBookmarked, commentCount, friendLikers } = await formatEngagement(
    ctx,
    post._id,
    viewerId
  );

  return {
    _id: post._id,
    _creationTime: post._creationTime,
    title: post.title,
    caption: post.caption,
    mediaType: post.mediaType,
    mediaUrl,
    mediaAspect: post.mediaAspect ?? null,
    extraMediaUrls: (
      await Promise.all((post.extraMediaStorageIds ?? []).map((id) => ctx.storage.getUrl(id)))
    ).filter((url): url is string => url !== null),
    audience: post.audience,
    circleIds: post.circleIds,
    circleLabels: post.audience === 'circles' ? await resolveCircleLabels(ctx, post.circleIds) : [],
    kind: post.kind ?? 'post',
    containsAi: post.containsAi ?? false,
    textOverlay: post.textOverlay,
    sound: await formatSoundSummary(ctx, post.soundId, viewerId),
    soundVolume: post.soundVolume,
    originalVolume: post.originalVolume,
    audioMode: post.audioMode,
    hashtags: post.hashtags ?? [],
    language: post.language ?? null,
    subtitleLanguages: post.subtitleLanguages ?? [],
    poll: await formatPoll(ctx, post, viewerId),
    expiresAt: post.expiresAt ?? null,
    remixColor: post.remixColor ?? null,
    remixOf: await formatRemixOf(ctx, post.remixOfPostId),
    likeCount,
    isLiked,
    isBookmarked,
    commentCount,
    friendLikers,
    author: author
      ? {
          _id: author._id,
          name: author.name,
          username: author.username,
          avatarUrl: authorAvatarUrl,
          avatarGradient: author.avatarGradient,
          isVerified: author.isVerified ?? false,
        }
      : null,
  };
}

// ===========================================================================
// Ranking pipeline — feed_v1 / clips_v1
//
// candidate generation (bounded, indexed) -> eligibility filtering (blocks/
// privacy/audience/AI-hide, hard exclusions) -> feature calculation
// (language, affinity, engagement prediction, quality) -> scoring (blended
// with a cold-start ramp) -> diversity rerank -> bounded result.
//
// Only the shortlist (not the full candidate pool) gets the expensive,
// DB-backed feature pass — see preScore below — which keeps this bounded
// regardless of how many candidates the indexed fetch returns.
// ===========================================================================

const FEED_SHORTLIST_SIZE = 120;
const FEED_FINAL_SIZE = 100;
const CLIPS_SHORTLIST_SIZE = 120;
const CLIPS_FINAL_SIZE = 100;
const FRESH_WINDOW_MS = 48 * 60 * 60 * 1000;
const RECENT_ENGAGEMENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Cheap, DB-free pre-score used only to shrink a bounded candidate pool down
// to a shortlist worth spending real (DB-backed) feature computation on.
function preScore(post: Doc<'posts'>, viewer: Doc<'users'>, kind: 'post' | 'clip'): number {
  const lang = languageRelevance(viewer, {
    language: post.language ?? null,
    subtitleLanguages: post.subtitleLanguages,
  });
  return lang * timeDecay(post._creationTime, kind);
}

// Interleaves a small pool of exploration candidates into an already-ranked
// list every `every` positions — same pattern as interleaveAds.ts, applied
// to fresh/under-exposed content instead of ads.
function interleaveExploration<T>(main: T[], extra: T[], every: number): T[] {
  if (extra.length === 0) return main;
  const result: T[] = [];
  let e = 0;
  main.forEach((item, i) => {
    result.push(item);
    if ((i + 1) % every === 0 && e < extra.length) {
      result.push(extra[e]);
      e += 1;
    }
  });
  while (e < extra.length) {
    result.push(extra[e]);
    e += 1;
  }
  return result;
}

function pickExplorationPool<T extends Doc<'posts'>>(
  eligible: T[],
  excludeIds: Set<Id<'posts'>>,
  slots: number
): T[] {
  return eligible
    .filter((post) => !excludeIds.has(post._id) && Date.now() - post._creationTime < FRESH_WINDOW_MS)
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, slots);
}

async function scorePostCandidate(
  ctx: QueryCtx,
  post: Doc<'posts'>,
  viewer: Doc<'users'>
): Promise<{ post: Doc<'posts'>; score: number }> {
  const lang = languageRelevance(viewer, {
    language: post.language ?? null,
    subtitleLanguages: post.subtitleLanguages,
  });
  const decay = timeDecay(post._creationTime, 'post');

  const [affinityRaw, engagement, impressionStats, reportCount, hideCount] = await Promise.all([
    computeAffinity(ctx, viewer._id, post.authorId),
    getRecentEngagementCounts(ctx, post._id, Date.now() - RECENT_ENGAGEMENT_WINDOW_MS),
    getImpressionStats(ctx, post._id),
    getReportCount(ctx, post._id),
    getHideCount(ctx, post._id),
  ]);

  const pLike = smoothedRate(engagement.likes7d, impressionStats.impressions);
  const pComment = smoothedRate(engagement.comments7d, impressionStats.impressions);
  const pSave = smoothedRate(engagement.bookmarks7d, impressionStats.impressions);
  const pShare = smoothedRate(engagement.shares7d, impressionStats.impressions);
  const normalizedDwell = Math.min(1, impressionStats.avgWatchScore);

  const engagementPrediction = Math.min(
    6,
    FEED_WEIGHTS.engagement.like * pLike +
      FEED_WEIGHTS.engagement.comment * pComment +
      FEED_WEIGHTS.engagement.share * pShare +
      FEED_WEIGHTS.engagement.save * pSave +
      FEED_WEIGHTS.engagement.dwellWeight * normalizedDwell
  );

  const q = qualityScore(reportCount, hideCount, impressionStats.impressions);
  const affMult = affinityMultiplier(affinityRaw, FEED_WEIGHTS.affinityFloor, FEED_WEIGHTS.affinityCeiling);

  const personalizedScore = lang * affMult * (1 + engagementPrediction) * decay * q;
  const popularity = Math.min(
    3,
    Math.log(
      1 +
        engagement.likes7d +
        3 * engagement.comments7d +
        2 * engagement.bookmarks7d +
        4 * engagement.shares7d
    )
  );
  const trendingScore = lang * decay * q * (1 + popularity);

  const score = blendWithColdStart(trendingScore, personalizedScore, viewer.meaningfulInteractionCount ?? 0);
  return { post, score };
}

async function rankFeedCandidates(
  ctx: QueryCtx,
  eligible: Doc<'posts'>[],
  viewer: Doc<'users'>
): Promise<Doc<'posts'>[]> {
  if (eligible.length === 0) return [];

  const shortlist = eligible
    .map((post) => ({ post, score: preScore(post, viewer, 'post') }))
    .sort((a, b) => b.score - a.score)
    .slice(0, FEED_SHORTLIST_SIZE)
    .map((s) => s.post);

  const scored = await Promise.all(shortlist.map((post) => scorePostCandidate(ctx, post, viewer)));
  scored.sort((a, b) => b.score - a.score);

  const explorationSlots = Math.round(FEED_FINAL_SIZE * FEED_WEIGHTS.explorationRate);
  const mainSlots = Math.max(0, FEED_FINAL_SIZE - explorationSlots);
  const main = scored.slice(0, mainSlots).map((s) => s.post);
  const mainIds = new Set(main.map((post) => post._id));

  const explorationPool = pickExplorationPool(eligible, mainIds, explorationSlots);
  const every = explorationPool.length > 0 ? Math.max(1, Math.round(mainSlots / explorationPool.length)) : 1;
  const merged = interleaveExploration(main, explorationPool, every);

  return diversify(
    merged,
    (post) => post.authorId as string,
    FEED_WEIGHTS.diversityWindow,
    FEED_WEIGHTS.diversityMaxPerAuthor
  ).slice(0, FEED_FINAL_SIZE);
}

// Session-level UCB bias (see convex/lib/ucb.ts) over topic clusters
// (sound-based, falling back to the clip's first hashtag) — derived from
// this viewer's *own* impressions in the current session only, bounded to
// the 200 most recent. Returns null (no bias — every cluster ranks purely
// on its own merit) when no sessionId was supplied or nothing's been
// watched yet this session, which is the correct fallback for a session's
// very first clip.
async function buildSessionClusterBias(
  ctx: QueryCtx,
  viewerId: Id<'users'>,
  sessionId: string | undefined
): Promise<Map<string, number> | null> {
  if (!sessionId) return null;

  const impressions = await ctx.db
    .query('contentImpressions')
    .withIndex('by_user_session', (q) => q.eq('userId', viewerId).eq('sessionId', sessionId))
    .order('desc')
    .take(200);
  if (impressions.length === 0) return null;

  const stats = new Map<string, { totalReward: number; count: number }>();
  for (const impression of impressions) {
    if (!impression.cluster) continue;
    const reward =
      impression.watchMs != null && impression.duration
        ? watchReward(impression.watchMs, impression.duration)
        : impression.completed
          ? 1
          : 0;
    const existing = stats.get(impression.cluster) ?? { totalReward: 0, count: 0 };
    existing.totalReward += reward;
    existing.count += 1;
    stats.set(impression.cluster, existing);
  }
  if (stats.size === 0) return null;

  const totalPulls = impressions.length;
  const rawScores = new Map<string, number>();
  for (const [cluster, clusterStats] of stats) {
    rawScores.set(cluster, ucbScore(clusterStats, totalPulls));
  }
  const values = [...rawScores.values()];
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (avg <= 0) return null;

  const bias = new Map<string, number>();
  for (const [cluster, score] of rawScores) {
    bias.set(cluster, Math.min(1.6, Math.max(0.5, score / avg)));
  }
  return bias;
}

function clusterOf(post: Doc<'posts'>): string {
  return (post.soundId as string | undefined) ?? post.hashtags?.[0] ?? 'general';
}

async function scoreClipCandidate(
  ctx: QueryCtx,
  post: Doc<'posts'>,
  viewer: Doc<'users'>,
  clusterBias: Map<string, number> | null
): Promise<{ post: Doc<'posts'>; score: number }> {
  const lang = languageRelevance(viewer, {
    language: post.language ?? null,
    subtitleLanguages: post.subtitleLanguages,
  });
  const decay = timeDecay(post._creationTime, 'clip');

  const [engagement, impressionStats, reportCount, hideCount, velocity] = await Promise.all([
    getRecentEngagementCounts(ctx, post._id, Date.now() - RECENT_ENGAGEMENT_WINDOW_MS),
    getImpressionStats(ctx, post._id),
    getReportCount(ctx, post._id),
    getHideCount(ctx, post._id),
    post.soundId ? getSoundVelocityForSound(ctx, post.soundId) : Promise.resolve(0),
  ]);

  const watchScore = Math.min(CLIPS_WEIGHTS.watchScoreCap, impressionStats.avgWatchScore);
  const pLike = smoothedRate(engagement.likes7d, impressionStats.impressions);
  const pComment = smoothedRate(engagement.comments7d, impressionStats.impressions);
  const pShare = smoothedRate(engagement.shares7d, impressionStats.impressions);

  const engagementSum =
    CLIPS_WEIGHTS.w1_watch * watchScore +
    CLIPS_WEIGHTS.w2_like * pLike +
    CLIPS_WEIGHTS.w3_comment * pComment +
    CLIPS_WEIGHTS.w4_share * pShare +
    CLIPS_WEIGHTS.w5_soundVelocity * (velocity / 8); // normalized 0..1 (cap defined in lib/rankingConfig SOUND_VELOCITY.cap)

  const q = qualityScore(reportCount, hideCount, impressionStats.impressions);
  const bias = clusterBias?.get(clusterOf(post)) ?? 1;

  const personalizedScore = lang * engagementSum * decay * q * bias;
  const popularity = Math.min(
    3,
    Math.log(1 + engagement.likes7d + 3 * engagement.comments7d + 4 * engagement.shares7d)
  );
  const trendingScore = lang * decay * q * (1 + popularity);

  const score = blendWithColdStart(trendingScore, personalizedScore, viewer.meaningfulInteractionCount ?? 0);
  return { post, score };
}

async function rankClipCandidates(
  ctx: QueryCtx,
  eligible: Doc<'posts'>[],
  viewer: Doc<'users'>,
  sessionId: string | undefined
): Promise<Doc<'posts'>[]> {
  if (eligible.length === 0) return [];

  const clusterBias = await buildSessionClusterBias(ctx, viewer._id, sessionId);

  const shortlist = eligible
    .map((post) => ({ post, score: preScore(post, viewer, 'clip') }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CLIPS_SHORTLIST_SIZE)
    .map((s) => s.post);

  const scored = await Promise.all(
    shortlist.map((post) => scoreClipCandidate(ctx, post, viewer, clusterBias))
  );
  scored.sort((a, b) => b.score - a.score);

  const explorationSlots = Math.round(CLIPS_FINAL_SIZE * CLIPS_WEIGHTS.explorationRate);
  const mainSlots = Math.max(0, CLIPS_FINAL_SIZE - explorationSlots);
  const main = scored.slice(0, mainSlots).map((s) => s.post);
  const mainIds = new Set(main.map((post) => post._id));

  const explorationPool = pickExplorationPool(eligible, mainIds, explorationSlots);
  const every = explorationPool.length > 0 ? Math.max(1, Math.round(mainSlots / explorationPool.length)) : 1;
  const merged = interleaveExploration(main, explorationPool, every);

  return diversify(
    merged,
    (post) => post.authorId as string,
    CLIPS_WEIGHTS.diversityWindow,
    CLIPS_WEIGHTS.diversityMaxPerAuthor
  ).slice(0, CLIPS_FINAL_SIZE);
}

// Home feed: circle-scoped posts the viewer actually has access to (mutual
// friend for "Best Friends", joined membership for a user-created circle),
// plus their own. Global posts never show here — those belong on Explore.
// Falls back to plain reverse-chronological (still language/quality/
// exploration-aware — see rankFeedCandidates) whenever a viewer has no
// personalization signal yet, which is what the cold-start blend does
// automatically rather than a special-cased branch here.
export const listHomeFeed = query({
  args: { viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const viewer = await ctx.db.get(viewerId);
    if (!viewer) return [];

    const access = await getViewerCircleAccess(ctx, viewerId);
    const hidden = await getHiddenUserIds(ctx, viewerId);

    const candidates = await ctx.db.query('posts').order('desc').take(FEED_WEIGHTS.candidateLimit);
    const audienceVisible = candidates.filter(
      (post) =>
        !post.isAd &&
        !hidden.has(post.authorId) &&
        !isExpired(post) &&
        post.audience === 'circles' &&
        canViewCirclePost(post, viewerId, access)
    );
    const eligible = await filterHiddenAiContent(ctx, viewerId, audienceVisible, access.friendIds);

    const ranked = await rankFeedCandidates(ctx, eligible, viewer);
    return await Promise.all(ranked.map((post) => formatPost(ctx, post, viewerId)));
  },
});

// Posts scoped to one specific circle (a userCircles id, or the built-in
// 'best-friends' pseudo-circle) — the feed for a single circle's page,
// rather than the "all circles blended" home feed. Reuses the same
// canViewCirclePost gate as the home feed, just narrowed to posts that
// actually list this circleId.
export const listCirclePosts = query({
  args: { viewerId: v.id('users'), circleId: v.string(), sessionToken: v.string() },
  handler: async (ctx, { viewerId, circleId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const viewer = await ctx.db.get(viewerId);
    if (!viewer) return [];

    const access = await getViewerCircleAccess(ctx, viewerId);
    const hidden = await getHiddenUserIds(ctx, viewerId);

    const candidates = await ctx.db.query('posts').order('desc').take(FEED_WEIGHTS.candidateLimit);
    const visible = candidates.filter(
      (post) =>
        !post.isAd &&
        !hidden.has(post.authorId) &&
        !isExpired(post) &&
        post.audience === 'circles' &&
        (post.circleIds ?? []).includes(circleId) &&
        canViewCirclePost(post, viewerId, access)
    );
    const eligible = await filterHiddenAiContent(ctx, viewerId, visible, access.friendIds);

    return await Promise.all(eligible.map((post) => formatPost(ctx, post, viewerId)));
  },
});

// Explore feed: every globally-shared post, from anyone — no friendship gate
// for audience, but "Hide AI content" still exempts friends and the viewer's
// own posts, so that check needs friendIds even though visibility itself
// doesn't.
export const listExploreFeed = query({
  args: { viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const viewer = await ctx.db.get(viewerId);
    if (!viewer) return [];

    const { friendIds } = await getViewerCircleAccess(ctx, viewerId);
    const hidden = await getHiddenUserIds(ctx, viewerId);
    const candidates = await ctx.db.query('posts').order('desc').take(FEED_WEIGHTS.candidateLimit);
    const audienceVisible = candidates.filter(
      (post) =>
        !post.isAd &&
        !hidden.has(post.authorId) &&
        !isExpired(post) &&
        post.audience === 'global' &&
        (post.kind ?? 'post') !== 'clip'
    );
    const eligible = await filterHiddenAiContent(ctx, viewerId, audienceVisible, friendIds);

    const ranked = await rankFeedCandidates(ctx, eligible, viewer);
    return await Promise.all(ranked.map((post) => formatPost(ctx, post, viewerId)));
  },
});

// Clips feed: every globally-shared clip, TikTok-style — no friendship gate.
// `sessionId` is optional and client-generated (see appSession.ts) — when
// present it drives the session-level explore/exploit bias in
// buildSessionClusterBias; when absent, ranking still works, just without
// that bias (a sensible fallback, not a broken feature).
export const listClips = query({
  args: { viewerId: v.id('users'), sessionId: v.optional(v.string()), sessionToken: v.string() },
  handler: async (ctx, { viewerId, sessionId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const viewer = await ctx.db.get(viewerId);
    if (!viewer) return [];

    const candidates = await ctx.db.query('posts').order('desc').take(CLIPS_WEIGHTS.candidateLimit);
    const access = await getViewerCircleAccess(ctx, viewerId);
    const hidden = await getHiddenUserIds(ctx, viewerId);
    const audienceVisible = candidates.filter(
      (post) =>
        !post.isAd &&
        !hidden.has(post.authorId) &&
        !isExpired(post) &&
        post.kind === 'clip' &&
        (post.audience === 'global' || canViewCirclePost(post, viewerId, access))
    );
    const eligible = await filterHiddenAiContent(ctx, viewerId, audienceVisible, access.friendIds);

    const ranked = await rankClipCandidates(ctx, eligible, viewer, sessionId);
    return await Promise.all(ranked.map((post) => formatPost(ctx, post, viewerId)));
  },
});

// Single post lookup — used to render a shared-post message bubble in chat.
export const getPost = query({
  args: { postId: v.id('posts'), viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { postId, viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    const post = await ctx.db.get(postId);
    if (!post || isExpired(post)) return null;
    const hidden = await getHiddenUserIds(ctx, viewerId);
    if (hidden.has(post.authorId)) return null;
    return await formatPost(ctx, post, viewerId);
  },
});

// Unauthenticated single-post lookup for shared links opened by a signed-out
// visitor (web landing page / mobile "install the app" preview). Only ever
// exposes globally-shared, non-clip posts — never circle-scoped content,
// since there's no viewer identity to check audience access against — and
// never per-viewer engagement state (like/bookmark), since there's no
// viewer to have liked or bookmarked anything.
export const getPublicPost = query({
  args: { postId: v.id('posts'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post || isExpired(post) || post.isAd) return null;
    if (post.audience !== 'global') return null;

    const author = await ctx.db.get(post.authorId);
    const mediaUrl = await ctx.storage.getUrl(post.mediaStorageId);
    const authorAvatarUrl = author?.avatarStorageId
      ? await ctx.storage.getUrl(author.avatarStorageId)
      : null;
    const likeCount = (
      await ctx.db
        .query('likes')
        .withIndex('by_post', (q) => q.eq('postId', postId))
        .collect()
    ).length;
    const commentCount = (
      await ctx.db
        .query('comments')
        .withIndex('by_post', (q) => q.eq('postId', postId))
        .collect()
    ).length;

    return {
      _id: post._id,
      _creationTime: post._creationTime,
      title: post.title,
      caption: post.caption,
      mediaType: post.mediaType,
      mediaUrl,
      kind: post.kind ?? 'post',
      textOverlay: post.textOverlay,
      hashtags: post.hashtags ?? [],
      likeCount,
      commentCount,
      author: author
        ? {
            _id: author._id,
            name: author.name,
            username: author.username,
            avatarUrl: authorAvatarUrl,
            avatarGradient: author.avatarGradient,
            isVerified: author.isVerified ?? false,
          }
        : null,
    };
  },
});
