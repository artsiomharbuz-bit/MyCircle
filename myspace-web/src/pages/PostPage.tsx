import { Link, useParams } from 'react-router-dom';
import { useAuthedQuery as useQuery } from '../lib/auth';
import { BadgeCheck, FileX } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { AppShell } from '../layout/AppShell';
import { PostCard } from '../components/PostCard';
import { PostCardSkeleton } from '../components/Skeleton';
import { InstallGate } from '../components/InstallGate';
import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { useIsMobile } from '../lib/useIsMobile';

function PublicPostPreview({ postId }: { postId: Id<'posts'> }) {
  const post = useQuery(api.posts.getPublicPost, { postId });

  if (post === undefined) {
    return (
      <div className="max-w-[520px] mx-auto pt-4">
        <PostCardSkeleton />
      </div>
    );
  }
  if (post === null) {
    return (
      <div className="text-center py-20 px-6">
        <FileX size={32} strokeWidth={1.5} className="mx-auto mb-3 text-[var(--mc-text-muted)] opacity-60" />
        <p className="text-lg font-semibold mb-1">This post isn't available</p>
        <p className="text-sm text-[var(--mc-text-muted)]">
          It may have expired, been removed, or is only shared with a circle.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[520px] mx-auto pt-4">
      <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar user={post.author} size={40} />
          <div className="min-w-0">
            <p className="font-semibold text-[15px] flex items-center gap-1 truncate">
              {post.author?.name || post.author?.username}
              {post.author?.isVerified && (
                <BadgeCheck size={15} className="text-[var(--mc-accent)]" fill="currentColor" stroke="var(--mc-surface)" />
              )}
            </p>
            {post.author?.username && (
              <p className="text-[13px] text-[var(--mc-text-muted)]">@{post.author.username}</p>
            )}
          </div>
        </div>
        {(post.title || post.caption) && (
          <div className="px-4 pb-2 text-[15px] whitespace-pre-wrap">
            {post.title && <p className="font-medium">{post.title}</p>}
            {post.caption && <p>{post.caption}</p>}
          </div>
        )}
        {post.mediaUrl &&
          (post.mediaType === 'video' ? (
            <video src={post.mediaUrl} controls className="w-full max-h-[70vh] object-contain bg-black" />
          ) : (
            <img src={post.mediaUrl} alt="" className="w-full max-h-[70vh] object-contain bg-black/5" />
          ))}
        <div className="flex items-center gap-4 px-4 py-3 text-[13px] text-[var(--mc-text-muted)]">
          <span>{post.likeCount} likes</span>
          <span>{post.commentCount} comments</span>
        </div>
      </div>
    </div>
  );
}

export function PostPage() {
  const { postId } = useParams<{ postId: string }>();
  const id = postId as Id<'posts'>;
  const isMobile = useIsMobile();
  const { userId } = useAuth();

  if (isMobile) {
    return (
      <InstallGate>
        <PublicPostPreview postId={id} />
      </InstallGate>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-[var(--mc-bg)]">
        <header className="h-16 bg-[var(--mc-surface)] border-b border-[var(--mc-border)] flex items-center px-6 justify-between">
          <Link to="/">
            <Logo />
          </Link>
          <Link
            to="/login"
            className="bg-[var(--mc-accent)] hover:bg-[var(--mc-accent-hover)] text-[var(--mc-accent-contrast)] font-semibold text-[14px] rounded-lg px-5 py-2.5 transition"
          >
            Log in
          </Link>
        </header>
        <PublicPostPreview postId={id} />
        <p className="text-center text-sm text-[var(--mc-text-muted)] pb-10">
          <Link to="/login" className="text-[var(--mc-accent)] font-medium">
            Log in
          </Link>{' '}
          to like, comment and see more on MyCircle.
        </p>
      </div>
    );
  }

  return <PostDetail postId={id} viewerId={userId} />;
}

function PostDetail({ postId, viewerId }: { postId: Id<'posts'>; viewerId: Id<'users'> }) {
  const post = useQuery(api.posts.getPost, { postId, viewerId });

  return (
    <AppShell>
      {post === undefined && <PostCardSkeleton />}
      {post === null && (
        <div className="text-center py-20 bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)]">
          <FileX size={32} strokeWidth={1.5} className="mx-auto mb-3 text-[var(--mc-text-muted)] opacity-60" />
          <p className="text-lg font-semibold mb-1">This post isn't available</p>
          <p className="text-sm text-[var(--mc-text-muted)]">
            It may have expired, been removed, or you don't have access.
          </p>
        </div>
      )}
      {post && <PostCard post={post} />}
    </AppShell>
  );
}
