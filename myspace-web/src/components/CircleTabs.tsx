import { useState } from 'react';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../lib/auth';
import { Plus, Star, UserPlus, X } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';

const CIRCLE_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

export type CircleTab = { id: string; label: string; color: string };

export function CircleTabs({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { userId } = useAuth();
  const myCircles = useQuery(api.userCircles.listMyCircles, userId ? { userId } : 'skip');
  const createCircle = useMutation(api.userCircles.createCircle);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CIRCLE_COLORS[0]);

  const tabs: CircleTab[] = [
    { id: 'all', label: 'All', color: 'var(--mc-red)' },
    { id: 'best-friends', label: 'Best Friends', color: '#f5c542' },
    ...(myCircles ?? []).map((c) => ({ id: c._id as string, label: c.name, color: c.color })),
  ];

  const selected = tabs.find((t) => t.id === selectedId);
  const isCustomCircle = selectedId !== 'all' && selectedId !== 'best-friends';

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !name.trim()) return;
    const circleId = await createCircle({ ownerId: userId, name: name.trim(), color });
    setName('');
    setCreating(false);
    onSelect(circleId as string);
  };

  return (
    <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] shadow-[var(--mc-shadow)] px-4 pt-3">
      <div className="flex items-center gap-5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className="relative pb-3 shrink-0 flex items-center gap-1 text-[14px] font-semibold whitespace-nowrap"
            style={{ color: tab.id === selectedId ? tab.color : 'var(--mc-text-muted)' }}
          >
            {tab.id === 'best-friends' && <Star size={13} fill="currentColor" strokeWidth={0} />}
            {tab.label}
            {tab.id === selectedId && (
              <span
                className="absolute left-0 right-0 -bottom-px h-[2.5px] rounded-full"
                style={{ background: tab.color }}
              />
            )}
          </button>
        ))}

        <button
          onClick={() => setCreating(true)}
          title="New circle"
          className="pb-3 shrink-0 text-[var(--mc-text-muted)]"
        >
          <Plus size={18} strokeWidth={2.25} />
        </button>

        {isCustomCircle && (
          <button
            onClick={() => setInviting(true)}
            title="Invite to circle"
            className="pb-3 shrink-0 text-[var(--mc-text-muted)] ml-auto"
          >
            <UserPlus size={18} strokeWidth={2.25} />
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={onCreate}
          className="border-t border-[var(--mc-border)] py-3 space-y-3"
        >
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Circle name"
              className="flex-1 bg-[var(--mc-bg)] rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
            />
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-[var(--mc-text-muted)] shrink-0"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {CIRCLE_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2 transition"
                style={{ background: c, borderColor: color === c ? 'var(--mc-text)' : 'transparent' }}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={!name.trim()}
            className="bg-[var(--mc-accent)] hover:bg-[var(--mc-accent-hover)] disabled:opacity-40 text-[var(--mc-accent-contrast)] font-semibold text-[13px] rounded-lg px-4 py-2 transition"
          >
            Create
          </button>
        </form>
      )}

      {inviting && isCustomCircle && (
        <InvitePanel circleId={selectedId as Id<'userCircles'>} onClose={() => setInviting(false)} />
      )}
    </div>
  );
}

function InvitePanel({ circleId, onClose }: { circleId: Id<'userCircles'>; onClose: () => void }) {
  const { userId } = useAuth();
  const members = useQuery(
    api.userCircles.listCircleMembers,
    userId ? { circleId, viewerId: userId } : 'skip'
  );
  const following = useQuery(api.follows.getFollowingUsers, userId ? { userId } : 'skip');
  const invite = useMutation(api.userCircles.inviteToCircle);

  const memberIds = new Set((members ?? []).map((m) => m._id));
  const invitable = (following ?? []).filter((f) => !memberIds.has(f._id));

  return (
    <div className="border-t border-[var(--mc-border)] py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-semibold text-[var(--mc-text-muted)]">Invite friends</p>
        <button onClick={onClose} className="text-[var(--mc-text-muted)]">
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      {invitable.length === 0 && (
        <p className="text-[13px] text-[var(--mc-text-muted)] pb-2">
          Everyone you follow is already in this circle.
        </p>
      )}
      <div className="space-y-1 max-h-52 overflow-y-auto">
        {invitable.map((f) => (
          <div key={f._id} className="flex items-center gap-3 py-1.5">
            <Avatar user={f} size={32} />
            <span className="flex-1 font-medium text-[13px] truncate">{f.name || f.username}</span>
            <button
              onClick={() => userId && invite({ circleId, inviterId: userId, inviteeId: f._id })}
              className="text-[12px] font-semibold text-[var(--mc-accent)]"
            >
              Invite
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
