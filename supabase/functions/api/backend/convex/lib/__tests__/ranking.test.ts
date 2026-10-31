// Unit tests for the pure ranking library. Runs on Node's built-in test
// runner (Node 22+ strips TS types natively) — no extra test framework
// dependency needed: `node --test convex/lib/__tests__/ranking.test.ts`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { languageRelevance, detectTextLanguage, combineLanguageSignals, userSpokenLanguages, languageCompatibility } from '../language.ts';
import { affinityScore, affinityMultiplier } from '../affinity.ts';
import { timeDecay } from '../timeDecay.ts';
import { quality, smoothedRate } from '../quality.ts';
import { haversineKm, geoScore, cityMatchScore } from '../geo.ts';
import { jaccard, adamicAdar } from '../social.ts';
import { soundVelocity, soundVelocityFromTimestamps } from '../sound.ts';
import { ucbScore, watchReward } from '../ucb.ts';
import { bm25Score, buildDocFrequency, fuzzyMatch, levenshtein, detectSearchIntent, extractHashtags, normalizeHashtag } from '../textSearch.ts';
import { normalizeLocationName, coordinatesForCity, cityNameForCoordinates } from '../locations.ts';
import { personalizationCoefficient, blendWithColdStart } from '../coldStart.ts';
import { diversify } from '../diversity.ts';

// ---------------------------------------------------------------------------
// Language / subtitle relevance
// ---------------------------------------------------------------------------
test('language: primary match scores highest', () => {
  const score = languageRelevance({ language: 'en' }, { language: 'en' });
  assert.equal(score, 1.0);
});

test('language: mismatch with no subtitles scores low', () => {
  const score = languageRelevance({ spokenLanguages: ['en'] }, { language: 'pl', subtitleLanguages: [] });
  assert.ok(score < 0.2);
});

test('language: mismatch WITH matching subtitles scores substantially higher than plain mismatch', () => {
  const withSubs = languageRelevance({ spokenLanguages: ['en'] }, { language: 'pl', subtitleLanguages: ['en'] });
  const withoutSubs = languageRelevance({ spokenLanguages: ['en'] }, { language: 'pl', subtitleLanguages: [] });
  assert.ok(withSubs > withoutSubs);
  assert.ok(withSubs < 1.0, 'subtitle match must not fully override primary mismatch');
});

test('language: subtitle boost is small when primary already matches (no over-weighting)', () => {
  const matchNoSub = languageRelevance({ spokenLanguages: ['en', 'pl'] }, { language: 'pl', subtitleLanguages: [] });
  const matchWithSub = languageRelevance(
    { spokenLanguages: ['en', 'pl'] },
    { language: 'pl', subtitleLanguages: ['de'] }
  );
  const boost = matchWithSub - matchNoSub;
  assert.ok(boost > 0 === false || boost < 0.1, 'subtitle boost on an already-matching primary must stay small');
});

test('language: neutral (null) content is still discoverable', () => {
  const score = languageRelevance({ spokenLanguages: ['en'] }, { language: null, subtitleLanguages: [] });
  assert.equal(score, 0.3);
});

test('language: bilingual user spoken set falls back correctly', () => {
  assert.deepEqual(userSpokenLanguages({ language: 'en' }), ['en']);
  assert.deepEqual(userSpokenLanguages({ language: 'en', spokenLanguages: [] }), ['en']);
  assert.deepEqual(userSpokenLanguages({ language: 'en', spokenLanguages: ['en', 'pl'] }), ['en', 'pl']);
});

test('language detection: short/noisy text yields language=null, source=none', () => {
  const result = detectTextLanguage('lol', 'caption');
  assert.equal(result.language, null);
  assert.equal(result.source, 'none');
});

test('language detection: english stopwords detected', () => {
  const result = detectTextLanguage('this is the best day with my friends', 'caption');
  assert.equal(result.language, 'en');
  assert.ok(result.confidence > 0);
});

test('language detection: polish stopwords detected', () => {
  const result = detectTextLanguage('to jest najlepszy dzien z moja rodzina', 'title');
  assert.equal(result.language, 'pl');
});

test('multimodal resolution: creator override always wins', () => {
  const result = combineLanguageSignals({
    creator: 'fr',
    speech: { language: 'de', confidence: 0.9, source: 'speech' },
  });
  assert.deepEqual(result, { language: 'fr', confidence: 1, source: 'creator' });
});

