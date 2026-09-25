import { useEffect, useRef } from 'react';
import { useAuthedMutation as useMutation } from '../lib/auth';
import { Megaphone } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';

export type FeedAd = {
  _id: Id<'ads'>;
  title?: string;
  caption?: string;
  mediaType: 'photo' | 'video';
  mediaUrl: string | null;
  displayName: string;
  displayAvatarUrl: string | null;
  displayAvatarGradient?: string[] | null;
  buttonText: string;
  buttonColor: string;
  link: string;
};

export function AdCard({ ad }: { ad: FeedAd }) {
  const { userId } = useAuth();
  const recordView = useMutation(api.ads.recordAdView);
  const recordClick = useMutation(api.ads.recordAdClick);
  const viewed = useRef(false);

  useEffect(() => {
    if (!userId || viewed.current) return;
    viewed.current = true;
    recordView({ adId: ad._id, userId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad._id, userId]);

  const onClickCta = () => {
    if (userId) recordClick({ adId: ad._id, userId });
  };

  return (
    <article className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] shadow-[var(--mc-shadow)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Avatar
          user={{ name: ad.displayName, avatarUrl: ad.displayAvatarUrl, avatarGradient: ad.displayAvatarGradient ?? undefined }}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[15px] truncate">{ad.displayName}</p>
          <div className="flex items-center gap-1 text-[12px] text-[var(--mc-text-muted)]">
            <Megaphone size={11} strokeWidth={2} />
            Sponsored
          </div>
        </div>
      </div>

      {(ad.title || ad.caption) && (
        <div className="px-4 pb-2 text-[15px] leading-snug whitespace-pre-wrap">
          {ad.title && <p className="font-medium">{ad.title}</p>}
          {ad.caption && <p>{ad.caption}</p>}
        </div>
      )}

      {ad.mediaUrl && (
        <div className="bg-black/5">
          {ad.mediaType === 'video' ? (
            <video src={ad.mediaUrl} controls className="w-full max-h-[600px] object-contain" />
          ) : (
            <img src={ad.mediaUrl} alt="" className="w-full max-h-[600px] object-contain" />
          )}
        </div>
      )}

      <div className="p-3">
        <a
          href={ad.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClickCta}
          className="block text-center text-white font-semibold text-[14px] rounded-lg py-2.5 transition"
          style={{ background: ad.buttonColor }}
        >
          {ad.buttonText}
        </a>
      </div>
    </article>
  );
}
