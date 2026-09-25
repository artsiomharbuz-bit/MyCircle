// BM25-style relevance + bounded fuzzy matching. Operates on a bounded
// candidate set the caller already fetched (see convex/search.ts) — this
// file never touches the database, so candidate retrieval can later move to
// a dedicated search engine without rewriting anything here.
import { SEARCH } from './rankingConfig';

export function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#@]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// IDF(t) = ln((N - nt + 0.5) / (nt + 0.5) + 1)
export function idf(totalDocs: number, docsContainingTerm: number): number {
  return Math.log((totalDocs - docsContainingTerm + 0.5) / (docsContainingTerm + 0.5) + 1);
}

export type FieldedDocument = {
  id: string;
  fields: Partial<Record<keyof typeof SEARCH.fieldWeights, string | null | undefined>>;
};

// Precomputes per-term document frequency across a bounded candidate set, so
// BM25 scoring for every candidate against a query is O(candidates * query
// terms) instead of re-scanning the corpus per term.
export function buildDocFrequency(docs: FieldedDocument[]): {
  docFreq: Map<string, number>;
  totalDocs: number;
  avgFieldLength: Record<string, number>;
} {
  const docFreq = new Map<string, number>();
  const fieldLengthSums: Record<string, number> = {};
  const fieldNames = Object.keys(SEARCH.fieldWeights);

  for (const doc of docs) {
    const seenInDoc = new Set<string>();
    for (const field of fieldNames) {
      const text = doc.fields[field as keyof typeof SEARCH.fieldWeights];
      const tokens = tokenize(text);
      fieldLengthSums[field] = (fieldLengthSums[field] ?? 0) + tokens.length;
      for (const token of new Set(tokens)) {
        const key = `${field}:${token}`;
        if (!seenInDoc.has(key)) {
          seenInDoc.add(key);
          docFreq.set(key, (docFreq.get(key) ?? 0) + 1);
        }
      }
    }
  }

  const avgFieldLength: Record<string, number> = {};
  for (const field of fieldNames) {
    avgFieldLength[field] = docs.length > 0 ? (fieldLengthSums[field] ?? 0) / docs.length : 0;
  }

  return { docFreq, totalDocs: docs.length, avgFieldLength };
}

// BM25 score for one document against a tokenized query, summed across
// weighted fields.
export function bm25Score(
  doc: FieldedDocument,
  queryTokens: string[],
  index: ReturnType<typeof buildDocFrequency>
): number {
  const { k1, b } = SEARCH.bm25;
  let score = 0;

  for (const [field, weight] of Object.entries(SEARCH.fieldWeights)) {
    const text = doc.fields[field as keyof typeof SEARCH.fieldWeights];
    const fieldTokens = tokenize(text);
    if (fieldTokens.length === 0) continue;

    const termFreq = new Map<string, number>();
    for (const token of fieldTokens) {
      termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
    }

    const fieldLength = fieldTokens.length;
    const avgLength = index.avgFieldLength[field] || 1;

    for (const term of queryTokens) {
      const tf = termFreq.get(term) ?? 0;
      if (tf === 0) continue;
      const docsWithTerm = index.docFreq.get(`${field}:${term}`) ?? 1;
      const termIdf = idf(index.totalDocs, docsWithTerm);
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (fieldLength / avgLength));
      score += weight * termIdf * (numerator / denominator);
    }
  }

  return score;
}

// ---------------------------------------------------------------------------
// Fuzzy matching — FuzzyMatch(t,t') = max(0, 1 - editDistance / max(len))
// ---------------------------------------------------------------------------
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = current;
  }
  return prev[b.length];
}

export function fuzzyMatch(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return Math.max(0, 1 - levenshtein(a, b) / maxLen);
}

// Best fuzzy similarity between a query token and any token drawn from the
// candidate text, ignoring tokens too short to fuzzy-match meaningfully.
export function bestFuzzyMatch(queryToken: string, candidateTokens: string[]): number {
  if (queryToken.length < SEARCH.fuzzyMinTokenLength) return 0;
  let best = 0;
  for (const token of candidateTokens) {
    if (token.length < SEARCH.fuzzyMinTokenLength) continue;
    const score = fuzzyMatch(queryToken, token);
    if (score > best) best = score;
  }
  return best >= SEARCH.fuzzyMinSimilarity ? best : 0;
}

// ---------------------------------------------------------------------------
// Search intent
// ---------------------------------------------------------------------------
export type SearchIntent =
  | { kind: 'user'; handle: string }
  | { kind: 'hashtag'; tag: string }
  | { kind: 'general' };

export function detectSearchIntent(rawQuery: string): SearchIntent {
  const trimmed = rawQuery.trim();
  if (trimmed.startsWith('@') && trimmed.length > 1) {
    return { kind: 'user', handle: trimmed.slice(1).toLowerCase() };
  }
  if (trimmed.startsWith('#') && trimmed.length > 1) {
    return { kind: 'hashtag', tag: normalizeHashtag(trimmed) };
  }
  return { kind: 'general' };
}

export function normalizeHashtag(raw: string): string {
  return raw
    .trim()
    .replace(/^#/, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/#[\p{L}0-9_]+/gu) ?? [];
  const normalized = matches.map(normalizeHashtag).filter((tag) => tag.length > 0);
  return [...new Set(normalized)];
}
