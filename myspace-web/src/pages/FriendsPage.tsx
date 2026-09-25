import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../lib/auth';
import { Users } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { AppShell } from '../layout/AppShell';
import { Avatar } from '../components/Avatar';
import { RowSkeletonList } from '../components/Skeleton';
import { useAuth } from '../lib/auth';

type FriendsTab = 'following' | 'followers' | 'suggestions';

export function FriendsPage() {
  const { userId } = useAuth();
  const [params] = useSearchParams();
  const initialTab = params.get('tab');
  const [tab, setTab] = useState<FriendsTab>(
    initialTab === 'followers' || initialTab === 'suggestions' ? initialTab : 'following'
  );

  const following = useQuery(api.follows.getFollowingUsers, userId ? { userId } : 'skip');
  const followers = useQuery(api.follows.getFollowers, userId ? { userId } : 'skip');
  const suggestions = useQuery(api.follows.getFriendSuggestions, userId ? { userId } : 'skip');
  const follow = useMutation(api.follows.follow);
  const unfollow = useMutation(api.follows.unfollow);

  const followingIds = new Set((following ?? []).map((f) => f._id));

  const list = tab === 'following' ? following : tab === 'followers' ? followers : suggestions;

  return (
    <AppShell>
      <h1 className="text-xl font-bold px-1">Friends</h1>

      <div className="flex gap-1 bg-[var(--mc-surface)] border border-[var(--mc-border)] rounded-lg p-1">
        {(['following', 'followers', 'suggestions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-md text-[13px] font-semibold capitalize transition ${
              tab === t ? 'bg-[var(--mc-accent)] text-[var(--mc-accent-contrast)]' : 'text-[var(--mc-text-muted)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] divide-y divide-[var(--mc-border)] overflow-hidden">
        {list === undefined && <RowSkeletonList count={5} />}
        {list?.length === 0 && (
          <div className="text-center text-[var(--mc-text-muted)] py-16">
            <Users size={32} strokeWidth={1.5} className="mx-auto mb-2 opacity-50" />
            <p className="font-medium">Nobody here yet</p>
          </div>
        )}
        {list?.map(
          (u) =>
            u && (
              <div key={u._id} className="flex items-center gap-3 px-4 py-3">
                <Link to={`/profile/${u._id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar user={u} size={44} />
                  <div className="min-w-0">
                    <p className="font-semibold text-[14px] truncate">{u.name || u.username}</p>
                    {u.username && <p className="text-[13px] text-[var(--mc-text-muted)]">@{u.username}</p>}
                  </div>
                </Link>
                {userId && u._id !== userId && (
                  <button
                    onClick={() =>
                      followingIds.has(u._id)
                        ? unfollow({ followerId: userId, followingId: u._id })
                        : follow({ followerId: userId, followingId: u._id })
                    }
                    className={`shrink-0 text-[13px] font-semibold rounded-lg px-4 py-2 transition ${
                      followingIds.has(u._id)
                        ? 'bg-[var(--mc-bg)] text-[var(--mc-text)]'
                        : 'bg-[var(--mc-accent)] text-[var(--mc-accent-contrast)] hover:bg-[var(--mc-accent-hover)]'
                    }`}
                  >
                    {followingIds.has(u._id) ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            )
        )}
      </div>
    </AppShell>
  );
}
