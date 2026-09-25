import AsyncStorage from '@react-native-async-storage/async-storage';
import { radius } from './theme';

// A per-viewer, per-conversation preference — same storage pattern as
// chatBackgrounds.ts (device-local, namespaced by viewerId so the account
// switcher can't leak one account's choice into another's chat).
const keyFor = (viewerId: string, otherUserId: string) =>
  `mycircle.chatBubbleStyle.${viewerId}.${otherUserId}`;

export type BubbleStyleKey = 'rounded' | 'compact' | 'sharp' | 'playful';

export const DEFAULT_BUBBLE_STYLE: BubbleStyleKey = 'rounded';

// What each style actually changes on the bubble: its main corner radius,
// the tighter "tail" corner on the side pointing at the sender, and how
// tight its internal padding is. `ChatScreen` reads this directly rather
// than each screen inventing its own numbers per style.
export const bubbleStylePresets: Record<
  BubbleStyleKey,
  { label: string; radius: number; tailRadius: number; paddingHorizontal: number; paddingVertical: number }
> = {
  rounded: { label: 'Rounded', radius: radius.lg, tailRadius: radius.xs, paddingHorizontal: 14, paddingVertical: 9 },
  compact: { label: 'Compact', radius: radius.xl, tailRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7 },
  sharp: { label: 'Sharp', radius: radius.sm, tailRadius: 4, paddingHorizontal: 14, paddingVertical: 9 },
  playful: { label: 'Playful', radius: 26, tailRadius: 22, paddingHorizontal: 16, paddingVertical: 10 },
};

export async function getChatBubbleStyle(
  viewerId: string,
  otherUserId: string
): Promise<BubbleStyleKey> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(viewerId, otherUserId));
    if (raw && raw in bubbleStylePresets) return raw as BubbleStyleKey;
    return DEFAULT_BUBBLE_STYLE;
  } catch {
    return DEFAULT_BUBBLE_STYLE;
  }
}

export async function setChatBubbleStyle(
  viewerId: string,
  otherUserId: string,
  style: BubbleStyleKey
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(viewerId, otherUserId), style);
  } catch {
    // Best-effort — a failed write just means it resets to default next time.
  }
}
