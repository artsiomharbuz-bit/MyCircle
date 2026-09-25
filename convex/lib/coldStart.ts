// Smooth 0..1 personalization ramp — no hard jump at any interaction count.
// 0 = fully cold-start (trending/language/quality only), 1 = fully
// personalized (affinity/engagement-prediction fully weighted).
import { COLD_START } from './rankingConfig';

export function personalizationCoefficient(meaningfulInteractionCount: number): number {
  const { rampStart, rampEnd } = COLD_START;
  if (meaningfulInteractionCount <= rampStart) return 0;
  if (meaningfulInteractionCount >= rampEnd) return 1;
  return (meaningfulInteractionCount - rampStart) / (rampEnd - rampStart);
}

// Blends a cold-start (non-personalized) score with a personalized score
// using the ramp coefficient — used by feed/clips ranking so new users get
// mostly trending/quality-driven ordering that gradually shifts toward full
// personalization as they build interaction history.
export function blendWithColdStart(
  coldStartScore: number,
  personalizedScore: number,
  meaningfulInteractionCount: number
): number {
  const t = personalizationCoefficient(meaningfulInteractionCount);
  return coldStartScore * (1 - t) + personalizedScore * t;
}
