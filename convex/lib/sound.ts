// soundVelocity = uses(last24h) / max(uses(prev24h), smoothingConstant),
// capped so one viral spike can't dominate the ranking multiplier.
import { SOUND_VELOCITY } from './rankingConfig';

export function soundVelocity(usesLast24h: number, usesPrev24h: number): number {
  const denominator = Math.max(usesPrev24h, SOUND_VELOCITY.smoothingConstant);
  return Math.min(SOUND_VELOCITY.cap, usesLast24h / denominator);
}

// Buckets a list of usage timestamps (epoch ms) into "last 24h" / "previous
// 24h" counts relative to `now`, then applies soundVelocity.
export function soundVelocityFromTimestamps(timestamps: number[], now: number = Date.now()): number {
  const dayMs = 24 * 60 * 60 * 1000;
  let last24h = 0;
  let prev24h = 0;
  for (const ts of timestamps) {
    const age = now - ts;
    if (age < 0) continue;
    if (age < dayMs) last24h += 1;
    else if (age < 2 * dayMs) prev24h += 1;
  }
  return soundVelocity(last24h, prev24h);
}
