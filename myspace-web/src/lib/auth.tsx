import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReference, OptionalRestArgs } from 'convex/server';
import type { OptionalRestArgsOrSkip } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { isSessionExpiredError, reportError } from './errors';
import type { Id } from '../../../convex/_generated/dataModel';
import {
  clearStoredSessionToken,
  clearStoredUserId,
  getStoredSessionToken,
  getStoredUserId,
  setStoredSessionToken,
  setStoredUserId,
} from './session';

type AuthContextValue = {
  userId: Id<'users'> | null;
  sessionToken: string | null;
  isLoading: boolean;
  user: ReturnType<typeof useQuery<typeof api.users.getUser>> | null | undefined;
  signIn: (userId: string, sessionToken: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<Id<'users'> | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const deleteSession = useMutation(api.users.deleteSession);

  useEffect(() => {
    const stored = getStoredUserId();
    const storedToken = getStoredSessionToken();
    // A userId saved from before session tokens existed (or a token that
    // failed to persist) can't make any protected call — treat it as
    // logged out rather than getting stuck skipping every query forever.
    if (stored && storedToken) {
      setUserId(stored as Id<'users'>);
      setSessionToken(storedToken);
    } else if (stored) {
      clearStoredUserId();
    }
    setReady(true);
  }, []);

  const user = useQuery(
    api.users.getUser,
    userId ? { userId, viewerId: userId, sessionToken: sessionToken ?? undefined } : 'skip'
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      userId,
      sessionToken,
      isLoading: !ready,
      user,
      signIn: (id: string, token: string) => {
        setStoredUserId(id);
        setStoredSessionToken(token);
        setUserId(id as Id<'users'>);
        setSessionToken(token);
      },
      signOut: () => {
        if (sessionToken) {
          deleteSession({ token: sessionToken });
        }
        clearStoredUserId();
        clearStoredSessionToken();
        setUserId(null);
        setSessionToken(null);
      },
    }),
    [userId, sessionToken, ready, user, deleteSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Drop-in replacement for convex/react's useQuery that adds `sessionToken`
// to the args for you — mirrors SessionContext.tsx's useAuthedQuery in the
// mobile app. Pass 'skip' exactly like useQuery; also auto-skips while
// there's no session yet.
export function useAuthedQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: Query['_args'] extends Record<string, unknown>
    ? Omit<Query['_args'], 'sessionToken'> | 'skip'
    : 'skip'
) {
  const { sessionToken } = useAuth();
  const finalArgs =
    args === 'skip' || !sessionToken
      ? 'skip'
      : { ...(args as Record<string, unknown>), sessionToken };
  return useQuery(query, ...([finalArgs] as unknown as OptionalRestArgsOrSkip<Query>));
}

// Drop-in replacement for convex/react's useMutation — call the returned
// function with the same args as always, sessionToken is merged in for you.
// A rejected call whose caller never handles it would surface as an unhandled
// rejection; this leaves the promise exactly as callers expect, but shows the
// failure as a toast when nobody handled it (same as the app's SessionContext).
function watchUnhandled<T>(promise: Promise<T>, onExpired: () => void): Promise<T> {
  let handled = false;
  const originalThen = promise.then.bind(promise);
  (promise as { then: unknown }).then = (
    onFulfilled?: (value: T) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => {
    handled = true;
    return originalThen(onFulfilled, onRejected);
  };
  originalThen(undefined, (err: unknown) => {
    if (isSessionExpiredError(err)) onExpired();
    setTimeout(() => {
      if (!handled) reportError(err);
    }, 0);
  });
  return promise;
}

// Drop-in replacement for convex/react's useMutation — call the returned
// function with the same args as always, sessionToken is merged in for you.
export function useAuthedMutation<Mutation extends FunctionReference<'mutation'>>(mutation: Mutation) {
  const { sessionToken, signOut } = useAuth();
  const run = useMutation(mutation);
  return (args: Omit<Mutation['_args'], 'sessionToken'>) => {
    if (!sessionToken) {
      return watchUnhandled(Promise.reject(new Error('Please log in again.')), () => {}) as ReturnType<typeof run>;
    }
    return watchUnhandled(
      run({ ...args, sessionToken } as OptionalRestArgs<Mutation>[0]),
      () => signOut()
    );
  };
}
