export function readableError(err: unknown): string {
  const data = (err as { data?: unknown } | null)?.data;
  if (typeof data === 'string' && data.length > 0) return data;
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}
