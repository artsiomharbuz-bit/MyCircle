// A single random id per app process lifetime — groups impressions into
// "one session" for the Clips feed's session-level UCB exploration (see
// convex/posts.ts buildSessionClusterBias) and for content-impression
// logging generally. Intentionally in-memory only: a fresh app launch is a
// fresh session, which is exactly the boundary session-level exploration is
// supposed to reset at.
let sessionId: string | null = null;

export function getAppSessionId(): string {
  if (!sessionId) {
    sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return sessionId;
}
