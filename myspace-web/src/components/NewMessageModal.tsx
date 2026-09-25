import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../lib/auth';
import { X } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';

export function NewMessageModal({ onClose }: { onClose: () => void }) {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const people = useQuery(api.follows.listFollowingForNewMessage, userId ? { userId } : 'skip');
  const createGroup = useMutation(api.groups.createGroup);

  const [selected, setSelected] = useState<Set<Id<'users'>>>(new Set());
  const [groupName, setGroupName] = useState('');

  const toggle = (id: Id<'users'>) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onStartGroup = async () => {
    if (!userId || selected.size === 0 || !groupName.trim()) return;
    const groupId = await createGroup({
      creatorId: userId,
      name: groupName.trim(),
      memberIds: [...selected],
    });
    onClose();
    navigate(`/groups/${groupId}`);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--mc-surface)] rounded-2xl border border-[var(--mc-border)] w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--mc-border)]">
          <h2 className="font-bold text-[16px]">New message</h2>
          <button onClick={onClose} className="text-[var(--mc-text-muted)]">
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {selected.size > 1 && (
          <div className="px-4 pt-3">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Name this group"
              className="w-full bg-[var(--mc-bg)] rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--mc-border)] mt-2">
          {people === undefined && (
            <p className="text-center text-[var(--mc-text-muted)] py-8 text-sm">Loading…</p>
          )}
          {people?.length === 0 && (
            <p className="text-center text-[var(--mc-text-muted)] py-8 text-sm">
              Follow people to start messaging them.
            </p>
          )}
          {people?.map((p) => (
            <button
              key={p._id}
              onClick={() => {
                if (selected.size === 0) {
                  onClose();
                  navigate(`/chats/${p._id}`);
                } else {
                  toggle(p._id);
                }
              }}
              onDoubleClick={() => toggle(p._id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--mc-nav-hover)] transition text-left"
            >
              <input
                type="checkbox"
                checked={selected.has(p._id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggle(p._id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
              />
              <Avatar user={p} size={36} />
              <span className="font-medium text-[14px] truncate">{p.name || p.username}</span>
            </button>
          ))}
        </div>

        {selected.size > 1 && (
          <div className="p-3 border-t border-[var(--mc-border)]">
            <button
              onClick={onStartGroup}
              disabled={!groupName.trim()}
              className="w-full bg-[var(--mc-accent)] hover:bg-[var(--mc-accent-hover)] disabled:opacity-40 text-[var(--mc-accent-contrast)] font-semibold text-[14px] rounded-lg py-2.5 transition"
            >
              Create group with {selected.size}
            </button>
          </div>
        )}
        {selected.size === 1 && (
          <div className="p-3 border-t border-[var(--mc-border)]">
            <button
              onClick={() => {
                onClose();
                navigate(`/chats/${[...selected][0]}`);
              }}
              className="w-full bg-[var(--mc-accent)] hover:bg-[var(--mc-accent-hover)] text-[var(--mc-accent-contrast)] font-semibold text-[14px] rounded-lg py-2.5 transition"
            >
              Message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
