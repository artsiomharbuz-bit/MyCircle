import { Image } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getVideoMetaData, Video as VideoCompressor } from 'react-native-compressor';

// Every photo gets capped to this on the long edge — big enough to look
// sharp full-width in the feed, nowhere near what a modern phone camera
// actually captures (which is what was quietly costing us bandwidth).
const MAX_PHOTO_DIMENSION = 1440;
const PHOTO_QUALITY = 0.7;

// Caps the video's long edge; react-native-compressor picks a matching
// bitrate automatically in 'auto' mode.
const MAX_VIDEO_DIMENSION = 1280;

export async function compressPhoto(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  const image = await context.resize({ width: MAX_PHOTO_DIMENSION }).renderAsync();
  const result = await image.saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG });
  return result.uri;
}

export async function compressVideo(uri: string): Promise<string> {
  return VideoCompressor.compress(uri, {
    compressionMethod: 'auto',
    maxSize: MAX_VIDEO_DIMENSION,
  });
}

// Posts show in the media's own shape; these limits (1:2 tall up to 2:1 wide)
// only stop truly extreme crops from breaking the feed layout.
export const MIN_POST_ASPECT = 0.5;
export const MAX_POST_ASPECT = 2;

// Width / height of the media as it will be seen, or undefined if it can't be
// read (the feed then falls back to a square). `portraitHint` is the camera
// preview's aspect: phones often record portrait video as landscape pixels
// plus a rotation flag, so when we know it was shot upright we trust that.
export async function getMediaAspect(
  uri: string,
  type: 'photo' | 'video',
  portraitHint?: number
): Promise<number | undefined> {
  try {
    let width: number;
    let height: number;
    if (type === 'photo') {
      ({ width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) =>
        Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject)
      ));
    } else {
      const meta = await getVideoMetaData(uri);
      width = meta.width;
      height = meta.height;
      if (portraitHint !== undefined && portraitHint < 1 && width > height) {
        [width, height] = [height, width];
      }
    }
    if (!(width > 0 && height > 0)) return undefined;
    return Math.min(MAX_POST_ASPECT, Math.max(MIN_POST_ASPECT, width / height));
  } catch {
    return undefined;
  }
}

export async function compressMedia(uri: string, type: 'photo' | 'video'): Promise<string> {
  try {
    return type === 'photo' ? await compressPhoto(uri) : await compressVideo(uri);
  } catch (err) {
    // If compression fails for any reason, fall back to the original file
    // rather than blocking the post entirely.
    console.log('Media compression failed, uploading original', err);
    return uri;
  }
}
