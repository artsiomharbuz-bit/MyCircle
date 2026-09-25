import { useEffect, useState } from 'react';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../lib/auth';
import { Heart, X } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';
import { formatRelativeTime } from '../../../formatRelativeTime';

const STORY_DURATION_MS = 5000;

export function StoryViewer({ authorId, onClose }: { authorId: Id<'users'>; onClose: () => void }) {
  const { userId } = useAuth();
  const author = useQuery(api.users.getUser, userId ? { userId: authorId, viewerId: userId } : 'skip');
  const stories = useQuery(
    api.stories.getStoriesByAuthor,
    userId ? { authorId, viewerId: userId } : 'skip'
  );
  const toggleLike = useMutation(api.stories.toggleStoryLike);

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const current = stories?.[index];

  useEffect(() => {
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (!current || paused) return;
    const start = Date.now() - progress * STORY_DURATION_MS;
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(1, elapsed / STORY_DURATION_MS);
      setProgress(pct);
      if (pct >= 1) {
        clearInterval(tick);
        goNext();
      }
    }, 50);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?._id, paused]);

  const goNext = () => {
    if (!stories) return;
    if (index < stories.length - 1) setIndex(index + 1);
    else onClose();
  };
  const goPrev = () => {
    if (index > 0) setIndex(index - 1);
  };

  if (!stories || stories.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="relative w-full max-w-[420px] h-full max-h-[90vh] bg-black rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
          {stories.map((s, i) => (
            <div key={s._id} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white"
                style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
              />
            </div>
          ))}
        </div>

        <div className="absolute top-6 left-3 right-3 flex items-center gap-2 z-10">
          <Avatar user={author} size={32} />
          <span className="text-white font-semibold text-[14px]">{author?.name || author?.username}</span>
          <span className="text-white/70 text-[12px]">{formatRelativeTime(current?._creationTime ?? 0)}</span>
          <button onClick={onClose} className="ml-auto text-white">
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        {current && (
          <div className="w-full h-full flex items-center justify-center">
            {current.mediaType === 'video' ? (
              <video
                src={current.mediaUrl ?? undefined}
                autoPlay
                className="max-w-full max-h-full"
                onPlay={() => setPaused(false)}
                onPause={() => setPaused(true)}
              />
            ) : (
              <img src={current.mediaUrl ?? undefined} alt="" className="max-w-full max-h-full object-contain" />
            )}
          </div>
        )}

        <button
          className="absolute left-0 top-0 w-1/3 h-full"
          onClick={goPrev}
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
        />
        <button
          className="absolute right-0 top-0 w-1/3 h-full"
          onClick={goNext}
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
        />

        {current && userId && (
          <button
            onClick={() => toggleLike({ storyId: current._id, userId })}
            className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 bg-black/40 rounded-full px-3 py-2"
          >
            <Heart
              size={18}
              className="text-white"
              fill={current.isLiked ? 'white' : 'none'}
              strokeWidth={2}
            />
            {current.likeCount > 0 && <span className="text-white text-[13px]">{current.likeCount}</span>}
          </button>
        )}
      </div>
    </div>
  );
}
