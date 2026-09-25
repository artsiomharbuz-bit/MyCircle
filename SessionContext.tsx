import { createContext, ReactNode, useContext } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReference, OptionalRestArgs } from 'convex/server';
import type { OptionalRestArgsOrSkip } from 'convex/react';
import { reportError } from './errorReporting';

// Holds the active account's session token (see convex/lib/session.ts on
// the backend) so useAuthedQuery/useAuthedMutation below can attach it to
// every call automatically, instead of every one of this app's screens
// having to thread it through by hand.
const SessionTokenContext = createContext<string | null>(null);

export function SessionTokenProvider({
  sessionToken,
  children,
}: {
  sessionToken: string | null;
  children: ReactNode;
}) {
  return (
    <SessionTokenContext.Provider value={sessionToken}>{children}</SessionTokenContext.Provider>
  );
}

// Drop-in replacement for convex/react's useQuery that adds `sessionToken`
// to the args for you. Pass 'skip' exactly like useQuery; also auto-skips
// (rather than sending a call the server will reject) while there's no
// session yet, e.g. during the brief window before login/register resolves.
export function useAuthedQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: Query['_args'] extends Record<string, unknown>
    ? Omit<Query['_args'], 'sessionToken'> | 'skip'
    : 'skip'
) {
  const sessionToken = useContext(SessionTokenContext);
  const finalArgs =
    args === 'skip' || !sessionToken
      ? 'skip'
      : { ...(args as Record<string, unknown>), sessionToken };
  return useQuery(query, ...([finalArgs] as unknown as OptionalRestArgsOrSkip<Query>));
}

// Drop-in replacement for convex/react's useMutation — call the returned
// function with the same args as always (no sessionToken needed at the call
// site), and it gets merged in before the request goes out.
export function useAuthedMutation<Mutation extends FunctionReference<'mutation'>>(mutation: Mutation) {
  const sessionToken = useContext(SessionTokenContext);
  const run = useMutation(mutation);
  return (args: Omit<Mutation['_args'], 'sessionToken'>) => {
    if (!sessionToken) {
      // Same as any failed call: callers that handle errors get a rejection,
      // and if nobody does, it shows as a friendly toast (see below).
      const failed = Promise.reject(new Error('Please log in again.'));
      return watchUnhandled(failed) as ReturnType<typeof run>;
    }
    return watchUnhandled(run({ ...args, sessionToken } as OptionalRestArgs<Mutation>[0]));
  };
}

// A rejected backend call whose caller never attaches a handler would land as
// an unhandled promise rejection (the red "Convex error" screen in a dev
// build). This leaves the promise exactly as the caller expects — anyone who
// awaits or .catch()es it still gets the rejection — but when nobody does, the
// failure is shown as a toast instead.
function watchUnhandled<T>(promise: Promise<T>): Promise<T> {
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
    setTimeout(() => {
      if (!handled) reportError(err);
    }, 0);
  });
  return promise;
}

export function useSessionToken(): string | null {
  return useContext(SessionTokenContext);
}
