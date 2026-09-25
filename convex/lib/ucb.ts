// Session-level explore/exploit over topic clusters (sound/hashtag-derived)
// on the Clips feed.
//
// UCB(cluster) = meanReward(cluster) + beta * sqrt(ln(N_session) / n_cluster)
import { UCB } from './rankingConfig';

export type ClusterStats = { totalReward: number; count: number };

export function ucbScore(
  stats: ClusterStats | undefined,
  totalSessionPulls: number,
  beta: number = UCB.beta
): number {
  // An unseen cluster this session gets an optimistic score so it's still
  // explorable — effectively "infinite" uncertainty bonus, bounded to keep
  // sorting stable.
  if (!stats || stats.count === 0) return 1 + beta;

  const meanReward = stats.totalReward / stats.count;
  const explorationBonus = beta * Math.sqrt(Math.log(Math.max(1, totalSessionPulls)) / stats.count);
  return meanReward + explorationBonus;
}

// Ranks clusters by UCB score, highest first — callers use this to bias
// (not strictly force) candidate ordering toward clusters worth exploring or
// exploiting right now.
export function rankClustersByUcb(
  clusterStats: Map<string, ClusterStats>,
  totalSessionPulls: number
): string[] {
  return [...clusterStats.keys()].sort(
    (a, b) => ucbScore(clusterStats.get(b), totalSessionPulls) - ucbScore(clusterStats.get(a), totalSessionPulls)
  );
}

// Normalized watch-time reward in [0, ~1.3] — completion rewarded, moderate
// rewatch rewarded, runaway loops capped. Mirrors the Clips WatchScore cap.
export function watchReward(watchMs: number, duration: number): number {
  if (duration <= 0 || watchMs <= 0) return 0;
  return Math.min(1.3, watchMs / duration);
}
