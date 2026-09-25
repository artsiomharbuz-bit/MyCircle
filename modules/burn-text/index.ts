import { requireOptionalNativeModule } from 'expo-modules-core';

type BurnTextNative = {
  // Renders `overlayUri` (a transparent PNG the size of the edit canvas)
  // into the video's pixels; resolves with the new file:// video uri.
  burn(videoUri: string, overlayUri: string): Promise<string>;
};

// null when the native module isn't part of this build (Expo Go, or a dev
// client built before the module was added) — callers fall back to the
// text-overlay path.
const native = requireOptionalNativeModule<BurnTextNative>('BurnText');

export const canBurnText = native !== null;

export async function burnTextIntoVideo(videoUri: string, overlayPngUri: string): Promise<string> {
  if (!native) throw new Error('BurnText native module unavailable');
  return native.burn(videoUri, overlayPngUri);
}
