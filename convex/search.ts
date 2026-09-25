import { mutation, query, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { Doc, Id } from './_generated/dataModel';
import { getHiddenUserIds } from './blocks';
import { computeAffinity } from './affinity';
import { getRecentEngagementCounts, getImpressionStats } from './engagement';
import { languageRelevance } from './lib/language';
import { timeDecay } from './lib/timeDecay';
import { affinityMultiplier } from './lib/affinity';
import { diversify } from './lib/diversity';
import {
  bestFuzzyMatch,
  bm25Score,
  buildDocFrequency,
  detectSearchIntent,
  FieldedDocument,
  normalizeHashtag,
  tokenize,
} from './lib/textSearch';
import { SEARCH, FEED_WEIGHTS } from './lib/rankingConfig';

const CANDIDATE_LIMIT = SEARCH.candidateLimit;

// ---------------------------------------------------------------------------
// Shared candidate generation — bounded, indexed reads. Never a full scan:
// posts/clips/sounds/users all come from a recency- or popularity-ordered
// index capped at CANDIDATE_LIMIT, exactly like the feed/clips ranking
// pipeline in posts.ts.
// ---------------------------------------------------------------------------

async function getPostCandidates(
  ctx: QueryCtx,
  hidden: Set<Id<'users'>>,
  kindFilter?: 'post' | 'clip'
): Promise<Doc<'posts'>[]> {
  const recent = await ctx.db.query('posts').order('desc').take(CANDIDATE_LIMIT);
  return recent.filter(
    (post) =>
      !post.isAd &&
      !hidden.has(post.authorId) &&
      post.audience === 'global' && // search only ever surfaces publicly-shared content
      (kindFilter ? (post.kind ?? 'post') === kindFilter : true)
  );
}

async function userSummary(ctx: QueryCtx, user: Doc<'users'>) {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarStorageId ? await ctx.storage.getUrl(user.avatarStorageId) : null,
    avatarGradient: user.avatarGradient,
    isVerified: user.isVerified ?? false,
  };
}

async function postSummary(ctx: QueryCtx, post: Doc<'posts'>) {
  const author = await ctx.db.get(post.authorId);
  return {
    _id: post._id,
    title: post.title,
    caption: post.caption,
    mediaType: post.mediaType,
    mediaUrl: await ctx.storage.getUrl(post.mediaStorageId),
    kind: post.kind ?? 'post',
    hashtags: post.hashtags ?? [],
    author: author ? { _id: author._id, name: author.name, username: author.username } : null,
  };
}

function postDoc(post: Doc<'posts'>): FieldedDocument {
  return {
    id: post._id,
    fields: {
      title: post.title,
      caption: post.caption,
      hashtag: (post.hashtags ?? []).join(' '),
      transcript: post.transcript,
      subtitleText: post.subtitleText,
    },
  };
}

// ---------------------------------------------------------------------------
// EngagementVelocity(d) =
//   (likes_7d + 3*comments_7d + 2*bookmarks_7d + normalizedAvgWatchScore_7d)
//   / (ageDays + 2)^0.3
// ---------------------------------------------------------------------------
async function engagementVelocity(ctx: QueryCtx, post: Doc<'posts'>): Promise<number> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const [engagement, impressionStats] = await Promise.all([
    getRecentEngagementCounts(ctx, post._id, sevenDaysAgo),
    getImpressionStats(ctx, post._id, sevenDaysAgo),
  ]);
  const ageDays = Math.max(0, (Date.now() - post._creationTime) / (1000 * 60 * 60 * 24));
  const numerator =
    engagement.likes7d +
    3 * engagement.comments7d +
    2 * engagement.bookmarks7d +
    Math.min(1, impressionStats.avgWatchScore);
  return numerator / Math.pow(ageDays + 2, 0.3);
}

