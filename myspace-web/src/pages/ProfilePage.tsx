import { useParams } from 'react-router-dom';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../lib/auth';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { UserX } from 'lucide-react';
import { AppShell } from '../layout/AppShell';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';
import { PostCardSkeleton, Skeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';

export function ProfilePage() {
  const { userId: profileId } = useParams<{ userId: string }>();
  const { userId: viewerId } = useAuth();
  const id = profileId as Id<'users'>;

  const profile = useQuery(api.users.getUser, viewerId ? { userId: id, viewerId } : 'skip');
  const posts = useQuery(api.posts.listPostsByAuthor, viewerId ? { authorId: id, viewerId } : 'skip');
  const counts = useQuery(api.follows.getFollowCounts, { userId: id });
  const isFriend = useQuery(
    api.follows.areFriends,
    viewerId && viewerId !== id ? { userA: viewerId, userB: id } : 'skip'
  );
  const follow = useMutation(api.follows.follow);
  const unfollow = useMutation(api.follows.unfollow);

  const isSelf = viewerId === id;

  if (profile === undefined) {
    return (
      <AppShell>
        <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] shadow-[var(--mc-shadow)] p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-20 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          </div>
        </div>
        <div className="space-y-4 pt-2">
          <PostCardSkeleton />
        </div>
      </AppShell>
    );
  }

  if (profile === null) {
    return (
      <AppShell>
        <div className="text-center py-20 bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)]">
          <UserX size={32} strokeWidth={1.5} className="mx-auto mb-3 text-[var(--mc-text-muted)] opacity-60" />
          <p className="text-lg font-semibold mb-1">This profile isn't available</p>
          <p className="text-sm text-[var(--mc-text-muted)]">It may have been removed or doesn't exist.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] shadow-[var(--mc-shadow)] p-6">
        <div className="flex items-center gap-4">
          <Avatar user={profile} size={80} />
          <div className="flex-1 min-w-0">
            <h1 className="text-[22px] font-bold truncate">{profile?.name || profile?.username}</h1>
            {profile?.username && (
              <p className="text-[var(--mc-text-muted)] text-sm">@{profile.username}</p>
            )}
            {counts && (
              <p className="text-sm text-[var(--mc-text-muted)] mt-1">
                <strong className="text-[var(--mc-text)]">{counts.followers}</strong> followers ·{' '}
                <strong className="text-[var(--mc-text)]">{counts.following}</strong> following
              </p>
            )}
          </div>
          {!isSelf && viewerId && (
            <button
              onClick={() =>
                isFriend
                  ? unfollow({ followerId: viewerId, followingId: id })
                  : follow({ followerId: viewerId, followingId: id })
              }
              className="bg-[var(--mc-accent)] hover:bg-[var(--mc-accent-hover)] text-[var(--mc-accent-contrast)] font-semibold text-[14px] rounded-lg px-5 py-2.5 transition"
            >
              {isFriend ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-2">
        {posts?.length === 0 && (
          <p className="text-center text-[var(--mc-text-muted)] py-10">No posts yet.</p>
        )}
        {posts?.map((post) => (
          <PostCard key={post._id} post={post} />
        ))}
      </div>
    </AppShell>
  );
}
