import { useAuthedQuery as useQuery } from '../lib/auth';
import { Bookmark } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { AppShell } from '../layout/AppShell';
import { PostCard } from '../components/PostCard';
import { PostCardSkeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';

export function SavedPage() {
  const { userId } = useAuth();
  const saved = useQuery(api.posts.listSavedPosts, userId ? { viewerId: userId } : 'skip');

  return (
    <AppShell>
      <h1 className="text-xl font-bold px-1">Saved</h1>
      {saved === undefined && (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      )}
      {saved?.length === 0 && (
        <div className="text-center text-[var(--mc-text-muted)] py-16 bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)]">
          <Bookmark size={32} strokeWidth={1.5} className="mx-auto mb-2 opacity-50" />
          <p className="font-medium">Nothing saved yet</p>
          <p className="text-sm">Posts you bookmark will show up here.</p>
        </div>
      )}
      {saved?.map((post) => (
        <PostCard key={post._id} post={post} />
      ))}
    </AppShell>
  );
}
