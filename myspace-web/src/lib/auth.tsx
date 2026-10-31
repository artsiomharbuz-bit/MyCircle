import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../../../supabase/api';
import type { Id } from '../../../supabase/types';
import { clearStoredSessionToken, clearStoredUserId, getStoredSessionToken, getStoredUserId, setStoredSessionToken, setStoredUserId } from './session';
import { isSessionExpiredError, reportError } from './errors';
import { supabase } from './supabaseClient';

type AuthContextValue = {
  userId: Id<'users'> | null;
  sessionToken: string | null;
  isLoading: boolean;
  user: any;
  signIn: (userId: string, sessionToken: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const queryListeners = new Set<() => void>();

function functionName(ref: any): string {
  const name = typeof ref === 'string' ? ref : ref?.[Symbol.for('functionName')];
  if (typeof name !== 'string') throw new Error('Invalid Supabase function reference.');
  return name;
}

export async function callBackend(ref: any, args: Record<string, unknown> = {}, invalidate = false) {
  const { data, error } = await supabase.functions.invoke('api', { body: { name: functionName(ref), args } });
  if (error) throw new Error(error.message || 'Could not reach the Supabase backend.');
  if (data?.error) throw new Error(String(data.error));
  if (invalidate) for (const listener of queryListeners) listener();
  return data?.data;
}

function useBackendQuery(ref: any, args: any) {
  const name = functionName(ref);
  const argsKey = args === 'skip' ? 'skip' : JSON.stringify(args ?? {});
  const [value, setValue] = useState<any>(undefined);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (argsKey === 'skip') { setValue(undefined); return; }
    let active = true;
    const parsed = JSON.parse(argsKey);
    setValue(undefined);
    callBackend(name, parsed).then((data) => { if (active) setValue(data); }).catch((error) => {
      if (!active) return;
      setValue(undefined);
      reportError(error);
    });
    return () => { active = false; };
  }, [name, argsKey, refresh]);

  useEffect(() => {
    if (argsKey === 'skip') return;
    const listener = () => setRefresh((n) => n + 1);
    queryListeners.add(listener);
    const poll = /messages\.|groups\.listGroupMessages|typing\.|notifications\./.test(name);
    const timer = poll ? window.setInterval(listener, 3000) : undefined;
    return () => { queryListeners.delete(listener); if (timer !== undefined) window.clearInterval(timer); };
  }, [name, argsKey]);
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<Id<'users'> | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredUserId();
    const token = getStoredSessionToken();
    if (stored && token) {
      setUserId(stored as Id<'users'>);
      setSessionToken(token);
    } else if (stored) clearStoredUserId();
    setReady(true);
  }, []);

  const user = useBackendQuery(api.users.getUser,
    userId ? { userId, viewerId: userId, sessionToken: sessionToken ?? undefined } : 'skip');

  const signIn = useCallback((id: string, token: string) => {
    setStoredUserId(id);
    setStoredSessionToken(token);
    setUserId(id as Id<'users'>);
    setSessionToken(token);
  }, []);

  const signOut = useCallback(() => {
    if (sessionToken) callBackend(api.users.deleteSession, { token: sessionToken }, true).catch(() => {});
    clearStoredUserId();
    clearStoredSessionToken();
    setUserId(null);
    setSessionToken(null);
  }, [sessionToken]);

  const value = useMemo<AuthContextValue>(() => ({
    userId, sessionToken, isLoading: !ready, user, signIn, signOut,
  }), [userId, sessionToken, ready, user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useAuthedQuery(ref: any, args: any) {
  const { sessionToken } = useAuth();
  return useBackendQuery(ref, args === 'skip' || !sessionToken ? 'skip' : { ...args, sessionToken });
}

function watchUnhandled<T>(promise: Promise<T>, onExpired: () => void): Promise<T> {
  let handled = false;
  const then = promise.then.bind(promise);
  (promise as { then: unknown }).then = (ok?: (value: T) => unknown, fail?: (error: unknown) => unknown) => {
    handled = true;
    return then(ok, fail);
  };
  then(undefined, (error) => {
    if (isSessionExpiredError(error)) onExpired();
    setTimeout(() => { if (!handled) reportError(error); }, 0);
  });
  return promise;
}

export function useAuthedMutation(ref: any) {
  const { sessionToken, signOut } = useAuth();
  const name = functionName(ref);
  return useCallback((args: Record<string, any> = {}) => {
    if (!sessionToken) return watchUnhandled(Promise.reject(new Error('Please log in again.')), () => {});
    return watchUnhandled(callBackend(name, { ...args, sessionToken }, true), signOut);
  }, [name, sessionToken, signOut]);
}

export function useBackendAction(ref: any) {
  const name = functionName(ref);
  return useCallback((args: Record<string, any> = {}) => callBackend(name, args, true), [name]);
}

export const useAction = useBackendAction;
export function useMutation<T = any>(mutation: T) {
  return useAuthedMutation(mutation);
}
export function useQuery<T = any>(query: T, args: any): any {
  return useBackendQuery(query, args);
}
