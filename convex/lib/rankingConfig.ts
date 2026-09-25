// Central tuning knobs for every ranking surface (feed, clips, suggested
// users, ads, search). Nothing in this file talks to the database — it's
// plain constants so they can be tuned without touching ranking logic, and
// so the same numbers are reachable from unit tests.
//
// Each surface carries a version string that gets stamped onto impressions
// (see contentImpressions.rankingVersion) — bump it whenever the *shape* of
// a surface's scoring function changes, so old/new impressions can be told
// apart for offline comparison.

export const RANKING_VERSIONS = {
  feed: 'feed_v1',
  clips: 'clips_v1',
  search: 'search_v1',
  ads: 'ads_v1',
  suggestedUsers: 'suggested_users_v1',
} as const;

// ---------------------------------------------------------------------------
// Time decay — TimeDecay(i) = 1 / (1 + lambda * ageHours)^p
// ---------------------------------------------------------------------------
export const TIME_DECAY = {
  post: { p: 1.3, lambda: 0.08 },
  clip: { p: 1.6, lambda: 0.25 },
};

// ---------------------------------------------------------------------------
// Language relevance (convex/lib/language.ts)
// ---------------------------------------------------------------------------
export const LANGUAGE_WEIGHTS = {
  primaryMatch: 1.0,
  neutralContent: 0.3,
  noMatch: 0.05,
  // Extra credit for subtitle accessibility, applied on top of the primary
  // score. Capped so it can never let a non-matching-language clip beat a
  // primary-language match, and reduced when the primary already matched
  // (don't over-weight subtitles when speech already matches).
  subtitleBoostWhenNoPrimaryMatch: 0.35,
  subtitleBoostWhenPrimaryMatches: 0.05,
};

// ---------------------------------------------------------------------------
// Affinity (convex/lib/affinity.ts) — Affinity(u,v) weights
// ---------------------------------------------------------------------------
export const AFFINITY_WEIGHTS = {
  follows: 3,
  mutualFollow: 5,
  sharedCircle: 2,
  dmLog: 1, // multiplies log(1 + dms_30d)
  likeLog: 1, // multiplies log(1 + pastLikes)
  cap: 20, // bounded so one relationship can't blow out the whole score
};

// ---------------------------------------------------------------------------
// Feed (posts) — Score(u,i) = LanguageRelevance * Affinity * Engagement *
// TimeDecay * Quality
// ---------------------------------------------------------------------------
export const FEED_WEIGHTS = {
  engagement: { like: 1, comment: 4, share: 6, save: 5, dwellWeight: 3 },
  // Affinity is additive/log-scaled (see AFFINITY_WEIGHTS.cap) then squashed
  // into a 0.2-2.0 multiplier so a stranger's post is still reachable.
  affinityFloor: 0.2,
  affinityCeiling: 2.0,
  diversityWindow: 8, // rolling window pagination-independent authors check
  diversityMaxPerAuthor: 2,
  explorationRate: 0.12, // fraction of feed slots reserved for exploration candidates
  candidateLimit: 400, // bounded candidate set pulled per feed build
};

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------
export const CLIPS_WEIGHTS = {
  watchScoreCap: 1.3,
  w1_watch: 6,
  w2_like: 1,
  w3_comment: 3,
  w4_share: 4,
  w5_soundVelocity: 2,
  diversityWindow: 6,
  diversityMaxPerAuthor: 1,
  explorationRate: 0.15,
  candidateLimit: 400,
};

// ---------------------------------------------------------------------------
// Sound velocity — uses(24h) / max(uses(prev24h), smoothing)
// ---------------------------------------------------------------------------
export const SOUND_VELOCITY = {
  smoothingConstant: 2,
  cap: 8, // avoid a single viral spike dominating the ranking multiplier
};

// ---------------------------------------------------------------------------
// Quality penalty — exp(-kappa * reportRate) * exp(-kappaPrime * hideRate)
// ---------------------------------------------------------------------------
export const QUALITY = {
  kappaReport: 4,
  kappaHide: 2,
  // Bayesian smoothing prior — a brand-new post with 1 report and 3
  // impressions should not collapse to near-zero quality.
  smoothingImpressions: 20,
};

// ---------------------------------------------------------------------------
// Cold start — smooth personalization ramp, not a hard cutoff
// ---------------------------------------------------------------------------
export const COLD_START = {
  rampStart: 20, // interactions where personalization starts mattering
  rampEnd: 100, // interactions where personalization is fully weighted
};

// ---------------------------------------------------------------------------
// Session-level exploration (UCB) — convex/lib/ucb.ts
// ---------------------------------------------------------------------------
export const UCB = {
  beta: 1.4,
};

// ---------------------------------------------------------------------------
// Client-side impression logging — imported by screens as well as convex/,
// so it stays here rather than in a server-only module. A post (unlike a
// clip) has no intrinsic "duration" to compare watch time against, so
// dwell is normalized against this assumed expected viewing time instead —
// same capped-ratio shape as WatchScore for clips.
// ---------------------------------------------------------------------------
export const IMPRESSIONS = {
  expectedPostDwellMs: 6000,
};

// ---------------------------------------------------------------------------
// Suggested users — FriendScore weights
// ---------------------------------------------------------------------------
export const FRIEND_SCORE_WEIGHTS = {
  jaccard: 3,
  adamicAdar: 2,
  sharedCircles: 2.5,
  language: 1.5,
  geo: 1,
  candidateLimit: 300,
  diversityMaxPerFollowSource: 6,
};

// ---------------------------------------------------------------------------
// Geo — GeoScore = exp(-distance / decayKm)
// ---------------------------------------------------------------------------
export const GEO = {
  decayKm: 50,
};

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------
export const ADS = {
  ctrPrior: { alpha: 2, beta: 200 }, // Beta-smoothing prior for pCTR
  fatigue: {
    // Minimum multiplier a heavily-fatigued user's eCPM can be scaled by —
    // ads never fully disappear, just get deprioritized.
    floor: 0.15,
    // Exposures within this window count toward fatigue/frequency.
    windowMs: 30 * 24 * 60 * 60 * 1000,
    perUserDailyCap: 6,
    perUserPerAdDailyCap: 2,
    minHoursBetweenSameAd: 4,
  },
  candidateLimit: 100,
  audienceEstimateSampleCap: 5000,
};

// ---------------------------------------------------------------------------
// Search — SearchScore = BM25^0.6 * EngagementVelocity * LanguageRelevance *
// Affinity * Freshness
// ---------------------------------------------------------------------------
export const SEARCH = {
  bm25: { k1: 1.2, b: 0.75 },
  bm25Exponent: 0.6,
  fieldWeights: {
    title: 3,
    caption: 1.5,
    username: 4,
    displayName: 2.5,
    hashtag: 3.5,
    soundName: 1.5,
    transcript: 1,
    subtitleText: 0.8,
  },
  fuzzyMinTokenLength: 3,
  fuzzyMinSimilarity: 0.6,
  exactMatchBonus: 2,
  candidateLimit: 300,
  resultLimit: 30,
  diversityMaxPerAuthor: 3,
};
