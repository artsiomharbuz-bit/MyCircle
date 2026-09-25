import { useRef, useState } from 'react';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../lib/auth';
import { Plus } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';
import { StoryRing } from './StoryRing';
import { StoryViewer } from './StoryViewer';

export function StoriesRow() {
  const { userId, user } = useAuth();
  const groups = useQuery(api.stories.listActiveStoriesForViewer, userId ? { viewerId: userId } : 'skip');
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
  const createStory = useMutation(api.stories.createStory);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewingAuthorId, setViewingAuthorId] = useState<Id<'users'> | null>(null);

  const myGroup = groups?.find((g) => g.author._id === userId);
  const others = groups?.filter((g) => g.author._id !== userId) ?? [];

  const onAddStory = () => fileRef.current?.click();

  const onFileSelected = async (file: File | null) => {
    if (!file || !userId) return;
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({ userId });
      const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      const { storageId } = await res.json();
      const mediaType = file.type.startsWith('video') ? 'video' : 'photo';
      await createStory({ authorId: userId, mediaStorageId: storageId, mediaType });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] shadow-[var(--mc-shadow)] p-4">
      <div className="flex items-center gap-4 overflow-x-auto">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={() => (myGroup ? setViewingAuthorId(userId as Id<'users'>) : onAddStory())}
          disabled={uploading}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div className="relative">
            <StoryRing hasStory={!!myGroup} size={56}>
              <Avatar user={user} size={56} />
            </StoryRing>
            <div
              onClick={(e) => {
                e.stopPropagation();
                onAddStory();
              }}
              className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[var(--mc-accent)] text-[var(--mc-accent-contrast)] flex items-center justify-center ring-2 ring-[var(--mc-surface)]"
            >
              <Plus size={12} strokeWidth={3} />
            </div>
          </div>
          <span className="text-[12px] font-medium text-[var(--mc-text-muted)]">
            {uploading ? 'Uploading…' : 'Your story'}
          </span>
        </button>

        {others.map((g) => (
          <button
            key={g.author._id}
            onClick={() => setViewingAuthorId(g.author._id)}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <StoryRing hasStory size={56}>
              <Avatar user={g.author} size={56} />
            </StoryRing>
            <span className="text-[12px] font-medium text-[var(--mc-text)] max-w-[64px] truncate">
              {g.author.name || g.author.username}
            </span>
          </button>
        ))}
      </div>

      {viewingAuthorId && (
        <StoryViewer authorId={viewingAuthorId} onClose={() => setViewingAuthorId(null)} />
      )}
    </div>
  );
}
