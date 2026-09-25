"use node";

// Node runtime, deliberately: this file does binary file handling (fetching
// video bytes, building multipart/form-data) against an external API, which
// Convex's docs call out as exactly the case to run under Node rather than
// the default isolate — guarantees Buffer/FormData/Blob/fetch all behave
// like real Node 18+ (undici), instead of leaving that as an assumption.
//
// Multimodal language-detection pipeline. Speech-to-text is now real: it
// runs against Groq's free-tier hosted Whisper endpoint (see
// transcribeWithGroq below) whenever GROQ_API_KEY is configured
// (`npx convex env set GROQ_API_KEY ...`). Subtitle-track extraction and
// OCR of burned-in subtitles still need infrastructure this project doesn't
// have (a media-parsing service, a vision/OCR API) — those stay honest
// stubs per AGENTS.md: "do not fake the functionality."
//
// Nothing here uses text-to-speech, and nothing needs to — speech-to-text
// is the only direction this pipeline requires.

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { LanguageSignal } from './lib/language';

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
// The "turbo" variant — Groq's fastest Whisper-large-v3 hosting, plenty
// accurate for language ID + a rough transcript, and keeps the free daily
// quota (~8h of audio) stretching further than the full-size model would.
const GROQ_MODEL = 'whisper-large-v3-turbo';

// Whisper's fixed 99-language set, keyed by the lowercased English name the
// API returns in `language` (confirmed against a live call — Groq's
// verbose_json response gives e.g. "English", "Polish", title-cased).
// Stable public data from Whisper's own tokenizer language table.
const WHISPER_LANGUAGE_TO_ISO: Record<string, string> = {
  english: 'en', chinese: 'zh', german: 'de', spanish: 'es', russian: 'ru',
  korean: 'ko', french: 'fr', japanese: 'ja', portuguese: 'pt', turkish: 'tr',
  polish: 'pl', catalan: 'ca', dutch: 'nl', arabic: 'ar', swedish: 'sv',
  italian: 'it', indonesian: 'id', hindi: 'hi', finnish: 'fi', vietnamese: 'vi',
  hebrew: 'he', ukrainian: 'uk', greek: 'el', malay: 'ms', czech: 'cs',
  romanian: 'ro', danish: 'da', hungarian: 'hu', tamil: 'ta', norwegian: 'no',
  thai: 'th', urdu: 'ur', croatian: 'hr', bulgarian: 'bg', lithuanian: 'lt',
  latin: 'la', maori: 'mi', malayalam: 'ml', welsh: 'cy', slovak: 'sk',
  telugu: 'te', persian: 'fa', latvian: 'lv', bengali: 'bn', serbian: 'sr',
  azerbaijani: 'az', slovenian: 'sl', kannada: 'kn', estonian: 'et', macedonian: 'mk',
  breton: 'br', basque: 'eu', icelandic: 'is', armenian: 'hy', nepali: 'ne',
  mongolian: 'mn', bosnian: 'bs', kazakh: 'kk', albanian: 'sq', swahili: 'sw',
  galician: 'gl', marathi: 'mr', punjabi: 'pa', sinhala: 'si', khmer: 'km',
  shona: 'sn', yoruba: 'yo', somali: 'so', afrikaans: 'af', occitan: 'oc',
  georgian: 'ka', belarusian: 'be', tajik: 'tg', sindhi: 'sd', gujarati: 'gu',
  amharic: 'am', yiddish: 'yi', lao: 'lo', uzbek: 'uz', faroese: 'fo',
  'haitian creole': 'ht', pashto: 'ps', turkmen: 'tk', nynorsk: 'nn', maltese: 'mt',
  sanskrit: 'sa', luxembourgish: 'lb', myanmar: 'my', tibetan: 'bo', tagalog: 'tl',
  malagasy: 'mg', assamese: 'as', tatar: 'tt', hawaiian: 'haw', lingala: 'ln',
  hausa: 'ha', bashkir: 'ba', javanese: 'jw', sundanese: 'su',
};

type GroqTranscriptionResponse = {
  text?: string;
  language?: string;
  segments?: { no_speech_prob?: number }[];
};

