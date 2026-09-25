import { ConvexError } from 'convex/values';

// `instanceof ConvexError` can miss when two copies of 'convex/values' end up
// bundled (the thrown error and this file's import aren't literally the same
// class) — checking `.data` directly first is what actually protects against
// the raw "[CONVEX M(...)] Uncaught ConvexError: ..." dump leaking into the UI.
export function readableError(err: unknown): string {
  const data = (err as { data?: unknown } | null)?.data;
  if (typeof data === 'string' && data.length > 0) {
    return data;
  }
  if (err instanceof ConvexError) {
    return typeof err.data === 'string' ? err.data : 'Something went wrong.';
  }
  if (err instanceof Error && err.message) {
    // Convex formats a server-thrown ConvexError's message as
    // "[CONVEX M(...)] ... Uncaught ConvexError: <message>" — pull just the
    // message back out rather than showing that whole trace.
    const match = err.message.match(/Uncaught ConvexError:\s*(.+)$/s);
    if (match) return match[1].trim().split('\n')[0];
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}
