import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';
import { decodePng } from './pngPixels';

// Downscaling this far turns "decode a real image" into "decode ~64
// pixels" — plenty for a dominant-color estimate, and keeps the hand-rolled
// PNG decoder's work trivial.
const SAMPLE_SIZE = 8;

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Buckets pixels into coarse 32-step RGB bins so near-identical shades
// (natural in a photo/video frame) count as the same color instead of each
// splitting the vote — then returns the most common bucket's own average
// color, which reads as much closer to "the" dominant color than a bucket
// midpoint would.
function findDominantColor(pixels: Uint8Array, channels: number): string {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  const bucketOf = (v: number) => Math.floor(v / 32);

  for (let i = 0; i + channels <= pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = channels === 4 ? pixels[i + 3] : 255;
    if (a < 16) continue; // skip near-transparent samples

    const key = `${bucketOf(r)}:${bucketOf(g)}:${bucketOf(b)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }
  if (!best) return '#3a3a3a'; // every sample was transparent — a neutral fallback

  return rgbToHex(
    Math.round(best.r / best.count),
    Math.round(best.g / best.count),
    Math.round(best.b / best.count)
  );
}

async function samplePhotoColor(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri).resize({ width: SAMPLE_SIZE, height: SAMPLE_SIZE });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ base64: true, format: SaveFormat.PNG });
  if (!result.base64) throw new Error('No base64 data returned for photo sample');
  const { pixels, channels } = decodePng(result.base64);
  return findDominantColor(pixels, channels);
}

async function sampleVideoColor(uri: string): Promise<string> {
  const player = createVideoPlayer({ uri });
  try {
    // A frame a beat into the clip reads more representatively than frame
    // zero, which is sometimes a fade-in or a title card.
    const [thumbnail] = await player.generateThumbnailsAsync(0.5, {
      maxWidth: SAMPLE_SIZE,
      maxHeight: SAMPLE_SIZE,
    });
    const context = ImageManipulator.manipulate(thumbnail).resize({
      width: SAMPLE_SIZE,
      height: SAMPLE_SIZE,
    });
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ base64: true, format: SaveFormat.PNG });
    if (!result.base64) throw new Error('No base64 data returned for video sample');
    const { pixels, channels } = decodePng(result.base64);
    return findDominantColor(pixels, channels);
  } finally {
    // SharedObject cleanup — best-effort, some platforms/versions may not
    // expose it, and a leaked one-off player is harmless either way.
    (player as unknown as { release?: () => void }).release?.();
  }
}

// Approximates the "most common color" in a photo or video, entirely from
// packages already in this app (expo-image-manipulator + expo-video) —
// no native dependency to add, no rebuild needed. Never throws: any
// failure (an unusual codec, an unreachable URL, an image format the
// hand-rolled PNG decoder in pngPixels.ts doesn't cover) falls back to a
// neutral gray so a remix can still be posted.
export async function getDominantColor(uri: string, mediaType: 'photo' | 'video'): Promise<string> {
  try {
    return mediaType === 'photo' ? await samplePhotoColor(uri) : await sampleVideoColor(uri);
  } catch (err) {
    console.log('Dominant color sampling failed, using fallback', err);
    return '#3a3a3a';
  }
}
