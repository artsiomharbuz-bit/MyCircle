// Same behaviour as errorMessage.ts / errorReporting.ts in the app: turn any
// failed backend call into a plain sentence, and let unhandled failures show
// as a toast instead of a console error.
export function readableError(err: unknown): string {
  const data = (err as { data?: unknown } | null)?.data;
  if (typeof data === 'string' && data.length > 0) return data;
  if (err instanceof Error && err.message) {
    const match = err.message.match(/Uncaught ConvexError:\s*(.+)$/s);
    if (match) return match[1].trim().split('\n')[0];
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

export function isSessionExpiredError(err: unknown): boolean {
  return /session (has )?expired|log in again|not logged in/i.test(readableError(err));
}

type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function subscribeToErrors(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toast(message: string): void {
  listeners.forEach((l) => l(message));
}

export function reportError(err: unknown): void {
  toast(readableError(err));
}
