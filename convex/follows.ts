import { ConvexError, v } from 'convex/values';
import { mutation, query, QueryCtx } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import { getHiddenUserIds } from './blocks';
import { jaccard, adamicAdar } from './lib/social';
import { languageCompatibility } from './lib/language';
import { geoScore, cityMatchScore } from './lib/geo';
import { normalizeLocationName } from './lib/locations';
import { FRIEND_SCORE_WEIGHTS } from './lib/rankingConfig';
import { rateLimiter } from './lib/rateLimit';
import { requireUser } from './lib/session';

export const follow = mutation({
  args: { followerId: v.id('users'), followingId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { followerId, followingId, sessionToken }) => {
    if (followerId === followingId) return;

    await requireUser(ctx, followerId, sessionToken);
    await rateLimiter.limit(ctx, 'follow', { key: followerId, throws: true });

    const hidden = await getHiddenUserIds(ctx, followerId);
    if (hidden.has(followingId)) {
      throw new ConvexError("You can't follow this account.");
    }

    const existing = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) =>
        q.eq('followerId', followerId).eq('followingId', followingId)
      )
      .unique();
    if (existing) return;

    await ctx.db.insert('follows', { followerId, followingId });
  },
});

export const unfollow = mutation({
  args: { followerId: v.id('users'), followingId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { followerId, followingId, sessionToken }) => {
    await requireUser(ctx, followerId, sessionToken);

    const existing = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) =>
        q.eq('followerId', followerId).eq('followingId', followingId)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getFollowingIds = query({
  args: { followerId: v.id('users'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { followerId }) => {
    const rows = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', followerId))
      .collect();
    return rows.map((r) => r.followingId);
  },
});

export const areFriends = query({
  args: { userA: v.id('users'), userB: v.id('users'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userA, userB }) => {
    const aFollowsB = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', userA).eq('followingId', userB))
      .unique();
    const bFollowsA = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', userB).eq('followingId', userA))
      .unique();
    return Boolean(aFollowsB) && Boolean(bFollowsA);
  },
});

export const getFollowCounts = query({
  args: { userId: v.id('users'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    const following = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', userId))
      .collect();
    const followers = await ctx.db
      .query('follows')
      .withIndex('by_following', (q) => q.eq('followingId', userId))
      .collect();

    return { followers: followers.length, following: following.length };
  },
});

async function userSummary(ctx: any, userId: any) {
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

export const getFollowers = query({
  args: { userId: v.id('users'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('follows')
      .withIndex('by_following', (q) => q.eq('followingId', userId))
      .collect();
    const hidden = await getHiddenUserIds(ctx, userId);
    const users = await Promise.all(
      rows.filter((r) => !hidden.has(r.followerId)).map((r) => userSummary(ctx, r.followerId))
    );
    return users.filter((u) => u !== null);
  },
});

export const getFollowingUsers = query({
  args: { userId: v.id('users'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', userId))
      .collect();
    const hidden = await getHiddenUserIds(ctx, userId);
    const users = await Promise.all(
      rows.filter((r) => !hidden.has(r.followingId)).map((r) => userSummary(ctx, r.followingId))
    );
    return users.filter((u) => u !== null);
  },
});

// Same as getFollowingUsers, but flagged with mutual-follow ("friend") status
// and sorted friends-first — used for the new-message recipient picker.
export const listFollowingForNewMessage = query({
  args: { userId: v.id('users'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    const followingRows = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', userId))
      .collect();
    const followerRows = await ctx.db
      .query('follows')
      .withIndex('by_following', (q) => q.eq('followingId', userId))
      .collect();
    const followerIds = new Set(followerRows.map((r) => r.followerId));
    const hidden = await getHiddenUserIds(ctx, userId);

    const users = await Promise.all(
      followingRows
        .filter((row) => !hidden.has(row.followingId))
        .map(async (row) => {
        const summary = await userSummary(ctx, row.followingId);
        if (!summary) return null;
        return { ...summary, isFriend: followerIds.has(row.followingId) };
      })
    );

    const valid = users.filter((u): u is NonNullable<typeof u> => u !== null);
    valid.sort((a, b) => Number(b.isFriend) - Number(a.isFriend));
    return valid;
  },
});

// A user's social "neighborhood" — following + followers combined — bounded
// per side so degree lookups for Adamic-Adar stay cheap even for a very
// well-connected account.
const NEIGHBOR_CAP = 300;
async function getNeighborSet(ctx: QueryCtx, userId: Id<'users'>): Promise<Set<Id<'users'>>> {
  const [following, followers] = await Promise.all([
    ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', userId))
      .take(NEIGHBOR_CAP),
    ctx.db
      .query('follows')
      .withIndex('by_following', (q) => q.eq('followingId', userId))
      .take(NEIGHBOR_CAP),
  ]);
  return new Set([...following.map((r) => r.followingId), ...followers.map((r) => r.followerId)]);
}

function cityOf(user: Doc<'users'>): string | null {
  return user.location ? normalizeLocationName(user.location) : null;
}

// FriendScore(u,v) = alpha*Jaccard(N(u),N(v)) + beta*AdamicAdar(u,v) +
//                    gamma*sharedCircles(u,v) + delta*LanguageCompat(u,v) +
//                    epsilon*GeoScore(u,v)
//
// Candidate generation (bounded, indexed): second-degree connections (a
// sample of the viewer's own followees' followees) plus co-members of the
// viewer's own joined circles — the two candidate sources the spec calls
// out that are cheap to fetch without a full user-table scan. Geographic/
// language "candidate generation" instead happens as *scoring*, applied to
// this same bounded pool, rather than a second full scan.
export const getFriendSuggestions = query({
  args: { userId: v.id('users'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    const viewer = await ctx.db.get(userId);
    if (!viewer) return [];

    const hidden = await getHiddenUserIds(ctx, userId);
    const followingRows = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', userId))
      .collect();
    const followingIds = new Set(followingRows.map((r) => r.followingId));

    // Candidate source 1: second-degree connections. Bounded fan-out: at
    // most 60 of the viewer's own followees, at most 50 of each of theirs.
    const fanOutSample = followingRows.slice(0, 60);
    const secondDegreeLists = await Promise.all(
      fanOutSample.map((row) =>
        ctx.db
          .query('follows')
          .withIndex('by_follower_following', (q) => q.eq('followerId', row.followingId))
          .take(50)
      )
    );
    const mutualConnectionCounts = new Map<Id<'users'>, number>();
    for (const list of secondDegreeLists) {
      for (const row of list) {
        mutualConnectionCounts.set(row.followingId, (mutualConnectionCounts.get(row.followingId) ?? 0) + 1);
      }
    }

    // Candidate source 2: co-members of the viewer's own joined circles.
    const myMemberships = await ctx.db
      .query('circleMemberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const myJoinedCircleIds = myMemberships.filter((m) => m.status === 'joined').map((m) => m.circleId);
    const circleNames = new Map<string, string>();
    const circleMemberLists = await Promise.all(
      myJoinedCircleIds.slice(0, 20).map(async (circleId) => {
        const circle = await ctx.db.get(circleId);
        if (circle) circleNames.set(circleId, circle.name);
        return ctx.db
          .query('circleMemberships')
          .withIndex('by_circle', (q) => q.eq('circleId', circleId))
          .take(100);
      })
    );
    const sharedCircleNamesByCandidate = new Map<Id<'users'>, Set<string>>();
    for (let i = 0; i < circleMemberLists.length; i++) {
      const circleId = myJoinedCircleIds[i];
      const circleName = circleNames.get(circleId);
      for (const membership of circleMemberLists[i]) {
        if (membership.status !== 'joined') continue;
        mutualConnectionCounts.set(membership.userId, mutualConnectionCounts.get(membership.userId) ?? 0);
        if (circleName) {
          const set = sharedCircleNamesByCandidate.get(membership.userId) ?? new Set<string>();
          set.add(circleName);
          sharedCircleNamesByCandidate.set(membership.userId, set);
        }
      }
    }

    // Eligibility filter, then a cheap pre-score (raw mutual-connection
    // count) shortlists the bounded candidate pool before the more
    // expensive per-candidate scoring below.
    const eligibleCandidateIds = [...mutualConnectionCounts.keys()].filter(
      (id) =>
        id !== userId &&
        !followingIds.has(id) &&
        !hidden.has(id)
    );
    const shortlistIds = eligibleCandidateIds
      .sort((a, b) => (mutualConnectionCounts.get(b) ?? 0) - (mutualConnectionCounts.get(a) ?? 0))
      .slice(0, FRIEND_SCORE_WEIGHTS.candidateLimit);

    const myNeighbors = await getNeighborSet(ctx, userId);
    const myCity = cityOf(viewer);
    const myCoords = viewer.lat != null && viewer.lng != null ? { lat: viewer.lat, lng: viewer.lng } : null;

    const scored = await Promise.all(
      shortlistIds.map(async (candidateId) => {
        const candidate = await ctx.db.get(candidateId);
        if (!candidate || !candidate.onboardingComplete || candidate.discoverable === false) return null;

        const [candidateNeighbors] = await Promise.all([getNeighborSet(ctx, candidateId)]);
        const jaccardScore = jaccard(myNeighbors, candidateNeighbors);
        const commonNeighbors = new Set(
          [...myNeighbors].filter((id) => candidateNeighbors.has(id))
        );
        // Degree lookups are cheap here — the common-neighbor set is a small
        // intersection of two already-bounded sets, not a fresh full scan.
        const degrees = new Map<Id<'users'>, number>();
        await Promise.all(
          [...commonNeighbors].map(async (id) => {
            degrees.set(id, (await getNeighborSet(ctx, id)).size);
          })
        );
        const adamicAdarScore = adamicAdar(myNeighbors, candidateNeighbors, (id) => degrees.get(id) ?? 0);

        const sharedCircles = sharedCircleNamesByCandidate.get(candidateId) ?? new Set<string>();
        const candidateCity = cityOf(candidate);
        const candidateCoords =
          candidate.lat != null && candidate.lng != null ? { lat: candidate.lat, lng: candidate.lng } : null;
        const geo =
          myCoords && candidateCoords ? geoScore(myCoords, candidateCoords) : cityMatchScore(myCity, candidateCity);

        const score =
          FRIEND_SCORE_WEIGHTS.jaccard * jaccardScore +
          FRIEND_SCORE_WEIGHTS.adamicAdar * adamicAdarScore +
          FRIEND_SCORE_WEIGHTS.sharedCircles * sharedCircles.size +
          FRIEND_SCORE_WEIGHTS.language * languageCompatibility(viewer, candidate) +
          FRIEND_SCORE_WEIGHTS.geo * geo;

        return {
          candidate,
          score,
          mutualCount: mutualConnectionCounts.get(candidateId) ?? 0,
          sharedCircleNames: [...sharedCircles],
        };
      })
    );

    const ranked = scored
      .filter((s): s is NonNullable<typeof s> => s !== null && s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    return await Promise.all(
      ranked.map(async ({ candidate, mutualCount, sharedCircleNames }) => ({
        _id: candidate._id,
        name: candidate.name,
        username: candidate.username,
        avatarUrl: candidate.avatarStorageId ? await ctx.storage.getUrl(candidate.avatarStorageId) : null,
        avatarGradient: candidate.avatarGradient,
        mutualCount,
        sharedCircleNames,
      }))
    );
  },
});

// Compatibility alias for clients that loaded the earlier misspelled name.
export const getFriendsSUggestions = getFriendSuggestions;

// Bounded fallback discovery — a recent-signups sample rather than a full
// table scan, then shuffled so it doesn't always show the exact same slice.
// Real randomness across the whole user base would need either a random-
// order index or a precomputed sample table; this is the pragmatic bounded
// approximation until one of those exists.
const RANDOM_SAMPLE_POOL = 300;

export const getRandomUsers = query({
  args: { userId: v.id('users'), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    const following = await ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', userId))
      .collect();
    const hidden = await getHiddenUserIds(ctx, userId);
    const excluded = new Set([userId, ...following.map((row) => row.followingId), ...hidden]);
    const users = (await ctx.db.query('users').order('desc').take(RANDOM_SAMPLE_POOL))
      .filter(
        (user) => user.onboardingComplete && user.discoverable !== false && !excluded.has(user._id)
      )
      .sort(() => Math.random() - 0.5)
      .slice(0, 20);

    return await Promise.all(
      users.map(async (user) => ({
        _id: user._id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarStorageId ? await ctx.storage.getUrl(user.avatarStorageId) : null,
        avatarGradient: user.avatarGradient,
      }))
    );
  },
});
