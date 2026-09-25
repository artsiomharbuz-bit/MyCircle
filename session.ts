import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = 'mycircle.userId';
const SAVED_ACCOUNT_IDS_KEY = 'mycircle.savedAccountIds';
// One session token per saved account (not just the active one) — the
// account switcher lets you jump between several logged-in accounts on one
// device without re-entering a password, which now means each of those
// accounts needs its own live session token on hand, not just the active
// account's.
const SESSION_TOKENS_KEY = 'mycircle.sessionTokens';

export async function getStoredUserId(): Promise<string | null> {
  return AsyncStorage.getItem(USER_ID_KEY);
}

export async function setStoredUserId(userId: string): Promise<void> {
  await AsyncStorage.setItem(USER_ID_KEY, userId);
}

export async function clearStoredUserId(): Promise<void> {
  await AsyncStorage.removeItem(USER_ID_KEY);
}

async function getSessionTokens(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(SESSION_TOKENS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function getStoredSessionToken(userId: string): Promise<string | null> {
  const tokens = await getSessionTokens();
  return tokens[userId] ?? null;
}

export async function setStoredSessionToken(userId: string, token: string): Promise<void> {
  const tokens = await getSessionTokens();
  tokens[userId] = token;
  await AsyncStorage.setItem(SESSION_TOKENS_KEY, JSON.stringify(tokens));
}

export async function clearStoredSessionToken(userId: string): Promise<void> {
  const tokens = await getSessionTokens();
  delete tokens[userId];
  await AsyncStorage.setItem(SESSION_TOKENS_KEY, JSON.stringify(tokens));
}

// Every account that's ever been logged into on this device, so the account
// switcher can offer instant switching without re-entering a password.
export async function getSavedAccountIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(SAVED_ACCOUNT_IDS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addSavedAccountId(userId: string): Promise<string[]> {
  const ids = await getSavedAccountIds();
  if (ids.includes(userId)) return ids;
  const next = [...ids, userId];
  await AsyncStorage.setItem(SAVED_ACCOUNT_IDS_KEY, JSON.stringify(next));
  return next;
}
