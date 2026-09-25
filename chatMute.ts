import AsyncStorage from '@react-native-async-storage/async-storage';

// A per-viewer, per-conversation preference — local to this device only,
// same pattern (and same reasoning) as chatBackgrounds.ts. There's no
// server-side push pipeline yet for DMs to actually hook a mute into, so
// this is a client-side "don't bother me" flag — it hides this thread's
// unread emphasis rather than suppressing a push notification.
const keyFor = (viewerId: string, otherUserId: string) => `mycircle.chatMuted.${viewerId}.${otherUserId}`;

export async function getChatMuted(viewerId: string, otherUserId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(viewerId, otherUserId))) === '1';
  } catch {
    return false;
  }
}

export async function setChatMuted(viewerId: string, otherUserId: string, muted: boolean): Promise<void> {
  try {
    if (muted) {
      await AsyncStorage.setItem(keyFor(viewerId, otherUserId), '1');
    } else {
      await AsyncStorage.removeItem(keyFor(viewerId, otherUserId));
    }
  } catch {
    // Best-effort, same as chatBackgrounds.ts.
  }
}
