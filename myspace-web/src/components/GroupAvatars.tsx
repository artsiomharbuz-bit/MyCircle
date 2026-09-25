import { Users } from 'lucide-react';
import { Avatar } from './Avatar';

type Member = { _id: string; name?: string; username?: string; avatarUrl: string | null; avatarGradient?: string[] };

export function GroupAvatars({ users, size = 44 }: { users: Member[]; size?: number }) {
  if (users.length === 0) {
    return (
      <div
        className="rounded-full bg-[var(--mc-bg)] flex items-center justify-center shrink-0 text-[var(--mc-text-muted)]"
        style={{ width: size, height: size }}
      >
        <Users size={size * 0.45} strokeWidth={1.75} />
      </div>
    );
  }
  const shown = users.slice(0, 2);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {shown.map((u, i) => (
        <div
          key={u._id}
          className="absolute rounded-full ring-2 ring-[var(--mc-surface)]"
          style={{
            width: size * 0.7,
            height: size * 0.7,
            left: i === 0 ? 0 : size * 0.3,
            top: i === 0 ? 0 : size * 0.3,
          }}
        >
          <Avatar user={u} size={size * 0.7} />
        </div>
      ))}
    </div>
  );
}
