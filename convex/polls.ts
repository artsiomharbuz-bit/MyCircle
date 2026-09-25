import { ConvexError, v } from 'convex/values';
import { mutation, QueryCtx } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import { bumpMeaningfulInteraction } from './users';
import { MAX_POLL_OPTIONS, MIN_POLL_OPTIONS } from '../pollOptions';
import { requireUser } from './lib/session';

export type FormattedPoll = {
  question: string;
  options: { label: string; votes: number; percentage: number }[];
  totalVotes: number;
  myVote: number | null;
};

// Shapes a post's poll (if any) with live results for this viewer — vote
// counts come from a single indexed query on pollVotes, never a scan, so
// this is cheap enough to call once per post the same way formatSoundSummary
// already is.
export async function formatPoll(
  ctx: QueryCtx,
  post: Doc<'posts'>,
  viewerId: Id<'users'>
): Promise<FormattedPoll | null> {
  if (!post.poll) return null;

  const votes = await ctx.db
    .query('pollVotes')
    .withIndex('by_post', (q) => q.eq('postId', post._id))
    .collect();

  const counts = new Array(post.poll.options.length).fill(0);
  let myVote: number | null = null;
  for (const vote of votes) {
    if (vote.optionIndex >= 0 && vote.optionIndex < counts.length) {
      counts[vote.optionIndex] += 1;
    }
    if (vote.userId === viewerId) myVote = vote.optionIndex;
  }

  const totalVotes = votes.length;
  return {
    question: post.poll.question,
    options: post.poll.options.map((label, i) => ({
      label,
      votes: counts[i],
      percentage: totalVotes > 0 ? Math.round((counts[i] / totalVotes) * 100) : 0,
    })),
    totalVotes,
    myVote,
  };
}

// Validates + normalizes a poll at post-creation time — shared by
// posts.createPost so the same rules (min/max options, non-empty question)
// apply regardless of caller.
export function normalizePoll(
  raw: { question: string; options: string[] } | undefined
): { question: string; options: string[] } | undefined {
  if (!raw) return undefined;

  const question = raw.question.trim();
  const options = raw.options.map((o) => o.trim()).filter((o) => o.length > 0);

  if (!question) throw new ConvexError('Give your poll a question.');
  if (options.length < MIN_POLL_OPTIONS) {
    throw new ConvexError(`Polls need at least ${MIN_POLL_OPTIONS} options.`);
  }
  if (options.length > MAX_POLL_OPTIONS) {
    throw new ConvexError(`Polls can have at most ${MAX_POLL_OPTIONS} options.`);
  }

  return { question, options };
}

// One vote per (post, user) — voting again with a different option changes
// the existing vote rather than adding a second one; voting the same option
// again is a no-op. Changing your mind is normal poll UX (Instagram/X both
// allow it), so this deliberately isn't an immutable "vote once" gate.
export const vote = mutation({
  args: { postId: v.id('posts'), userId: v.id('users'), optionIndex: v.number(), sessionToken: v.string() },
  handler: async (ctx, { postId, userId, optionIndex, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const post = await ctx.db.get(postId);
    if (!post || !post.poll) throw new ConvexError('This post has no poll.');
    if (optionIndex < 0 || optionIndex >= post.poll.options.length) {
      throw new ConvexError('That option no longer exists.');
    }

    const existing = await ctx.db
      .query('pollVotes')
      .withIndex('by_post_user', (q) => q.eq('postId', postId).eq('userId', userId))
      .unique();

    if (existing) {
      if (existing.optionIndex === optionIndex) return;
      await ctx.db.patch(existing._id, { optionIndex, votedAt: Date.now() });
      return;
    }

    await ctx.db.insert('pollVotes', { postId, userId, optionIndex, votedAt: Date.now() });
    // Voting is a real, deliberate interaction — counts toward the
    // cold-start ramp the same as a like/comment/share.
    await bumpMeaningfulInteraction(ctx, userId);
  },
});
