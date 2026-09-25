import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { bumpMeaningfulInteraction } from './users';

const contentImpressionValidator = v.object({
  postId: v.id('posts'),
  kind: v.union(v.literal('post'), v.literal('clip')),
  watchMs: v.optional(v.number()),
  duration: v.optional(v.number()),
  completed: v.optional(v.boolean()),
  sessionId: v.optional(v.string()),
  cluster: v.optional(v.string()),
  rankingVersion: v.optional(v.string()),
});

// Batched — the client accumulates impressions (feed scroll-past, clip
// watch-time) client-side and flushes them together instead of firing one
// mutation per item, so a long scroll session doesn't spam the backend.
// Every impression here must correspond to content that was actually
// rendered to the viewer; ranking candidates that were filtered/paginated
// away are never logged.
export const logContentImpressions = mutation({
  args: { userId: v.id('users'), impressions: v.array(contentImpressionValidator), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId, impressions }) => {
    if (impressions.length === 0) return;
    const now = Date.now();

    let meaningfulInteractions = 0;
    for (const impression of impressions) {
      // Watch time is impossible-to-fake-proof here (a Convex mutation can't
      // verify client timers), but *is* validated for internal consistency:
      // no negative/absurd durations get persisted and skew ranking.
      const watchMs =
        impression.watchMs != null && impression.watchMs >= 0 ? impression.watchMs : undefined;
      const duration =
        impression.duration != null && impression.duration >= 0 ? impression.duration : undefined;

      await ctx.db.insert('contentImpressions', {
        userId,
        postId: impression.postId,
        kind: impression.kind,
        shownAt: now,
        watchMs,
        duration,
        completed: impression.completed,
        sessionId: impression.sessionId,
        cluster: impression.cluster,
        rankingVersion: impression.rankingVersion,
      });

      // A completed watch is a meaningful, if quiet, signal of interest —
      // counts toward the cold-start personalization ramp same as an
      // explicit like/comment/save.
      if (impression.completed) meaningfulInteractions += 1;
    }

    if (meaningfulInteractions > 0) {
      await bumpMeaningfulInteraction(ctx, userId, meaningfulInteractions);
    }
  },
});

// Ad impression/click logging lives in convex/ads.ts (recordAdView /
// recordAdClick) alongside the eligibility + ranking logic that reads it —
// keeping the write and read sides of ad delivery data in one module.
