// Affinity(u,v) = 3*follows + 5*mutualFollow + 2*sharedCircles +
//                 log(1+dms_30d) + log(1+pastLikes)
//
// Pure combiner — the (potentially expensive) job of gathering these raw
// counts from the database, bounded, lives in convex/affinity.ts.
import { AFFINITY_WEIGHTS } from './rankingConfig';

export type AffinityInputs = {
  follows: boolean;
  mutualFollow: boolean;
  sharedCircleCount: number;
  dms30d: number;
  pastLikesOnTheirPosts: number;
};

export function affinityScore(inputs: AffinityInputs): number {
  const raw =
    AFFINITY_WEIGHTS.follows * (inputs.follows ? 1 : 0) +
    AFFINITY_WEIGHTS.mutualFollow * (inputs.mutualFollow ? 1 : 0) +
    AFFINITY_WEIGHTS.sharedCircle * inputs.sharedCircleCount +
    AFFINITY_WEIGHTS.dmLog * Math.log(1 + Math.max(0, inputs.dms30d)) +
    AFFINITY_WEIGHTS.likeLog * Math.log(1 + Math.max(0, inputs.pastLikesOnTheirPosts));

  return Math.min(AFFINITY_WEIGHTS.cap, raw);
}

// Squashes the raw (0..cap) affinity score into a bounded ranking
// multiplier, so a total stranger's content is still reachable (never
// multiplied by ~0) while a close friend's content gets a real boost.
export function affinityMultiplier(
  score: number,
  floor: number,
  ceiling: number
): number {
  const normalized = score / AFFINITY_WEIGHTS.cap; // 0..1
  return floor + normalized * (ceiling - floor);
}
