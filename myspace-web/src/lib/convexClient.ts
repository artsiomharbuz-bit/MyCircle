import { ConvexReactClient } from 'convex/react';

const url = import.meta.env.VITE_CONVEX_URL as string;

if (!url) {
  throw new Error('VITE_CONVEX_URL is not set (see web/.env.local)');
}

// The client's own logger prints every failed call as a red console error;
// route it to console.log instead (failures the UI doesn't handle show as a
// toast — see lib/errors.ts).
export const convex = new ConvexReactClient(url, {
  logger: {
    log: (...a: unknown[]) => console.log(...a),
    warn: (...a: unknown[]) => console.log(...a),
    error: (...a: unknown[]) => console.log(...a),
    logVerbose: () => {},
  },
});