test('multimodal resolution: speech beats caption/title/ocr', () => {
  const result = combineLanguageSignals({
    speech: { language: 'pl', confidence: 0.96, source: 'speech' },
    caption: { language: 'en', confidence: 0.6, source: 'caption' },
  });
  assert.equal(result.language, 'pl');
  assert.equal(result.source, 'speech');
});

test('multimodal resolution: no signal at all -> null/none', () => {
  const result = combineLanguageSignals({});
  assert.equal(result.language, null);
  assert.equal(result.source, 'none');
  assert.equal(result.confidence, 0);
});

test('multimodal resolution: music-only video (no speech, no text) -> null', () => {
  const result = combineLanguageSignals({
    speech: { language: null, confidence: 0, source: 'none' },
  });
  assert.equal(result.language, null);
});

test('language compatibility: overlapping spoken languages score 1', () => {
  assert.equal(languageCompatibility({ spokenLanguages: ['en', 'pl'] }, { spokenLanguages: ['pl'] }), 1);
});

test('language compatibility: disjoint languages score 0', () => {
  assert.equal(languageCompatibility({ spokenLanguages: ['en'] }, { spokenLanguages: ['pl'] }), 0);
});

test('language compatibility: unknown preference is neutral, not penalized', () => {
  assert.equal(languageCompatibility({}, { spokenLanguages: ['pl'] }), 0.3);
});

// ---------------------------------------------------------------------------
// Affinity
// ---------------------------------------------------------------------------
test('affinity: mutual friend scores higher than stranger', () => {
  const stranger = affinityScore({ follows: false, mutualFollow: false, sharedCircleCount: 0, dms30d: 0, pastLikesOnTheirPosts: 0 });
  const friend = affinityScore({ follows: true, mutualFollow: true, sharedCircleCount: 1, dms30d: 5, pastLikesOnTheirPosts: 3 });
  assert.equal(stranger, 0);
  assert.ok(friend > stranger);
});

test('affinity: score is capped, not unbounded', () => {
  const maxedOut = affinityScore({ follows: true, mutualFollow: true, sharedCircleCount: 50, dms30d: 100000, pastLikesOnTheirPosts: 100000 });
  assert.ok(maxedOut <= 20);
});

test('affinity: multiplier stays within floor/ceiling', () => {
  assert.equal(affinityMultiplier(0, 0.2, 2.0), 0.2);
  assert.equal(affinityMultiplier(20, 0.2, 2.0), 2.0);
});

// ---------------------------------------------------------------------------
// Time decay
// ---------------------------------------------------------------------------
test('time decay: fresher content scores higher than older content', () => {
  const now = Date.now();
  const fresh = timeDecay(now - 60 * 60 * 1000, 'post', now); // 1h old
  const old = timeDecay(now - 72 * 60 * 60 * 1000, 'post', now); // 72h old
  assert.ok(fresh > old);
  assert.ok(fresh <= 1 && old > 0);
});

test('time decay: clips decay faster than posts at the same age', () => {
  const now = Date.now();
  const age = now - 10 * 60 * 60 * 1000; // 10h old
  assert.ok(timeDecay(age, 'clip', now) < timeDecay(age, 'post', now));
});

// ---------------------------------------------------------------------------
// Quality
// ---------------------------------------------------------------------------
test('quality: a single report on a brand-new post does not tank it', () => {
  const q = quality(1, 0, 3); // 1 report, 3 impressions
  assert.ok(q > 0.7, `expected smoothed quality to stay high, got ${q}`);
});

test('quality: sustained high report rate meaningfully lowers score', () => {
  const q = quality(400, 0, 500);
  assert.ok(q < 0.3);
});

test('quality: smoothedRate never divides by zero', () => {
  assert.equal(smoothedRate(0, 0), 0);
});

// ---------------------------------------------------------------------------
// Geo
// ---------------------------------------------------------------------------
test('geo: haversine distance between identical points is 0', () => {
  assert.equal(haversineKm({ lat: 52.23, lng: 21.01 }, { lat: 52.23, lng: 21.01 }), 0);
});

test('geo: score decays with distance', () => {
  const near = geoScore({ lat: 52.2297, lng: 21.0122 }, { lat: 52.24, lng: 21.02 }); // Warsaw, ~1km
  const far = geoScore({ lat: 52.2297, lng: 21.0122 }, { lat: 40.7128, lng: -74.006 }); // NYC
  assert.ok(near > far);
});

test('geo: missing coordinates fall back to 0, not a crash', () => {
  assert.equal(geoScore(null, { lat: 1, lng: 1 }), 0);
});

