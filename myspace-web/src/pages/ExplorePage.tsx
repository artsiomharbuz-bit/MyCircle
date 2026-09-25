import { Compass } from 'lucide-react';
import { useAuthedQuery as useQuery } from '../lib/auth';
import { api } from '../../../convex/_generated/api';
import { AppShell } from '../layout/AppShell';
import { PostCard } from '../components/PostCard';
import { AdCard } from '../components/AdCard';
import { PostCardSkeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { interleaveAds } from '../../../interleaveAds';

export function ExplorePage() {
  const { userId } = useAuth();
  const feed = useQuery(api.posts.listExploreFeed, userId ? { viewerId: userId } : 'skip');
  const ads = useQuery(api.ads.listActiveAdsForSurface, userId ? { viewerId: userId, kind: 'post' } : 'skip');

  const entries = feed ? interleaveAds(feed, ads ?? []) : [];

  return (
    <AppShell>
      <h1 className="text-xl font-bold px-1">Explore</h1>
      {feed === undefined && (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      )}
      {feed?.length === 0 && (
        <div className="text-center py-16 bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)]">
          <Compass size={32} strokeWidth={1.5} className="mx-auto mb-3 text-[var(--mc-text-muted)] opacity-60" />
          <p className="font-semibold">Nothing to explore yet</p>
          <p className="text-sm text-[var(--mc-text-muted)] mt-1">Check back soon for new posts.</p>
        </div>
      )}
      {entries.map((entry) =>
        entry.kind === 'post' ? (
          <PostCard key={entry.item._id} post={entry.item} />
        ) : (
          <AdCard key={entry.item._id} ad={entry.item} />
        )
      )}
    </AppShell>
  );
}
