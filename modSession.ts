import { useSyncExternalStore } from 'react';

// The moderator unlock token lives here and nowhere else — deliberately in
// memory, never AsyncStorage. Closing the app drops it, which is exactly the
// rule: a moderator re-enters their password once per session before any
// moderation tool will work. The server validates the token on every call
// (convex/moderation.ts), so this store is a convenience, not the gate.

let token: string | null = null;
let ownerId: string | null = null;
let expiresAt = 0;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): string | null {
  if (!token || Date.now() >= expiresAt) return null;
  return token;
}

export function setModToken(userId: string, nextToken: string, nextExpiresAt: number) {
  token = nextToken;
  ownerId = userId;
  expiresAt = nextExpiresAt;
  notify();
}

export function clearModToken() {
  token = null;
  ownerId = null;
  expiresAt = 0;
  notify();
}

// Reading the token outside React (inside an event handler, right before a
// mutation) — returns null unless it belongs to this account and is unexpired.
export function getModToken(userId: string): string | null {
  if (ownerId !== userId) return null;
  return snapshot();
}

// Re-renders the caller the moment the account is unlocked or locked again.
export function useModToken(userId: string | null): string | null {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (!userId || ownerId !== userId) return null;
  return current;
}
