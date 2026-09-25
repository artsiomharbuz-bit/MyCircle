import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAction } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '../../../convex/_generated/api';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const login = useAction(api.auth.login);
  const register = useAction(api.auth.register);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        const result = await login({ email, password });
        signIn(result.userId, result.sessionToken);
        navigate(result.onboardingComplete ? '/' : '/onboarding');
      } else {
        const result = await register({ email, password });
        signIn(result.userId, result.sessionToken);
        navigate('/onboarding');
      }
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--mc-bg)]">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[920px] grid md:grid-cols-2 gap-16 items-center">
          <div className="hidden md:block">
            <Logo size={40} />
            <h1 className="font-display text-[44px] leading-[1.05] mt-8 text-[var(--mc-text)]">
              Share moments
              <br />
              with your circles.
            </h1>
            <p className="text-lg text-[var(--mc-text-muted)] mt-4 max-w-sm">
              MyCircle on the web — post, browse and connect from your desktop, exactly like the
              app.
            </p>
            <div className="flex items-center gap-2 mt-10">
              <span className="w-8 h-1 rounded-full bg-[var(--mc-red)]" />
              <span className="w-2 h-1 rounded-full bg-[var(--mc-border)]" />
              <span className="w-2 h-1 rounded-full bg-[var(--mc-border)]" />
            </div>
          </div>

          <div className="bg-[var(--mc-surface)] rounded-2xl border border-[var(--mc-border)] shadow-[var(--mc-shadow)] p-8">
            <div className="md:hidden mb-8">
              <Logo size={40} />
            </div>
            <h2 className="text-xl font-bold mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-[var(--mc-text-muted)] mb-6">
              {mode === 'login'
                ? 'Log in to see what your circles are sharing.'
                : 'Join MyCircle to start sharing with your circles.'}
            </p>

            <div className="flex gap-1 mb-6 bg-[var(--mc-bg)] rounded-lg p-1">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                    mode === m
                      ? 'bg-[var(--mc-surface)] shadow text-[var(--mc-text)]'
                      : 'text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]'
                  }`}
                >
                  {m === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[var(--mc-bg)] rounded-lg px-4 py-3 text-[15px] outline-none ring-1 ring-transparent focus:ring-2 focus:ring-[var(--mc-accent)] transition"
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[var(--mc-bg)] rounded-lg px-4 py-3 text-[15px] outline-none ring-1 ring-transparent focus:ring-2 focus:ring-[var(--mc-accent)] transition"
                />
              </div>
              {error && (
                <p className="text-sm text-[var(--mc-error-text)] bg-[var(--mc-bg)] rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-[var(--mc-accent)] hover:bg-[var(--mc-accent-hover)] disabled:opacity-50 text-[var(--mc-accent-contrast)] font-semibold rounded-lg py-3 transition"
              >
                {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
