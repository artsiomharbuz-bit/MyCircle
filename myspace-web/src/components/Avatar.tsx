import { gradientPalette } from '../../../theme';

type AvatarUser = {
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  avatarGradient?: string[] | null;
};

// Deterministic pick from the app's curated gradient set so a given user
// without a saved avatarGradient always renders the same fallback color
// instead of a different random one on every render.
function fallbackGradient(key: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return gradientPalette[hash % gradientPalette.length];
}

export function Avatar({ user, size = 40 }: { user: AvatarUser | null | undefined; size?: number }) {
  const initial = (user?.name || user?.username || '?').trim().charAt(0).toUpperCase();
  const gradient =
    user?.avatarGradient?.length === 2
      ? user.avatarGradient
      : fallbackGradient(user?.name || user?.username || '?');

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name || user.username || 'avatar'}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
      }}
    >
      {initial}
    </div>
  );
}