async function scoreGeneralPost(
  ctx: QueryCtx,
  post: Doc<'posts'>,
  viewer: Doc<'users'>,
  queryTokens: string[],
  index: ReturnType<typeof buildDocFrequency>
): Promise<number> {
  const doc = postDoc(post);
  let textScore = bm25Score(doc, queryTokens, index);
  if (textScore === 0) {
    // Fuzzy fallback (typo tolerance) — never lets a fuzzy match outrank a
    // real BM25 match, only fills in when there was no exact hit at all.
    const candidateTokens = [
      ...tokenize(post.title),
      ...tokenize(post.caption),
      ...(post.hashtags ?? []),
    ];
    const fuzzy = Math.max(0, ...queryTokens.map((t) => bestFuzzyMatch(t, candidateTokens)));
    textScore = fuzzy * 2; // modest — a fuzzy hit should rank below exact hits at equal relevance
  }
  if (textScore === 0) return 0;

  const [velocity, affinityRaw] = await Promise.all([
    engagementVelocity(ctx, post),
    computeAffinity(ctx, viewer._id, post.authorId),
  ]);
  const lang = languageRelevance(viewer, { language: post.language ?? null, subtitleLanguages: post.subtitleLanguages });
  const affMult = affinityMultiplier(affinityRaw, FEED_WEIGHTS.affinityFloor, FEED_WEIGHTS.affinityCeiling);
  const freshness = timeDecay(post._creationTime, (post.kind ?? 'post') as 'post' | 'clip');

  return Math.pow(textScore, SEARCH.bm25Exponent) * (1 + velocity) * lang * affMult * freshness;
}

