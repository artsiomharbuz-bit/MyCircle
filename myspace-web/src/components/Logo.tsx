// The MyCircle mark (rounded logo) with the Unbounded wordmark.
export function Logo({ size = 32, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <img
        src="/logo.png"
        alt=""
        className="shrink-0"
        style={{ width: size, height: size, borderRadius: size * 0.24 }}
      />
      {wordmark && (
        <span className="font-brand text-[18px] text-[var(--mc-text)] hidden sm:inline">
          MyCircle
        </span>
      )}
    </div>
  );
}
