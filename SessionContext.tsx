import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { reportError } from './errorReporting';
import { supabase } from './lib/supabase';

const SessionTokenContext = createContext<string | null>(null);
const queryListeners = new Set<() => void>();

export function SessionTokenProvider({
  sessionToken,
  children,
}: {
  sessionToken: string | null;
  children: ReactNode;
}) {
  return <SessionTokenContext.Provider value={sessionToken}>{children}</SessionTokenContext.Provider>;
}

function getFunctionName(reference: any): string {
  const name = typeof reference === 'string' ? reference : reference?.[Symbol.for('functionName')];
  if (typeof name !== 'string') throw new Error('Invalid Supabase function reference.');
  return name;
}

export async function callSupabaseFunction(
  reference: any,
  args: Record<string, unknown> = {},
  invalidate = false
) {
  const name = getFunctionName(reference);
  const { data, error } = await supabase.functions.invoke('api', { body: { name, args } });
  if (error) throw new Error(error.message || 'Could not reach the Supabase backend.');
  if (data?.error) throw new Error(String(data.error));
  if (invalidate) for (const listener of queryListeners) listener();
  return data?.data;
}

export function useBackendQuery(query: any, args: any) {
  const name = getFunctionName(query);
  const sessionToken = useContext(SessionTokenContext);
  const argsKey = args === 'skip' ? 'skip' : JSON.stringify(args ?? {});
  const [value, setValue] = useState<any>(undefined);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    if (argsKey === 'skip') {
      setValue(undefined);
      return;
    }
    let live = true;
    setValue(undefined);
    const actualArgs = JSON.parse(argsKey);
    if (sessionToken && actualArgs && typeof actualArgs === 'object') {
      actualArgs.sessionToken = sessionToken;
    }
    callSupabaseFunction(name, actualArgs)
      .then((result) => { if (live) setValue(result); })
      .catch((error) => { if (live) { setValue(undefined); reportError(error); } });
    return () => { live = false; };
  }, [name, argsKey, sessionToken, refreshIndex]);

  useEffect(() => {
    if (argsKey === 'skip') return;
    const refresh = () => setRefreshIndex((index) => index + 1);
    queryListeners.add(refresh);
    const livePoll = /(?:messages\.(?:listMessages|listConversations|getUnreadMessageCount|getOtherLastRead)|groups\.listGroupMessages|typing\.|notifications\.getUnseenNotificationCount)/.test(name);
    const timer = livePoll ? setInterval(refresh, 2500) : null;
    return () => {
      queryListeners.delete(refresh);
      if (timer) clearInterval(timer);
    };
  }, [argsKey, name]);

  return value;
}

export function useAuthedQuery(query: any, args: any) {
  const sessionToken = useContext(SessionTokenContext);
  return useBackendQuery(query, args === 'skip' || !sessionToken ? 'skip' : args);
}

export function useAuthedMutation(mutation: any) {
  const sessionToken = useContext(SessionTokenContext);
  const name = getFunctionName(mutation);
  return useCallback((args: Record<string, any> = {}) => {
    if (!sessionToken) {
      return watchUnhandled(Promise.reject(new Error('Please log in again.')));
    }
    return watchUnhandled(callSupabaseFunction(name, { ...args, sessionToken }, true));
  }, [name, sessionToken]);
}

export function useBackendAction(action: any) {
  const name = getFunctionName(action);
  return useCallback((args: Record<string, any> = {}) =>
    watchUnhandled(callSupabaseFunction(name, args, true)), [name]);
}

export const useAction = useBackendAction;
export function useMutation<T = any>(mutation: T) {
  return useAuthedMutation(mutation);
}
export function useQuery<T = any>(query: T, args: any): any {
  return useBackendQuery(query, args);
}

export function useSupabaseBackend() {
  return useMemo(() => ({
    query: (reference: any, args: Record<string, any>) => callSupabaseFunction(reference, args),
  }), []);
}

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
  originalThen(undefined, (error: unknown) => {
    setTimeout(() => { if (!handled) reportError(error); }, 0);
  });
  return promise;
}

export function useSessionToken(): string | null {
  return useContext(SessionTokenContext);
}