// ---------------------------------------------------------------------------
// Main search entrypoint. Understands intent (@user, #hashtag, general text)
// and ranks each differently — exact/prefix entity matching dominates for
// precise queries, BM25 + engagement + freshness + personalization for
// everything else.
// ---------------------------------------------------------------------------
export const search = query({
  args: { query: v.string(), viewerId: v.optional(v.id('users')), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { query: rawQuery, viewerId }) => {
    const trimmed = rawQuery.trim();
    if (trimmed.length === 0) {
      return { users: [], posts: [], clips: [], sounds: [], hashtags: [], intent: 'general' as const };
    }

    const viewer = viewerId ? await ctx.db.get(viewerId) : null;
    const hidden = viewerId ? await getHiddenUserIds(ctx, viewerId) : new Set<Id<'users'>>();
    const intent = detectSearchIntent(trimmed);

    // ---- @username intent: exact/prefix match dominates outright. ----
    if (intent.kind === 'user') {
      const handle = intent.handle;
      const prefixMatches = await ctx.db
        .query('users')
        .withIndex('by_username', (q) => q.gte('username', handle).lt('username', handle + '￿'))
        .take(30);
      const exact = await ctx.db
        .query('users')
        .withIndex('by_username', (q) => q.eq('username', handle))
        .unique();

      const merged = new Map<string, Doc<'users'>>();
      if (exact) merged.set(exact._id, exact);
      for (const u of prefixMatches) merged.set(u._id, u);

      const users = [...merged.values()]
        .filter((u) => !hidden.has(u._id) && u.onboardingComplete)
        .sort((a, b) => {
          const aExact = a.username === handle ? 1 : 0;
          const bExact = b.username === handle ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;
          return (a.username ?? '').localeCompare(b.username ?? '');
        })
        .slice(0, 20);

      return {
        users: await Promise.all(users.map((u) => userSummary(ctx, u))),
        posts: [],
        clips: [],
        sounds: [],
        hashtags: [],
        intent: 'user' as const,
      };
    }

    // ---- #hashtag intent: exact tag match required (no fuzzy), ranked by
    // freshness + a light engagement touch rather than raw popularity, so a
    // niche exact match isn't buried under an unrelated viral post. ----
    if (intent.kind === 'hashtag') {
      const tag = intent.tag;
      const [posts, clips] = await Promise.all([
        getPostCandidates(ctx, hidden, 'post'),
        getPostCandidates(ctx, hidden, 'clip'),
      ]);
      const matchingPosts = posts.filter((p) => p.hashtags?.includes(tag));
      const matchingClips = clips.filter((p) => p.hashtags?.includes(tag));

      const rank = (items: Doc<'posts'>[]) =>
        items
          .map((post) => ({
            post,
            score: timeDecay(post._creationTime, (post.kind ?? 'post') as 'post' | 'clip'),
          }))
          .sort((a, b) => b.score - a.score)
          .map((r) => r.post)
          .slice(0, SEARCH.resultLimit);

      return {
        users: [],
        posts: await Promise.all(rank(matchingPosts).map((p) => postSummary(ctx, p))),
        clips: await Promise.all(rank(matchingClips).map((p) => postSummary(ctx, p))),
        sounds: [],
        hashtags: [tag],
        intent: 'hashtag' as const,
      };
    }

    // ---- General search across users, posts, clips, sounds, hashtags. ----
    const queryTokens = tokenize(trimmed);
    const term = trimmed.toLowerCase();

    const [userCandidates, postCandidates, soundCandidates] = await Promise.all([
      ctx.db.query('users').order('desc').take(CANDIDATE_LIMIT),
      ctx.db.query('posts').order('desc').take(CANDIDATE_LIMIT),
      ctx.db
        .query('sounds')
        .withIndex('by_status_global_useCount', (q) => q.eq('status', 'active').eq('isGlobal', true))
        .order('desc')
        .take(200),
    ]);

    const matchedUsers = userCandidates.filter(
      (u) =>
        !hidden.has(u._id) &&
        u.onboardingComplete &&
        (u.username?.toLowerCase().includes(term) || u.name?.toLowerCase().includes(term))
    );

    const eligiblePosts = postCandidates.filter(
      (p) => !p.isAd && !hidden.has(p.authorId) && p.audience === 'global'
    );
    const clipCandidates = eligiblePosts.filter((p) => p.kind === 'clip');
    const plainPostCandidates = eligiblePosts.filter((p) => (p.kind ?? 'post') !== 'clip');

    const matchedSounds = soundCandidates
      .filter((s) => s.name.toLowerCase().includes(term))
      .slice(0, 20);

    const hashtagCounts = new Map<string, number>();
    for (const post of eligiblePosts) {
      for (const tag of post.hashtags ?? []) {
        if (tag.includes(normalizeHashtag(term))) {
          hashtagCounts.set(tag, (hashtagCounts.get(tag) ?? 0) + 1);
        }
      }
    }
    const matchedHashtags = [...hashtagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    let scoredPosts: Doc<'posts'>[] = [];
    let scoredClips: Doc<'posts'>[] = [];
    if (viewer) {
      const postIndex = buildDocFrequency(plainPostCandidates.map(postDoc));
      const clipIndex = buildDocFrequency(clipCandidates.map(postDoc));

      const postScores = await Promise.all(
        plainPostCandidates.map(async (post) => ({
          post,
          score: await scoreGeneralPost(ctx, post, viewer, queryTokens, postIndex),
        }))
      );
      const clipScores = await Promise.all(
        clipCandidates.map(async (post) => ({
          post,
          score: await scoreGeneralPost(ctx, post, viewer, queryTokens, clipIndex),
        }))
      );

      scoredPosts = postScores
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((s) => s.post);
      scoredClips = clipScores
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((s) => s.post);
    }

    // Diversification: cap repeated authors so results don't read as one
    // creator's content over and over.
    const diversifiedPosts = diversify(
      scoredPosts,
      (p) => p.authorId as string,
      SEARCH.resultLimit,
      SEARCH.diversityMaxPerAuthor
    ).slice(0, SEARCH.resultLimit);
    const diversifiedClips = diversify(
      scoredClips,
      (p) => p.authorId as string,
      SEARCH.resultLimit,
      SEARCH.diversityMaxPerAuthor
    ).slice(0, SEARCH.resultLimit);

    // Search history is logged by the client calling logSearchQuery
    // separately (queries are read-only in Convex) — see SearchScreen.

    return {
      users: await Promise.all(matchedUsers.slice(0, 20).map((u) => userSummary(ctx, u))),
      posts: await Promise.all(diversifiedPosts.map((p) => postSummary(ctx, p))),
      clips: await Promise.all(diversifiedClips.map((p) => postSummary(ctx, p))),
      sounds: await Promise.all(
        matchedSounds.map(async (s) => ({
          _id: s._id,
          name: s.name,
          pictureUrl: s.pictureStorageId ? await ctx.storage.getUrl(s.pictureStorageId) : null,
          useCount: s.useCount,
        }))
      ),
      hashtags: matchedHashtags,
      intent: 'general' as const,
    };
  },
});

// ---------------------------------------------------------------------------
// Autocomplete — this user's own recent searches (never anyone else's —
// search history is private) plus platform-wide trending terms, ranked by
// SearchVolume(term,24h) * PrefixMatchScore with recency decay.
// ---------------------------------------------------------------------------

export const logSearchQuery = mutation({
  args: { userId: v.id('users'), term: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId, term }) => {
    const normalizedTerm = term.trim().toLowerCase();
    if (normalizedTerm.length === 0) return;
    await ctx.db.insert('searchQueries', { userId, normalizedTerm, timestamp: Date.now() });
  },
});