test('geo: city-name fallback rewards exact match only', () => {
  assert.equal(cityMatchScore('Warsaw', 'Warsaw'), 0.6);
  assert.equal(cityMatchScore('Warsaw', 'Krakow'), 0);
  assert.equal(cityMatchScore(null, 'Krakow'), 0);
});

// ---------------------------------------------------------------------------
// Social graph
// ---------------------------------------------------------------------------
test('jaccard: identical sets score 1', () => {
  assert.equal(jaccard(new Set(['a', 'b']), new Set(['a', 'b'])), 1);
});

test('jaccard: disjoint sets score 0', () => {
  assert.equal(jaccard(new Set(['a']), new Set(['b'])), 0);
});

test('jaccard: partial overlap', () => {
  assert.equal(jaccard(new Set(['a', 'b']), new Set(['b', 'c'])), 1 / 3);
});

test('adamic-adar: rewards low-degree common neighbors more than high-degree ones', () => {
  const a = new Set(['x', 'y']);
  const b = new Set(['x', 'y']);
  const lowDegree = adamicAdar(a, b, () => 2);
  const highDegree = adamicAdar(a, b, () => 1000);
  assert.ok(lowDegree > highDegree);
});

test('adamic-adar: degree of 1 contributes 0 (avoids divide-by-ln(1))', () => {
  const score = adamicAdar(new Set(['x']), new Set(['x']), () => 1);
  assert.equal(score, 0);
});

// ---------------------------------------------------------------------------
// Sound velocity
// ---------------------------------------------------------------------------
test('sound velocity: growing sound scores higher than declining sound', () => {
  const growing = soundVelocity(100, 10);
  const declining = soundVelocity(5, 100);
  assert.ok(growing > declining);
});

test('sound velocity: tiny denominators are smoothed, not exploding', () => {
  const v = soundVelocity(3, 0);
  assert.ok(Number.isFinite(v));
});

test('sound velocity: zero usage anywhere scores 0, not NaN', () => {
  assert.equal(soundVelocity(0, 0), 0);
});

test('sound velocity from timestamps buckets correctly', () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const timestamps = [now - 1000, now - 2000, now - (day + 1000)]; // 2 recent, 1 previous
  const v = soundVelocityFromTimestamps(timestamps, now);
  assert.ok(v > 0);
});

// ---------------------------------------------------------------------------
// UCB / session exploration
// ---------------------------------------------------------------------------
test('watchReward: caps runaway rewatch loops', () => {
  assert.equal(watchReward(100_000, 1000), 1.3);
});

test('watchReward: zero/negative inputs are safe', () => {
  assert.equal(watchReward(0, 1000), 0);
  assert.equal(watchReward(-5, 1000), 0);
  assert.equal(watchReward(500, 0), 0);
});

test('UCB: unseen cluster gets an optimistic score (still explorable)', () => {
  const score = ucbScore(undefined, 10);
  assert.ok(score > 1);
});

test('UCB: cluster with fewer pulls gets more exploration bonus than a heavily-pulled one with the same mean', () => {
  const fewPulls = ucbScore({ totalReward: 5, count: 5 }, 100);
  const manyPulls = ucbScore({ totalReward: 100, count: 100 }, 100);
  assert.ok(fewPulls > manyPulls);
});

// ---------------------------------------------------------------------------
// BM25 / fuzzy / search intent
// ---------------------------------------------------------------------------
test('BM25: document containing all query terms outranks one containing none', () => {
  const docs = [
    { id: 'a', fields: { caption: 'pierogi recipe dumplings polish food' } },
    { id: 'b', fields: { caption: 'completely unrelated content about cars' } },
  ];
  const index = buildDocFrequency(docs);
  const scoreA = bm25Score(docs[0], ['pierogi', 'recipe'], index);
  const scoreB = bm25Score(docs[1], ['pierogi', 'recipe'], index);
  assert.ok(scoreA > scoreB);
});

test('BM25: rarer terms weigh more than common ones across the candidate set', () => {
  const docs = [
    { id: 'a', fields: { caption: 'common common common rare' } },
    { id: 'b', fields: { caption: 'common' } },
    { id: 'c', fields: { caption: 'common' } },
  ];
  const index = buildDocFrequency(docs);
  const rareIdf = index.docFreq.get('caption:rare') ?? 0;
  const commonIdf = index.docFreq.get('caption:common') ?? 0;
  assert.ok(rareIdf < commonIdf);
});

test('levenshtein: identical strings are 0, empty vs non-empty is length', () => {
  assert.equal(levenshtein('abc', 'abc'), 0);
  assert.equal(levenshtein('', 'abc'), 3);
});

