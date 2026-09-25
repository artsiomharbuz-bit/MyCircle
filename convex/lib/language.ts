// Subtitle-aware language relevance + a heuristic text-language detector.
//
// The detector below is a small stopword/character-frequency heuristic, not
// a machine-learning model — it's genuinely functional for short strings
// (captions, titles, search queries) in the languages listed, which is the
// only language signal this session can implement without an external STT/
// OCR service. Speech and OCR detection are *not* faked here — see
// convex/languageDetection.ts for the interfaces those require and their
// safe fallback (language = null / languageSource = 'none').

import { LANGUAGE_WEIGHTS } from './rankingConfig';

export type LanguageSource =
  | 'speech'
  | 'subtitle'
  | 'caption'
  | 'title'
  | 'ocr'
  | 'creator'
  | 'none';

export type LanguageSignal = {
  language: string | null;
  confidence: number;
  source: LanguageSource;
};

export type ContentLanguageInfo = {
  language?: string | null;
  subtitleLanguages?: string[] | null;
};

export type UserLanguageInfo = {
  language?: string | null;
  spokenLanguages?: string[] | null;
};

// If spokenLanguages is empty, `language` alone is the user's spoken set —
// matches AGENTS.md section 2 exactly.
export function userSpokenLanguages(user: UserLanguageInfo): string[] {
  if (user.spokenLanguages && user.spokenLanguages.length > 0) {
    return user.spokenLanguages;
  }
  return user.language ? [user.language] : [];
}

// Bounded (0..~1.35) language + subtitle relevance score. Never lets
// subtitle accessibility fully substitute for a primary-language match, and
// never over-weights subtitles once the primary language already matches.
export function languageRelevance(
  user: UserLanguageInfo,
  content: ContentLanguageInfo
): number {
  const spoken = userSpokenLanguages(user);
  const contentLanguage = content.language ?? null;
  const subtitles = content.subtitleLanguages ?? [];

  let base: number;
  if (contentLanguage === null) {
    base = LANGUAGE_WEIGHTS.neutralContent;
  } else if (spoken.length === 0) {
    // No language preference recorded for this user yet — stay neutral
    // rather than penalizing every non-null-language clip.
    base = LANGUAGE_WEIGHTS.neutralContent;
  } else if (spoken.includes(contentLanguage)) {
    base = LANGUAGE_WEIGHTS.primaryMatch;
  } else {
    base = LANGUAGE_WEIGHTS.noMatch;
  }

  const primaryMatched = contentLanguage !== null && spoken.includes(contentLanguage);
  const subtitleMatches = subtitles.some((lang) => spoken.includes(lang));

  if (subtitleMatches) {
    base += primaryMatched
      ? LANGUAGE_WEIGHTS.subtitleBoostWhenPrimaryMatches
      : LANGUAGE_WEIGHTS.subtitleBoostWhenNoPrimaryMatch;
  }

  return base;
}

// Bounded 0..1 language compatibility between two *users* (not user/content)
// — used by suggested users' FriendScore. Any overlap in spoken languages is
// a full match; an unset preference on either side is treated as neutral
// rather than penalized (we don't yet know enough to say they mismatch).
export function languageCompatibility(a: UserLanguageInfo, b: UserLanguageInfo): number {
  const langsA = userSpokenLanguages(a);
  const langsB = userSpokenLanguages(b);
  if (langsA.length === 0 || langsB.length === 0) return 0.3;
  return langsA.some((lang) => langsB.includes(lang)) ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Heuristic short-text language detection (caption/title signal only)
// ---------------------------------------------------------------------------

// A handful of very common, short, high-signal function words per language —
// deliberately small so it stays cheap to run on every post write. Not a
// substitute for a real classifier; used only as one supporting signal among
// several (see combineLanguageSignals below).
const STOPWORDS: Record<string, string[]> = {
  en: ['the', 'and', 'you', 'this', 'that', 'with', 'for', 'are', 'is', 'my', 'your'],
  es: ['el', 'la', 'que', 'de', 'y', 'los', 'las', 'para', 'con', 'mi', 'esta', 'está'],
  fr: ['le', 'la', 'les', 'et', 'de', 'un', 'une', 'pour', 'avec', 'ce', 'cette', 'mon'],
  de: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'ein', 'eine', 'für', 'mit', 'mein'],
  pl: ['i', 'w', 'na', 'jest', 'nie', 'to', 'się', 'z', 'do', 'mój', 'moja'],
  pt: ['o', 'a', 'que', 'de', 'e', 'para', 'com', 'não', 'meu', 'minha', 'está'],
  it: ['il', 'la', 'che', 'di', 'e', 'per', 'con', 'non', 'mio', 'mia', 'questo'],
};

// Character-set hints for languages whose script alone is a strong tell,
// checked before falling back to stopword scoring.
const SCRIPT_HINTS: [RegExp, string][] = [
  [/[Ѐ-ӿ]/, 'ru'],
  [/[一-鿿]/, 'zh'],
  [/[぀-ヿ]/, 'ja'],
  [/[가-힯]/, 'ko'],
  [/[؀-ۿ]/, 'ar'],
];

// Detects a language from a short caption/title-style string. Returns
// language = null with source 'none' when there isn't enough signal —
// deliberately conservative rather than guessing on noise (emoji-only
// captions, single words, etc.).
export function detectTextLanguage(
  text: string | null | undefined,
  source: Extract<LanguageSource, 'caption' | 'title'>
): LanguageSignal {
  const trimmed = (text ?? '').trim();
  if (trimmed.length < 4) {
    return { language: null, confidence: 0, source: 'none' };
  }

  for (const [pattern, lang] of SCRIPT_HINTS) {
    if (pattern.test(trimmed)) {
      return { language: lang, confidence: 0.75, source };
    }
  }

  const words = trimmed
    .toLowerCase()
    .replace(/[^\p{L}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return { language: null, confidence: 0, source: 'none' };
  }

  const scores: Record<string, number> = {};
  for (const word of words) {
    for (const [lang, list] of Object.entries(STOPWORDS)) {
      if (list.includes(word)) {
        scores[lang] = (scores[lang] ?? 0) + 1;
      }
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0 || ranked[0][1] === 0) {
    return { language: null, confidence: 0, source: 'none' };
  }

  const [bestLang, bestCount] = ranked[0];
  const confidence = Math.min(0.65, 0.25 + bestCount / Math.max(words.length, 4));
  return { language: bestLang, confidence, source };
}

// Combines every available signal into one (language, confidence, source)
// per AGENTS.md section 3's priority order:
//   1. Creator override always wins outright.
//   2. Speech is the strongest automatic signal.
//   3. Caption/title and OCR are supporting evidence, used when speech is
//      unavailable or low-confidence.
//   4. Subtitle language is tracked separately and never substitutes here.
export function combineLanguageSignals(signals: {
  creator?: string | null;
  speech?: LanguageSignal | null;
  caption?: LanguageSignal | null;
  title?: LanguageSignal | null;
  ocr?: LanguageSignal | null;
}): LanguageSignal {
  if (signals.creator) {
    return { language: signals.creator, confidence: 1, source: 'creator' };
  }
  if (signals.speech && signals.speech.language && signals.speech.confidence >= 0.5) {
    return signals.speech;
  }

  const supporting = [signals.title, signals.caption, signals.ocr].filter(
    (s): s is LanguageSignal => !!s && !!s.language
  );
  if (supporting.length > 0) {
    supporting.sort((a, b) => b.confidence - a.confidence);
    return supporting[0];
  }

  return { language: null, confidence: 0, source: 'none' };
}