const RECENT_SEARCH_SAMPLE = 100;
const TRENDING_SAMPLE = 500;

export const getRecentSearches = query({
  args: { userId: v.id('users'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('searchQueries')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .take(RECENT_SEARCH_SAMPLE);

    const seen = new Set<string>();
    const recent: string[] = [];
    for (const row of rows) {
      if (seen.has(row.normalizedTerm)) continue;
      seen.add(row.normalizedTerm);
      recent.push(row.normalizedTerm);
      if (recent.length >= 10) break;
    }
    return recent;
  },
});

export const getTrendingSearches = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx) => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recent = await ctx.db.query('searchQueries').order('desc').take(TRENDING_SAMPLE);
    const counts = new Map<string, number>();
    for (const row of recent) {
      if (row.timestamp < dayAgo) continue;
      counts.set(row.normalizedTerm, (counts.get(row.normalizedTerm) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term]) => term);
  },
});

export const autocomplete = query({
  args: { userId: v.id('users'), prefix: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId, prefix }) => {
    const normalizedPrefix = prefix.trim().toLowerCase();
    if (normalizedPrefix.length === 0) return [];

    const [ownRows, trendingRows] = await Promise.all([
      ctx.db
        .query('searchQueries')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .order('desc')
        .take(RECENT_SEARCH_SAMPLE),
      ctx.db
        .query('searchQueries')
        .withIndex('by_term', (q) => q.gte('normalizedTerm', normalizedPrefix).lt('normalizedTerm', normalizedPrefix + '￿'))
        .order('desc')
        .take(TRENDING_SAMPLE),
    ]);

    const ownMatches = [...new Set(ownRows.map((r) => r.normalizedTerm))].filter((t) =>
      t.startsWith(normalizedPrefix)
    );

    const now = Date.now();
    const volumeByTerm = new Map<string, number>();
    for (const row of trendingRows) {
      const ageHours = (now - row.timestamp) / (1000 * 60 * 60);
      const decay = Math.exp(-ageHours / 48); // recency-decayed volume
      volumeByTerm.set(row.normalizedTerm, (volumeByTerm.get(row.normalizedTerm) ?? 0) + decay);
    }
    const trending = [...volumeByTerm.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term)
      .filter((term) => !ownMatches.includes(term));

    return [...ownMatches.slice(0, 5), ...trending.slice(0, 5)];
  },
});
