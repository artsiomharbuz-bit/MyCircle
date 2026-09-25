// Bounded, indexed helpers for recent engagement/quality signals — every
// query here reads off an index scoped to a single post (or a small,
// take()-bounded slice of one), never a table scan, so it's safe to call
// once per candidate in a feed/search ranking pass.
import { QueryCtx } from './_generated/server';
import { Id } from './_generated/dataModel';

const IMPRESSION_SAMPLE_CAP = 500;

export async function getRecentEngagementCounts(
  ctx: QueryCtx,
  postId: Id<'posts'>,
  sinceMs: number
) {
  const [likes, comments, bookmarks, shares] = await Promise.all([
    ctx.db
      .query('likes')
      .withIndex('by_post', (q) => q.eq('postId', postId))
      .collect(),
    ctx.db
      .query('comments')
      .withIndex('by_post', (q) => q.eq('postId', postId))
      .collect(),
    ctx.db
      .query('bookmarks')
      .withIndex('by_post_user', (q) => q.eq('postId', postId))
      .collect(),
    ctx.db
      .query('postShares')
      .withIndex('by_post', (q) => q.eq('postId', postId))
      .collect(),
  ]);

  return {
    likes7d: likes.filter((l) => l._creationTime >= sinceMs).length,
    comments7d: comments.filter((c) => c._creationTime >= sinceMs).length,
    bookmarks7d: bookmarks.filter((b) => b._creationTime >= sinceMs).length,
    shares7d: shares.filter((s) => s.sharedAt >= sinceMs).length,
    likesTotal: likes.length,
    commentsTotal: comments.length,
    bookmarksTotal: bookmarks.length,
    sharesTotal: shares.length,
  };
}

// Active (non-dismissed) reports against this post — a dismissed report was
// judged to be unfounded, so it shouldn't count against quality.
export async function getReportCount(ctx: QueryCtx, postId: Id<'posts'>): Promise<number> {
  const reports = await ctx.db
    .query('reports')
    .withIndex('by_post', (q) => q.eq('postId', postId))
    .collect();
  return reports.filter((r) => r.resolution !== 'dismissed').length;
}

// No "hide from feed" action exists in this app yet (see PostOptionsSheet) —
// this is the hook Quality() is specified to use once one is added. Kept as
// a real function (not inlined as a literal 0 at every call site) so wiring
// up a hide feature later only means filling this in.
export async function getHideCount(_ctx: QueryCtx, _postId: Id<'posts'>): Promise<number> {
  return 0;
}

export async function getImpressionStats(
  ctx: QueryCtx,
  postId: Id<'posts'>,
  sinceMs?: number
): Promise<{ impressions: number; avgWatchScore: number; completions: number }> {
  const rows = await ctx.db
    .query('contentImpressions')
    .withIndex('by_post', (q) => q.eq('postId', postId))
    .order('desc')
    .take(IMPRESSION_SAMPLE_CAP);

  const scoped = sinceMs ? rows.filter((r) => r.shownAt >= sinceMs) : rows;
  if (scoped.length === 0) return { impressions: 0, avgWatchScore: 0, completions: 0 };

  let watchScoreSum = 0;
  let watchScoreCount = 0;
  let completions = 0;
  for (const row of scoped) {
    if (row.completed) completions += 1;
    if (row.watchMs != null && row.duration && row.duration > 0 && row.watchMs >= 0) {
      watchScoreSum += Math.min(1.3, row.watchMs / row.duration);
      watchScoreCount += 1;
    }
  }

  return {
    impressions: scoped.length,
    avgWatchScore: watchScoreCount > 0 ? watchScoreSum / watchScoreCount : 0,
    completions,
  };
}
