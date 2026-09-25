import { useRef, useState } from 'react';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../lib/auth';
import { Globe2, ImagePlus, Star, X } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';

export function Composer({
  defaultAudience,
  onPosted,
}: {
  defaultAudience?: { audience: 'circles'; circleId: string; circleName: string };
  onPosted?: () => void;
}) {
  const { userId, user } = useAuth();
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
  const createPost = useMutation(api.posts.createPost);
  const myCircles = useQuery(api.userCircles.listMyCircles, userId ? { userId } : 'skip');
  const fileRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState(defaultAudience?.circleId ?? 'global');

  const pickFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const onSubmit = async () => {
    if (!userId || !file) return;
    setPosting(true);
    setError(null);
    try {
      const uploadUrl = await generateUploadUrl({ userId });
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const { storageId } = await res.json();
      const mediaType = file.type.startsWith('video') ? 'video' : 'photo';
      await createPost({
        authorId: userId,
        caption: caption.trim() || undefined,
        mediaStorageId: storageId,
        mediaType,
        audience: audience === 'global' ? 'global' : 'circles',
        circleIds: audience === 'global' ? undefined : [audience],
      });
      setCaption('');
      pickFile(null);
      onPosted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] shadow-[var(--mc-shadow)] p-4">
      <div className="flex items-start gap-3">
        <Avatar user={user} size={40} />
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={`What's on your mind, ${user?.name?.split(' ')[0] || 'there'}?`}
          rows={2}
          className="flex-1 resize-none bg-[var(--mc-bg)] rounded-2xl px-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
        />
      </div>

      {!defaultAudience && (
        <div className="flex items-center gap-1.5 mt-2 ml-13">
          {audience === 'global' ? (
            <Globe2 size={13} className="text-[var(--mc-text-muted)]" />
          ) : (
            <Star size={13} className="text-[var(--mc-text-muted)]" />
          )}
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="text-[13px] font-medium text-[var(--mc-text-muted)] bg-transparent outline-none"
          >
            <option value="global">Public</option>
            <option value="best-friends">Best Friends</option>
            {myCircles?.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {preview && (
        <div className="mt-3 relative rounded-lg overflow-hidden border border-[var(--mc-border)]">
          {file?.type.startsWith('video') ? (
            <video src={preview} className="w-full max-h-80 object-contain bg-black" controls />
          ) : (
            <img src={preview} className="w-full max-h-80 object-contain bg-black/5" />
          )}
          <button
            onClick={() => pickFile(null)}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {defaultAudience && (
        <p className="text-[12px] text-[var(--mc-text-muted)] mt-2 ml-13">
          Posting to <strong>{defaultAudience.circleName}</strong>
        </p>
      )}

      {error && <p className="text-sm text-[var(--mc-error-text)] mt-2">{error}</p>}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--mc-border)]">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 text-[14px] font-medium text-[var(--mc-text-muted)] hover:bg-[var(--mc-nav-hover)] rounded-lg px-3 py-2"
        >
          <ImagePlus size={18} strokeWidth={2} />
          Photo/Video
        </button>
        <button
          onClick={onSubmit}
          disabled={!file || posting}
          className="bg-[var(--mc-accent)] hover:bg-[var(--mc-accent-hover)] disabled:opacity-40 text-[var(--mc-accent-contrast)] font-semibold text-[14px] rounded-lg px-5 py-2 transition"
        >
          {posting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}
