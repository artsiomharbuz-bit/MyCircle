// Pure social-graph set math — Jaccard similarity and Adamic-Adar, both
// operating on already-fetched neighbor sets (the DB fetching + bounding of
// those sets lives in convex/follows.ts, which is the expensive part this
// file deliberately has no opinion about).

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  const unionSize = a.size + b.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}

// sum over common neighbors w of 1 / ln(degree(w)). `degreeOf` returns the
// follower+following degree of a common neighbor; neighbors with degree <= 1
// contribute 0 rather than dividing by ln(1) = 0 (which would be Infinity).
export function adamicAdar<T>(
  a: Set<T>,
  b: Set<T>,
  degreeOf: (neighbor: T) => number
): number {
  let sum = 0;
  for (const neighbor of a) {
    if (!b.has(neighbor)) continue;
    const degree = degreeOf(neighbor);
    if (degree <= 1) continue;
    sum += 1 / Math.log(degree);
  }
  return sum;
}
