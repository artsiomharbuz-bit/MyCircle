import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { gradientPalette } from './theme';

// A per-viewer, per-conversation preference — stored only on this device,
// never synced anywhere, so the other person never sees or is affected by
// it. Namespaced by viewerId (not just otherUserId) so switching accounts
// on the same device via the account switcher can't leak one account's
// choice into another's chat.
const keyFor = (viewerId: string, otherUserId: string) =>
  `mycircle.chatBackground.${viewerId}.${otherUserId}`;

export type ChatBackground =
  // An index into theme.ts's gradientPalette.
  | { type: 'gradient'; index: number }
  // A local file:// uri — see saveChatBackgroundPhoto, which is what
  // produces a uri that's actually safe to store (the one the picker
  // hands back can be a temp/cache path that disappears later).
  | { type: 'photo'; uri: string };

export async function getChatBackground(
  viewerId: string,
  otherUserId: string
): Promise<ChatBackground | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(viewerId, otherUserId));
    if (raw === null) return null;

    const parsed = JSON.parse(raw) as ChatBackground;
    if (parsed.type === 'gradient') {
      const valid = Number.isInteger(parsed.index) && parsed.index >= 0 && parsed.index < gradientPalette.length;
      return valid ? parsed : null;
    }
    if (parsed.type === 'photo' && typeof parsed.uri === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setChatBackground(
  viewerId: string,
  otherUserId: string,
  background: ChatBackground | null
): Promise<void> {
  const key = keyFor(viewerId, otherUserId);
  try {
    if (background === null) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(background));
    }
  } catch {
    // Best-effort — a failed write just means the background resets to
    // default next time, not worth surfacing an error for.
  }
}

// The image picker hands back a uri that can live in a cache directory the
// OS is free to clear (especially on iOS) — copying it into the app's own
// document directory is what makes "set a photo background" survive an app
// restart. Returns the persistent uri to hand to setChatBackground.
export async function saveChatBackgroundPhoto(
  viewerId: string,
  otherUserId: string,
  pickedUri: string
): Promise<string> {
  const dir = new Directory(Paths.document, 'chatBackgrounds');
  if (!dir.exists) dir.create({ intermediates: true });

  const extension = pickedUri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = new File(dir, `${viewerId}_${otherUserId}.${extension}`);
  if (dest.exists) dest.delete();

  const source = new File(pickedUri);
  await source.copy(dest);
  return dest.uri;
}
