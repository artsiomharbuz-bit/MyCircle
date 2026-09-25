import { useAuthedQuery as useQuery } from '../lib/auth';
import { Clapperboard } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { AppShell } from '../layout/AppShell';
import { PostCard } from '../components/PostCard';
import { AdCard } from '../components/AdCard';
import { PostCardSkeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { interleaveAds } from '../../../interleaveAds';

export function ClipsPage() {
  const { userId } = useAuth();
  const clips = useQuery(api.posts.listClips, userId ? { viewerId: userId } : 'skip');
  const ads = useQuery(api.ads.listActiveAdsForSurface, userId ? { viewerId: userId, kind: 'clip' } : 'skip');

  const entries = clips ? interleaveAds(clips, ads ?? []) : [];

  return (
    <AppShell>
      <h1 className="text-xl font-bold px-1">Clips</h1>
      {clips === undefined && (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      )}
      {clips?.length === 0 && (
        <div className="text-center text-[var(--mc-text-muted)] py-16 bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)]">
          <Clapperboard size={32} strokeWidth={1.5} className="mx-auto mb-2 opacity-50" />
          <p className="font-medium">No clips yet</p>
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