test('fuzzy match: typo-heavy query still matches reasonably', () => {
  const score = fuzzyMatch('pierogi', 'pierogy');
  assert.ok(score > 0.6);
});

test('fuzzy match: exact match scores 1 and beats fuzzy for equal BM25 relevance', () => {
  assert.equal(fuzzyMatch('pierogi', 'pierogi'), 1);
  assert.ok(fuzzyMatch('pierogi', 'pierogi') > fuzzyMatch('pierogi', 'pierogy'));
});

test('search intent: @handle detected as user search', () => {
  assert.deepEqual(detectSearchIntent('@johndoe'), { kind: 'user', handle: 'johndoe' });
});

test('search intent: #hashtag detected as hashtag search', () => {
  assert.deepEqual(detectSearchIntent('#FoodPorn'), { kind: 'hashtag', tag: 'foodporn' });
});

test('search intent: plain text is general search', () => {
  assert.deepEqual(detectSearchIntent('pierogi recipe'), { kind: 'general' });
});

test('hashtag extraction: normalizes case, punctuation and dedupes', () => {
  const tags = extractHashtags('Great day! #FoodPorn #foodporn #Pierogi123');
  assert.deepEqual(tags, ['foodporn', 'pierogi123']);
});

test('normalizeHashtag strips leading # and diacritics', () => {
  assert.equal(normalizeHashtag('#Café'), 'cafe');
});

// ---------------------------------------------------------------------------
// Location targeting
// ---------------------------------------------------------------------------
test('location: Warsaw and Warszawa normalize to the same canonical name', () => {
  assert.equal(normalizeLocationName('Warszawa'), normalizeLocationName('Warsaw'));
});

test('location: unrecognized city still normalizes to a stable title-cased name', () => {
  assert.equal(normalizeLocationName('some town'), 'Some Town');
});

test('location: known city resolves to coordinates', () => {
  const coords = coordinatesForCity('Warsaw');
  assert.ok(coords && coords.lat > 0);
});

test('location: unknown city has no coordinates (radius targeting degrades gracefully)', () => {
  assert.equal(coordinatesForCity('Nowheresville'), null);
});

test('location: reverse lookup recovers the city name from its known coordinates', () => {
  const coords = coordinatesForCity('Krakow')!;
  assert.equal(cityNameForCoordinates(coords.lat, coords.lng), 'Krakow');
});

test('location: reverse lookup returns null for coordinates not in the table', () => {
  assert.equal(cityNameForCoordinates(1.2345, 6.789), null);
});

// ---------------------------------------------------------------------------
// Cold start
// ---------------------------------------------------------------------------
test('cold start: brand-new user is fully non-personalized', () => {
  assert.equal(personalizationCoefficient(0), 0);
});

test('cold start: experienced user is fully personalized', () => {
  assert.equal(personalizationCoefficient(500), 1);
});

test('cold start: ramp is smooth (monotonically increasing), not a hard jump', () => {
  const at20 = personalizationCoefficient(20);
  const at60 = personalizationCoefficient(60);
  const at100 = personalizationCoefficient(100);
  assert.ok(at20 <= at60 && at60 <= at100);
  assert.ok(at60 > 0 && at60 < 1);
});

test('cold start: blend favors cold-start score for new users, personalized score for veterans', () => {
  const blendedNew = blendWithColdStart(1, 0, 0);
  const blendedVeteran = blendWithColdStart(1, 0, 500);
  assert.equal(blendedNew, 1);
  assert.equal(blendedVeteran, 0);
});

// ---------------------------------------------------------------------------
// Diversity
// ---------------------------------------------------------------------------
test('diversity: caps same-author appearances within the rolling window', () => {
  const items = ['a1', 'a2', 'a3', 'a4', 'b1', 'c1'].map((id) => ({ id, author: id[0] }));
  const result = diversify(items, (i) => i.author, 3, 1);
  const firstThreeAuthors = result.slice(0, 3).map((i) => i.author);
  assert.equal(new Set(firstThreeAuthors).size, firstThreeAuthors.length, 'no duplicate author within window');
});

test('diversity: never drops items, only reorders', () => {
  const items = ['a1', 'a2', 'a3', 'b1'].map((id) => ({ id, author: id[0] }));
  const result = diversify(items, (i) => i.author, 2, 1);
  assert.equal(result.length, items.length);
  assert.deepEqual(new Set(result.map((i) => i.id)), new Set(items.map((i) => i.id)));
});
