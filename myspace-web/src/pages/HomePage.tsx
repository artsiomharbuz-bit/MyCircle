import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuthedQuery as useQuery } from '../lib/auth';
import { api } from '../../../convex/_generated/api';
import { AppShell } from '../layout/AppShell';
import { Composer } from '../components/Composer';
import { PostCard } from '../components/PostCard';
import { PostCardSkeleton } from '../components/Skeleton';
import { StoriesRow } from '../components/StoriesRow';
import { CircleTabs } from '../components/CircleTabs';
import { useAuth } from '../lib/auth';

export function HomePage() {
  const { userId } = useAuth();
  const [circleId, setCircleId] = useState('all');

  const myCircles = useQuery(api.userCircles.listMyCircles, userId ? { userId } : 'skip');
  const homeFeed = useQuery(
    api.posts.listHomeFeed,
    userId && circleId === 'all' ? { viewerId: userId } : 'skip'
  );
  const circleFeed = useQuery(
    api.posts.listCirclePosts,
    userId && circleId !== 'all' ? { viewerId: userId, circleId } : 'skip'
  );
  const feed = circleId === 'all' ? homeFeed : circleFeed;

  const circleName =
    circleId === 'best-friends'
      ? 'Best Friends'
      : myCircles?.find((c) => c._id === circleId)?.name ?? 'this circle';

  return (
    <AppShell>
      <StoriesRow />
      <CircleTabs selectedId={circleId} onSelect={setCircleId} />
      {circleId === 'all' ? (
        <Composer />
      ) : (
        <Composer defaultAudience={{ audience: 'circles', circleId, circleName }} />
      )}
      {feed === undefined && (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      )}
      {feed?.length === 0 && (
        <div className="text-center py-16 bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)]">
          <Sparkles size={32} strokeWidth={1.5} className="mx-auto mb-3 text-[var(--mc-text-muted)] opacity-60" />
          <p className="text-lg font-semibold mb-1">
            {circleId === 'all' ? 'Your feed is quiet.' : 'Nothing shared here yet.'}
          </p>
          {circleId === 'all' && (
            <p className="text-sm text-[var(--mc-text-muted)]">
              Follow people or post something to get things going.
            </p>
          )}
        </div>
      )}
      {feed?.map((post) => (
        <PostCard key={post._id} post={post} />
      ))}
    </AppShell>
  );
}
