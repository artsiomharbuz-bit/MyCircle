import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthedMutation as useMutation } from '../lib/auth';
import { ConvexError } from 'convex/values';
import { api } from '../../../convex/_generated/api';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { gradientPalette as GRADIENTS } from '../../../theme';

export function OnboardingPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const completeOnboarding = useMutation(api.users.completeOnboarding);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [gradient, setGradient] = useState(GRADIENTS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setBusy(true);
    try {
      await completeOnboarding({
        userId,
        name: name.trim(),
        username: username.trim().toLowerCase(),
        dateOfBirth: dob,
        avatarGradient: gradient,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--mc-bg)] px-4">
      <div className="w-full max-w-[420px] bg-[var(--mc-surface)] rounded-2xl border border-[var(--mc-border)] shadow-[var(--mc-shadow)] p-8">
        <Logo size={44} />
        <h1 className="text-[22px] font-bold mt-5">Finish setting up your profile</h1>
        <form onSubmit={onSubmit} className="space-y-3 mt-5">
          <input
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[var(--mc-bg)] rounded-lg px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
          />
          <input
            required
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-z0-9_.]/gi, ''))}
            className="w-full bg-[var(--mc-bg)] rounded-lg px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
          />
          <input
            required
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full bg-[var(--mc-bg)] rounded-lg px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
          />
          <div className="flex items-center gap-2 flex-wrap">
            {GRADIENTS.map((g) => (
              <button
                type="button"
                key={g[0]}
                onClick={() => setGradient(g)}
                className="w-9 h-9 rounded-full border-2 transition"
                style={{
                  background: `linear-gradient(135deg, ${g[0]}, ${g[1]})`,
                  borderColor: gradient[0] === g[0] ? 'var(--mc-text)' : 'transparent',
                }}
              />
            ))}
          </div>
          {error && <p className="text-[13px] text-[var(--mc-error-text)]">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[var(--mc-accent)] hover:bg-[var(--mc-accent-hover)] disabled:opacity-50 text-[var(--mc-accent-contrast)] font-semibold rounded-lg py-3 transition"
          >
            {busy ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
