import { Link, useNavigate } from 'react-router-dom';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../lib/auth';
import { ChevronRight, LogOut, Megaphone } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { AppShell } from '../layout/AppShell';
import { useAuth } from '../lib/auth';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition ${
        checked ? 'bg-[var(--mc-accent)]' : 'bg-[var(--mc-border)]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-[var(--mc-surface)] shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function SettingsPage() {
  const { userId, user, signOut } = useAuth();
  const navigate = useNavigate();
  const languages = useQuery(api.users.listCommonLanguages, {});
  const setLanguage = useMutation(api.users.setLanguage);
  const setDiscoverable = useMutation(api.users.setDiscoverable);
  const setHideAiContent = useMutation(api.users.setHideAiContent);

  if (!userId || !user) return null;

  return (
    <AppShell>
      <h1 className="text-xl font-bold px-1">Settings</h1>

      <section className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] divide-y divide-[var(--mc-border)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="font-medium text-[14px]">Discoverable</p>
            <p className="text-[13px] text-[var(--mc-text-muted)]">
              Show up in suggested friends and search.
            </p>
          </div>
          <Toggle
            checked={user.discoverable ?? true}
            onChange={(v) => setDiscoverable({ userId, discoverable: v })}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="font-medium text-[14px]">Hide AI-labeled content</p>
            <p className="text-[13px] text-[var(--mc-text-muted)]">
              Hide posts marked "Contains AI" from your feeds.
            </p>
          </div>
          <Toggle
            checked={user.hideAiContent ?? false}
            onChange={(v) => setHideAiContent({ userId, hideAiContent: v })}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="font-medium text-[14px]">Language</p>
            <p className="text-[13px] text-[var(--mc-text-muted)]">Used to personalize your feed.</p>
          </div>
          <select
            value={user.language ?? ''}
            onChange={(e) => setLanguage({ userId, language: e.target.value })}
            className="bg-[var(--mc-bg)] rounded-lg px-3 py-2 text-[14px] outline-none"
          >
            <option value="" disabled>
              Select…
            </option>
            {languages?.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <Link
        to="/ads"
        className="flex items-center gap-3 bg-[var(--mc-surface)] border border-[var(--mc-border)] rounded-xl px-4 py-3.5 hover:bg-[var(--mc-nav-hover)] transition"
      >
        <Megaphone size={18} strokeWidth={2} className="text-[var(--mc-text-muted)]" />
        <span className="flex-1 font-medium text-[14px]">Ads Manager</span>
        <ChevronRight size={18} className="text-[var(--mc-text-muted)]" />
      </Link>

      <button
        onClick={() => {
          signOut();
          navigate('/login');
        }}
        className="w-full flex items-center justify-center gap-2 bg-[var(--mc-surface)] border border-[var(--mc-border)] text-[var(--mc-red)] font-semibold text-[14px] rounded-xl py-3.5 hover:bg-[var(--mc-nav-hover)] transition"
      >
        <LogOut size={16} strokeWidth={2} />
        Log out
      </button>
    </AppShell>
  );
}
