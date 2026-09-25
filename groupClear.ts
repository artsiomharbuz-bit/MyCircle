import AsyncStorage from '@react-native-async-storage/async-storage';

// "Clear chat" for a group is per-viewer and local to this device: it just
// remembers a cutoff time, and messages at or before it are hidden from this
// viewer. Same reasoning as chatBackgrounds.ts / chatMute.ts.
const keyFor = (viewerId: string, groupId: string) => `mycircle.groupClearedAt.${viewerId}.${groupId}`;

export async function getGroupClearedAt(viewerId: string, groupId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(viewerId, groupId));
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function setGroupClearedAt(viewerId: string, groupId: string, at: number): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(viewerId, groupId), String(at));
  } catch {
    // Best-effort.
  }
}
