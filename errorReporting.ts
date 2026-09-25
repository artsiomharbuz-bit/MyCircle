import { readableError } from './errorMessage';

// A tiny pub/sub so any failed backend call that nobody handled can surface
// as a friendly toast (see components/ErrorToast.tsx) instead of a red
// "Convex error" screen.
type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function subscribeToErrors(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportError(err: unknown): void {
  const message = readableError(err);
  listeners.forEach((listener) => listener(message));
}

// True for the "your session ran out" family of errors — the app answers
// those by sending the person back to log in, not by showing an error.
export function isSessionExpiredError(err: unknown): boolean {
  return /session (has )?expired|log in again|not logged in/i.test(readableError(err));
}
