// Mirrors session.ts in the mobile app. Convex functions now verify a real
// server-issued session token (see convex/lib/session.ts) rather than
// trusting the client-supplied userId at face value — the userId is still
// kept for convenience (which account is this, for UI purposes) but every
// protected call also carries the token below.
const USER_ID_KEY = 'mycircle.web.userId';
const SESSION_TOKEN_KEY = 'mycircle.web.sessionToken';

export function getStoredUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function setStoredUserId(userId: string): void {
  localStorage.setItem(USER_ID_KEY, userId);
}

export function clearStoredUserId(): void {
  localStorage.removeItem(USER_ID_KEY);
}

export function getStoredSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setStoredSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearStoredSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}
