// DB-aware gathering of Affinity(u,v) inputs — bounded, indexed reads only
// (see convex/lib/affinity.ts for the pure scoring formula this feeds).
import { QueryCtx } from './_generated/server';
import { Id } from './_generated/dataModel';
import { affinityScore, AffinityInputs } from './lib/affinity';
import { conversationId } from './messages';

const RECENT_POST_SAMPLE = 30;
const DM_LOG_SAMPLE = 200;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function sharedCircleCount(
  ctx: QueryCtx,
  userA: Id<'users'>,
  userB: Id<'users'>
): Promise<number> {
  const [membershipsA, membershipsB] = await Promise.all([
    ctx.db
      .query('circleMemberships')
      .withIndex('by_user', (q) => q.eq('userId', userA))
      .collect(),
    ctx.db
      .query('circleMemberships')
      .withIndex('by_user', (q) => q.eq('userId', userB))
      .collect(),
  ]);

  const joinedA = new Set(
    membershipsA.filter((m) => m.status === 'joined').map((m) => m.circleId)
  );
  let count = 0;
  for (const m of membershipsB) {
    if (m.status === 'joined' && joinedA.has(m.circleId)) count += 1;
  }
  return count;
}

// pastLikes(u, v's posts) — bounded to v's most recent posts rather than
// scanning either user's full history, per AGENTS.md's "no expensive
// relationship calculations over the entire social graph".
async function pastLikesOnPosts(
  ctx: QueryCtx,
  viewerId: Id<'users'>,
  authorId: Id<'users'>
): Promise<number> {
  const recentPosts = await ctx.db
    .query('posts')
    .withIndex('by_author', (q) => q.eq('authorId', authorId))
    .order('desc')
    .take(RECENT_POST_SAMPLE);

  const likeChecks = await Promise.all(
    recentPosts.map((post) =>
      ctx.db
        .query('likes')
        .withIndex('by_post_user', (q) => q.eq('postId', post._id).eq('userId', viewerId))
        .unique()
    )
  );
  return likeChecks.filter((row) => row !== null).length;
}

async function dmCount30d(ctx: QueryCtx, userA: Id<'users'>, userB: Id<'users'>): Promise<number> {
  const convId = conversationId(userA, userB);
  const since = Date.now() - THIRTY_DAYS_MS;
  const recent = await ctx.db
    .query('messages')
    .withIndex('by_conversation', (q) => q.eq('conversationId', convId))
    .order('desc')
    .take(DM_LOG_SAMPLE);
  return recent.filter((m) => m._creationTime >= since).length;
}

export async function gatherAffinityInputs(
  ctx: QueryCtx,
  viewerId: Id<'users'>,
  otherUserId: Id<'users'>
): Promise<AffinityInputs> {
  if (viewerId === otherUserId) {
    return { follows: true, mutualFollow: true, sharedCircleCount: 0, dms30d: 0, pastLikesOnTheirPosts: 0 };
  }

  const [aFollowsB, bFollowsA, circles, dms, likes] = await Promise.all([
    ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', viewerId).eq('followingId', otherUserId))
      .unique(),
    ctx.db
      .query('follows')
      .withIndex('by_follower_following', (q) => q.eq('followerId', otherUserId).eq('followingId', viewerId))
      .unique(),
    sharedCircleCount(ctx, viewerId, otherUserId),
    dmCount30d(ctx, viewerId, otherUserId),
    pastLikesOnPosts(ctx, viewerId, otherUserId),
  ]);

  return {
    follows: aFollowsB !== null,
    mutualFollow: aFollowsB !== null && bFollowsA !== null,
    sharedCircleCount: circles,
    dms30d: dms,
    pastLikesOnTheirPosts: likes,
  };
}

export async function computeAffinity(
  ctx: QueryCtx,
  viewerId: Id<'users'>,
  otherUserId: Id<'users'>
): Promise<number> {
  const inputs = await gatherAffinityInputs(ctx, viewerId, otherUserId);
  return affinityScore(inputs);
}
