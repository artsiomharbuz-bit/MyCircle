import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../lib/auth';
import { BadgeCheck, Bookmark, MessageCircle, Send, Share2, Star } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { formatRelativeTime } from '../../../formatRelativeTime';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';

export type FeedPost = {
  _id: Id<'posts'>;
  _creationTime: number;
  title?: string;
  caption?: string;
  mediaType: 'photo' | 'video';
  mediaUrl: string | null;
  likeCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  commentCount: number;
  hashtags: string[];
  author: {
    _id: Id<'users'>;
    name?: string;
    username?: string;
    avatarUrl: string | null;
    avatarGradient?: string[];
    isVerified: boolean;
  } | null;
};

export function PostCard({ post }: { post: FeedPost }) {
  const { userId } = useAuth();
  const toggleLike = useMutation(api.likes.toggleLike);
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);

  const liked = optimisticLiked ?? post.isLiked;
  const saved = optimisticSaved ?? post.isBookmarked;

  const onLike = () => {
    if (!userId) return;
    setOptimisticLiked(!liked);
    toggleLike({ postId: post._id, userId }).catch(() => setOptimisticLiked(null));
  };

  const onSave = () => {
    if (!userId) return;
    setOptimisticSaved(!saved);
    toggleBookmark({ postId: post._id, userId }).catch(() => setOptimisticSaved(null));
  };

  return (
    <article className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] shadow-[var(--mc-shadow)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link to={`/profile/${post.author?._id}`}>
          <Avatar user={post.author} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to={`/profile/${post.author?._id}`}
            className="font-semibold text-[15px] hover:underline flex items-center gap-1"
          >
            {post.author?.name || post.author?.username || 'Unknown'}
            {post.author?.isVerified && (
              <BadgeCheck size={15} className="text-[var(--mc-accent)]" fill="currentColor" stroke="var(--mc-surface)" />
            )}
          </Link>
          <div className="text-[13px] text-[var(--mc-text-muted)]">
            {formatRelativeTime(post._creationTime)}
          </div>
        </div>
      </div>

      {(post.title || post.caption) && (
        <div className="px-4 pb-2 text-[15px] leading-snug whitespace-pre-wrap">
          {post.title && <p className="font-medium">{post.title}</p>}
          {post.caption && <p>{post.caption}</p>}
        </div>
      )}

      {post.mediaUrl && (
        <Link to={`/post/${post._id}`} className="block bg-black/5">
          {post.mediaType === 'video' ? (
            <video src={post.mediaUrl} controls className="w-full max-h-[600px] object-contain" />
          ) : (
            <img src={post.mediaUrl} alt="" className="w-full max-h-[600px] object-contain" />
          )}
        </Link>
      )}

      <div className="flex items-center justify-between px-4 py-2 text-[13px] text-[var(--mc-text-muted)]">
        <span>{post.likeCount > 0 && `${post.likeCount} like${post.likeCount === 1 ? '' : 's'}`}</span>
        <span>{post.commentCount > 0 && `${post.commentCount} comment${post.commentCount === 1 ? '' : 's'}`}</span>
      </div>

      <div className="flex border-t border-[var(--mc-border)] px-2 py-1">
        <button
          onClick={onLike}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-[14px] hover:bg-[var(--mc-nav-hover)] transition ${
            liked ? 'text-[var(--mc-accent)]' : 'text-[var(--mc-text-muted)]'
          }`}
        >
          <Star size={18} strokeWidth={2} fill={liked ? 'currentColor' : 'none'} />
          Like
        </button>
        <button
          onClick={() => setCommentsOpen((v) => !v)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-[14px] text-[var(--mc-text-muted)] hover:bg-[var(--mc-nav-hover)] transition"
        >
          <MessageCircle size={18} strokeWidth={2} />
          Comment
        </button>
        <Link
          to={`/post/${post._id}`}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-[14px] text-[var(--mc-text-muted)] hover:bg-[var(--mc-nav-hover)] transition"
        >
          <Share2 size={18} strokeWidth={2} />
          Share
        </Link>
        <button
          onClick={onSave}
          title="Save"
          className={`px-3 flex items-center justify-center rounded-lg hover:bg-[var(--mc-nav-hover)] transition ${
            saved ? 'text-[var(--mc-accent)]' : 'text-[var(--mc-text-muted)]'
          }`}
        >
          <Bookmark size={18} strokeWidth={2} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {commentsOpen && <CommentsSection postId={post._id} />}
    </article>
  );
}

function CommentsSection({ postId }: { postId: Id<'posts'> }) {
  const { userId, user } = useAuth();
  const comments = useQuery(api.comments.listComments, userId ? { postId, viewerId: userId } : 'skip');
  const addComment = useMutation(api.comments.addComment);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !text.trim()) return;
    setSending(true);
    try {
      await addComment({ postId, authorId: userId, text: text.trim() });
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-[var(--mc-border)] px-4 py-3 space-y-3">
      {comments === undefined && <p className="text-sm text-[var(--mc-text-muted)]">Loading comments…</p>}
      {comments?.length === 0 && <p className="text-sm text-[var(--mc-text-muted)]">No comments yet.</p>}
      {comments?.map((c) => (
        <div key={c._id} className="flex items-start gap-2">
          <Avatar user={c.author} size={28} />
          <div className="bg-[var(--mc-bg)] rounded-2xl px-3 py-1.5 text-[14px]">
            <span className="font-semibold mr-1">{c.author?.name || c.author?.username}</span>
            {c.text}
          </div>
        </div>
      ))}
      <form onSubmit={onSubmit} className="flex items-center gap-2 pt-1">
        <Avatar user={user} size={28} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          className="flex-1 bg-[var(--mc-bg)] rounded-full px-4 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="text-[var(--mc-accent)] disabled:opacity-40 shrink-0 p-1.5"
        >
          <Send size={18} strokeWidth={2.25} />
        </button>
      </form>
    </div>
  );
}
