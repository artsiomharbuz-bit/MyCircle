// Quality(i) = exp(-kappa * reportRate) * exp(-kappaPrime * hideRate)
//
// reportRate/hideRate are Bayesian-smoothed (add `smoothingImpressions`
// "clean" impressions to the denominator) so a single report on a
// brand-new, barely-seen post doesn't collapse its ranking to near zero.
import { QUALITY } from './rankingConfig';

export function smoothedRate(count: number, impressions: number): number {
  return count / (impressions + QUALITY.smoothingImpressions);
}

export function quality(reportCount: number, hideCount: number, impressions: number): number {
  const reportRate = smoothedRate(reportCount, impressions);
  const hideRate = smoothedRate(hideCount, impressions);
  return Math.exp(-QUALITY.kappaReport * reportRate) * Math.exp(-QUALITY.kappaHide * hideRate);
}
