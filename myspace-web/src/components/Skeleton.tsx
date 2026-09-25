// Shimmering placeholder blocks for loading states. Prefer the shaped
// helpers below (PostCardSkeleton, RowSkeleton) over a bare "Loading…"
// string so the eventual layout is telegraphed while data streams in.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`mc-skeleton rounded-md ${className}`} />;
}

export function PostCardSkeleton() {
  return (
    <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] shadow-[var(--mc-shadow)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="px-4 pb-3 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      <Skeleton className="w-full h-72 rounded-none" />
      <div className="flex gap-2 px-4 py-3">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
      </div>
    </div>
  );
}

export function RowSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="w-11 h-11 rounded-full shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        {lines > 1 && <Skeleton className="h-3 w-1/2" />}
      </div>
    </div>
  );
}

export function RowSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <RowSkeleton key={i} />
      ))}
    </>
  );
}
