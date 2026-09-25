import { useEffect, useState } from 'react';
import { useConvex } from 'convex/react';
import { api } from './convex/_generated/api';
import { Id } from './convex/_generated/dataModel';
import { getStoredSessionToken } from './session';

const POLL_MS = 15000;

// Unread message counts for the *other* accounts saved on this device (the
// active account's own count already flows through App.tsx). Each saved
// account has its own session token in storage, so they're polled through
// the raw client rather than the active-session hooks.
export default function useOtherAccountUnread(
  currentUserId: Id<'users'>,
  accountIds: Id<'users'>[]
): Record<string, number> {
  const convex = useConvex();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = accountIds.filter((id) => id !== currentUserId).join(',');

  useEffect(() => {
    const others = key ? (key.split(',') as Id<'users'>[]) : [];
    if (others.length === 0) {
      setCounts({});
      return;
    }
    let cancelled = false;

    const load = async () => {
      const next: Record<string, number> = {};
      await Promise.all(
        others.map(async (id) => {
          try {
            const token = await getStoredSessionToken(id);
            if (!token) return;
            next[id] = await convex.query(api.messages.getUnreadMessageCount, {
              userId: id,
              sessionToken: token,
            });
          } catch {
            // An expired session just shows no badge.
          }
        })
      );
      if (!cancelled) setCounts(next);
    };

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [convex, key]);

  return counts;
}
