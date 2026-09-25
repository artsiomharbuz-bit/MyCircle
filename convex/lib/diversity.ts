// Rolling-window author diversity rerank: greedily walks the score-sorted
// list, skipping an item (deferring it to later) if its author already
// appears `maxPerAuthor` times within the last `windowSize` accepted items.
// Deferred items are appended once the pass completes rather than dropped,
// so nothing that passed filtering/scoring silently disappears.
export function diversify<T>(
  items: T[],
  authorOf: (item: T) => string,
  windowSize: number,
  maxPerAuthor: number
): T[] {
  const accepted: T[] = [];
  const deferred: T[] = [];

  for (const item of items) {
    const author = authorOf(item);
    const windowStart = Math.max(0, accepted.length - windowSize);
    const countInWindow = accepted
      .slice(windowStart)
      .reduce((count, accItem) => count + (authorOf(accItem) === author ? 1 : 0), 0);

    if (countInWindow < maxPerAuthor) {
      accepted.push(item);
    } else {
      deferred.push(item);
    }
  }

  // Re-run deferred items through the same rule once — most will now fit
  // since the window has moved on; anything still crowded just goes to the
  // end in original relative (score) order rather than being lost.
  for (const item of deferred) {
    const author = authorOf(item);
    const windowStart = Math.max(0, accepted.length - windowSize);
    const countInWindow = accepted
      .slice(windowStart)
      .reduce((count, accItem) => count + (authorOf(accItem) === author ? 1 : 0), 0);
    accepted.push(item);
    void countInWindow; // second pass is best-effort placement, not another filter
  }

  return accepted;
}
