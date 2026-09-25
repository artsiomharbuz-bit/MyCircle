// TimeDecay(i) = 1 / (1 + lambda * ageHours)^p
import { TIME_DECAY } from './rankingConfig';

export function timeDecay(
  createdAt: number,
  kind: 'post' | 'clip',
  now: number = Date.now()
): number {
  const ageHours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
  const { p, lambda } = TIME_DECAY[kind];
  return 1 / Math.pow(1 + lambda * ageHours, p);
}
