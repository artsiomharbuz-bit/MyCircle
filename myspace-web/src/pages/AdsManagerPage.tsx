import { useRef, useState } from 'react';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../lib/auth';
import { ConvexError } from 'convex/values';
import { ImagePlus, Megaphone } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { AppShell } from '../layout/AppShell';
import { Skeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { textToolColors } from '../../../theme';
import { AD_KIND_LABEL, adDailyPrice, adMonthlyPrice, formatUsd, type AdKind } from '../../../adPricing';

const CTA_COLORS = textToolColors.filter((c) => c !== '#ffffff' && c !== '#000000');

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'In review',
  approved: 'Approved — ready to pay',
  rejected: 'Rejected',
  active: 'Active',
  expired: 'Expired',
};
const STATUS_COLOR: Record<string, string> = {
  pending_review: '#f59e0b',
  approved: '#3b82f6',
  rejected: 'var(--mc-red)',
  active: '#16a34a',
  expired: 'var(--mc-text-muted)',
};

export function AdsManagerPage() {
  const { userId, user } = useAuth();
  const myAds = useQuery(api.ads.listMyAds, userId ? { creatorId: userId } : 'skip');
  const generateUploadUrl = useMutation(api.ads.generateUploadUrl);
  const createAd = useMutation(api.ads.createAd);
  const payAd = useMutation(api.ads.payAd);
  const fileRef = useRef<HTMLInputElement>(null);

  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<AdKind>('post');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [buttonText, setButtonText] = useState('Learn more');
  const [buttonColor, setButtonColor] = useState(CTA_COLORS[8] ?? CTA_COLORS[0]);
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !file) return;
    setSubmitting(true);
    setError(null);
    try {
      const uploadUrl = await generateUploadUrl({ userId });
      const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      const { storageId } = await res.json();
      await createAd({
        creatorId: userId,
        kind,
        caption: caption.trim() || undefined,
        mediaStorageId: storageId,
        mediaType: file.type.startsWith('video') ? 'video' : 'photo',
        link: link.trim(),
        buttonText: buttonText.trim(),
        buttonColor,
        displayName: displayName.trim() || user?.name || 'Advertiser',
      });
      setCreating(false);
      setCaption('');
      setLink('');
      pickFile(null);
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : 'Failed to create ad.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">Ads Manager</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--mc-accent-contrast)] bg-[var(--mc-accent)] hover:bg-[var(--mc-accent-hover)] rounded-lg px-3 py-2 transition"
        >
          <Megaphone size={15} strokeWidth={2.25} />
          New ad
        </button>
      </div>

      {creating && (
        <form
          onSubmit={onSubmit}
          className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] p-4 space-y-3"
        >
          <div className="flex gap-2">
            {(['post', 'clip'] as const).map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => setKind(k)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-semibold border transition ${
                  kind === k
                    ? 'bg-[var(--mc-accent)] text-[var(--mc-accent-contrast)] border-[var(--mc-accent)]'
                    : 'border-[var(--mc-border)] text-[var(--mc-text-muted)]'
                }`}
              >
                {AD_KIND_LABEL[k]} · {formatUsd(adDailyPrice(k))}/day
              </button>
            ))}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {preview ? (
            <div className="relative rounded-lg overflow-hidden border border-[var(--mc-border)]">
              {file?.type.startsWith('video') ? (
                <video src={preview} className="w-full max-h-64 object-contain bg-black" controls />
              ) : (
                <img src={preview} className="w-full max-h-64 object-contain bg-black/5" />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-[var(--mc-border)] rounded-lg py-8 text-[var(--mc-text-muted)] text-[14px]"
            >
              <ImagePlus size={18} strokeWidth={2} />
              Upload photo or video
            </button>
          )}

          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Advertiser display name"
            className="w-full bg-[var(--mc-bg)] rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
          />
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Ad caption"
            rows={2}
            className="w-full resize-none bg-[var(--mc-bg)] rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://your-link.com"
            className="w-full bg-[var(--mc-bg)] rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
          />
          <div className="flex items-center gap-2">
            <input
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder="Button text"
              className="flex-1 bg-[var(--mc-bg)] rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
            />
            <span
              className="px-3 py-2 rounded-lg text-white text-[13px] font-semibold shrink-0"
              style={{ background: buttonColor }}
            >
              {buttonText || 'Button'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {CTA_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setButtonColor(c)}
                className="w-6 h-6 rounded-full border-2"
                style={{ background: c, borderColor: buttonColor === c ? 'var(--mc-text)' : 'transparent' }}
              />
            ))}
          </div>

          {error && <p className="text-[13px] text-[var(--mc-error-text)]">{error}</p>}

          <button
            type="submit"
            disabled={!file || !link.trim() || !buttonText.trim() || submitting}
            className="bg-[var(--mc-accent)] hover:bg-[var(--mc-accent-hover)] disabled:opacity-40 text-[var(--mc-accent-contrast)] font-semibold text-[14px] rounded-lg px-4 py-2.5 transition"
          >
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
          <p className="text-[12px] text-[var(--mc-text-muted)]">
            Every ad is reviewed before it can go live. Once approved, pay to activate it.
          </p>
        </form>
      )}

      <div className="space-y-3">
        {myAds === undefined && (
          <>
            <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] p-4 flex gap-3">
              <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </>
        )}
        {myAds?.length === 0 && (
          <div className="text-center text-[var(--mc-text-muted)] py-16 bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)]">
            <Megaphone size={32} strokeWidth={1.5} className="mx-auto mb-2 opacity-50" />
            <p className="font-medium">No ads yet</p>
          </div>
        )}
        {myAds?.map((ad) => (
          <div
            key={ad._id}
            className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] p-4 flex gap-3"
          >
            {ad.mediaUrl && (
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-black/5 shrink-0">
                {ad.mediaType === 'video' ? (
                  <video src={ad.mediaUrl} className="w-full h-full object-cover" />
                ) : (
                  <img src={ad.mediaUrl} className="w-full h-full object-cover" alt="" />
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                  style={{ background: STATUS_COLOR[ad.status] }}
                >
                  {STATUS_LABEL[ad.status] ?? ad.status}
                </span>
                <span className="text-[12px] text-[var(--mc-text-muted)]">{AD_KIND_LABEL[ad.kind]}</span>
              </div>
              <p className="font-medium text-[14px] mt-1 truncate">{ad.caption || ad.title || 'Untitled ad'}</p>
              {ad.status === 'rejected' && ad.rejectionReason && (
                <p className="text-[12px] text-[var(--mc-error-text)] mt-0.5">{ad.rejectionReason}</p>
              )}
              <p className="text-[12px] text-[var(--mc-text-muted)] mt-0.5">
                {ad.views} views · {ad.clicks} clicks
              </p>
              {(ad.status === 'approved' || ad.status === 'expired') && userId && (
                <div className="flex gap-2 mt-2">
                  <PayButton adId={ad._id} kind={ad.kind} plan="daily" userId={userId} payAd={payAd} />
                  <PayButton adId={ad._id} kind={ad.kind} plan="monthly" userId={userId} payAd={payAd} />
                </div>
              )}
              {ad.status === 'active' && ad.activeUntil && (
                <p className="text-[12px] text-[var(--mc-text-muted)] mt-1">
                  Active until {new Date(ad.activeUntil).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function PayButton({
  adId,
  kind,
  plan,
  userId,
  payAd,
}: {
  adId: Id<'ads'>;
  kind: AdKind;
  plan: 'daily' | 'monthly';
  userId: Id<'users'>;
  payAd: ReturnType<typeof useMutation<typeof api.ads.payAd>>;
}) {
  const [paying, setPaying] = useState(false);
  const price = plan === 'daily' ? adDailyPrice(kind) : adMonthlyPrice(kind);

  return (
    <button
      onClick={async () => {
        setPaying(true);
        try {
          await payAd({ adId, creatorId: userId, plan });
        } finally {
          setPaying(false);
        }
      }}
      disabled={paying}
      className="text-[12px] font-semibold border border-[var(--mc-border)] rounded-lg px-3 py-1.5 hover:bg-[var(--mc-nav-hover)] transition disabled:opacity-40"
    >
      Pay {formatUsd(price)} ({plan})
    </button>
  );
}
