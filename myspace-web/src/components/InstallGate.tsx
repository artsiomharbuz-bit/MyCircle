import { Apple, PlayCircle } from 'lucide-react';
import { Logo } from './Logo';

export function InstallGate({
  children,
  title = 'Get the MyCircle app',
  subtitle = 'MyCircle is designed for your phone. Install the app to browse feeds, post, chat and more.',
}: {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--mc-bg)]">
      {children && <div className="flex-1 overflow-y-auto pb-4">{children}</div>}

      <div className="sticky bottom-0 left-0 right-0 bg-[var(--mc-surface)] border-t border-[var(--mc-border)] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-5 py-4 safe-bottom">
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <Logo size={44} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] leading-tight">{title}</p>
            <p className="text-[12px] text-[var(--mc-text-muted)] leading-tight mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-3 max-w-md mx-auto">
          <a
            href="https://apps.apple.com/"
            className="flex-1 flex items-center justify-center gap-1.5 bg-black text-white text-[14px] font-semibold rounded-lg py-2.5"
          >
            <Apple size={16} fill="currentColor" strokeWidth={0} />
            App Store
          </a>
          <a
            href="https://play.google.com/store"
            className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--mc-accent)] text-[var(--mc-accent-contrast)] text-[14px] font-semibold rounded-lg py-2.5"
          >
            <PlayCircle size={16} strokeWidth={2} />
            Google Play
          </a>
        </div>
      </div>
    </div>
  );
}