// Calls Groq's OpenAI-compatible Whisper endpoint directly with the video
// file (Whisper accepts mp4/webm/etc. and extracts audio server-side — no
// separate audio-extraction step needed here, confirmed against a live
// test upload). Returns null on any failure (missing key, network error,
// non-2xx, unparseable body) — the caller treats that exactly like "no
// speech signal available", the same safe fallback this pipeline already
// used before a provider was configured.
async function transcribeWithGroq(
  mediaUrl: string,
  filename: string
): Promise<{ text: string; language: string | null; confidence: number } | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) return null;
    const blob = await mediaResponse.blob();

    const form = new FormData();
    form.append('file', blob, filename);
    form.append('model', GROQ_MODEL);
    form.append('response_format', 'verbose_json');

    const response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) return null;

    const data = (await response.json()) as GroqTranscriptionResponse;
    const text = typeof data.text === 'string' ? data.text.trim() : '';

    const rawLanguage = typeof data.language === 'string' ? data.language.toLowerCase() : null;
    const iso = rawLanguage
      ? rawLanguage.length === 2
        ? rawLanguage
        : (WHISPER_LANGUAGE_TO_ISO[rawLanguage] ?? null)
      : null;

    // Whisper reports, per segment, how confident it is that the segment
    // contains no speech at all (no_speech_prob). Averaging (1 -
    // no_speech_prob) across segments gives a real, data-derived stand-in
    // for language-detection confidence instead of a flat guessed constant
    // — low when the clip is mostly music/silence/noise (which is exactly
    // when the detected "language" is least trustworthy), high when
    // Whisper was confident actual speech was present throughout.
    const segments = data.segments ?? [];
    const speechConfidence =
      segments.length > 0
        ? segments.reduce((sum, s) => sum + (1 - (s.no_speech_prob ?? 0)), 0) / segments.length
        : text.length > 0
          ? 0.6
          : 0;

    return { text, language: iso, confidence: speechConfidence };
  } catch {
    return null;
  }
}

// Not implemented: no media-parsing service is configured to inspect an
// uploaded video for an actual embedded subtitle/caption track. A missing
// subtitle track is a completely normal, expected result regardless — most
// uploads won't have one — so this returning null is not itself an error.
export async function extractSubtitleTrack(
  _mediaStorageId: string
): Promise<{ language: string; confidence: number } | null> {
  return null;
}

// Not implemented: no OCR provider is configured to sample frames from a
// video and read burned-in subtitle text. See AGENTS.md's free-OCR-options
// discussion (OCR.space, self-hosted Tesseract) for how to wire one in —
// same shape as transcribeWithGroq above, just a different endpoint.
export async function ocrBurnedInSubtitles(
  _mediaStorageId: string
): Promise<LanguageSignal | null> {
  return null;
}

// ---------------------------------------------------------------------------
// Convex wiring — scheduled from posts.createPost for every video upload
// (see posts.ts), runs after the post already exists so it never blocks the
// upload flow the user is waiting on. The query/mutation this action calls
// live in posts.ts (getPostForTranscription / applyDetectedLanguage)
// instead of here: a "use node" file can only export actions, not
// queries/mutations, since Node functions don't run inside Convex's
// transactional isolate.
// ---------------------------------------------------------------------------

export const transcribeAndDetectLanguage = internalAction({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    const post = await ctx.runQuery(internal.posts.getPostForTranscription, { postId });
    if (!post || post.mediaType !== 'video') return;

    const mediaUrl = await ctx.storage.getUrl(post.mediaStorageId);
    if (!mediaUrl) return;

    const result = await transcribeWithGroq(mediaUrl, `${postId}.mp4`);
    if (!result) return;

    await ctx.runMutation(internal.posts.applyDetectedLanguage, {
      postId,
      transcript: result.text,
      speechLanguage: result.language,
      speechConfidence: result.confidence,
    });
  },
});

// What the upload pipeline calls synchronously for the signals that don't
// need a network round trip (caption/title heuristic, creator override) —
// speech runs separately via the scheduled action above since it's slow
// and shouldn't block post creation. Kept for callers that want every
// *synchronous* signal resolved in one shot.
export async function resolveContentLanguage(input: {
  creatorLanguage?: string | null;
  captionSignal?: LanguageSignal | null;
  titleSignal?: LanguageSignal | null;
}): Promise<{
  language: string | null;
  confidence: number;
  source: LanguageSignal['source'];
}> {
  const { combineLanguageSignals } = await import('./lib/language');
  return combineLanguageSignals({
    creator: input.creatorLanguage,
    caption: input.captionSignal,
    title: input.titleSignal,
  });
}
