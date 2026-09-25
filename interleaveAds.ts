// Weaves ads into an organic feed at a fixed cadence — one ad every `every`
// organic items, stopping once the ad supply runs out rather than repeating.
// Shared by ExploreScreen (post ads) and ClipsScreen (clip ads) so both
// surfaces space ads out identically.
export type FeedEntry<P, A> = { kind: 'post'; item: P } | { kind: 'ad'; item: A };

export function interleaveAds<P, A>(posts: P[], ads: A[], every = 5): FeedEntry<P, A>[] {
  const result: FeedEntry<P, A>[] = [];
  let adIndex = 0;

  posts.forEach((item, i) => {
    result.push({ kind: 'post', item });
    if ((i + 1) % every === 0 && adIndex < ads.length) {
      result.push({ kind: 'ad', item: ads[adIndex] });
      adIndex += 1;
    }
  });

  // A feed shorter than `every` (or with more ads than slots) would
  // otherwise never place the remaining ads at all — tack them on the end
  // instead of dropping them, so an ad always shows up somewhere.
  while (adIndex < ads.length) {
    result.push({ kind: 'ad', item: ads[adIndex] });
    adIndex += 1;
  }

  return result;
}
