import { Clapperboard, MessageCircle, Users2 } from 'lucide-react';
import { InstallGate } from '../components/InstallGate';

const FEATURES = [
  { icon: Users2, label: 'Circles', desc: 'Share with just the people who matter.' },
  { icon: Clapperboard, label: 'Clips', desc: 'Quick videos from people you follow.' },
  { icon: MessageCircle, label: 'Chats', desc: 'Message friends and groups in real time.' },
];

export function MobileLandingPage() {
  return (
    <InstallGate
      title="MyCircle lives on your phone"
      subtitle="The full experience — feeds, circles, clips, chats — is in the app."
    >
      <div className="flex flex-col items-center text-center px-8 pt-16 pb-8">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
          style={{ background: 'linear-gradient(135deg, var(--mc-red), #ff6b52)' }}
        >
          <span className="font-display text-white text-4xl">m</span>
        </div>
        <h1 className="font-display text-[34px] leading-[1.05] text-[var(--mc-text)]">MyCircle</h1>
        <p className="text-[var(--mc-text-muted)] mt-3 max-w-xs">
          Share moments with your circles. Download the app to post, browse and chat.
        </p>

        <div className="w-full max-w-xs mt-10 space-y-4 text-left">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--mc-surface)] border border-[var(--mc-border)] flex items-center justify-center shrink-0">
                <f.icon size={17} strokeWidth={2} className="text-[var(--mc-text)]" />
              </div>
              <div>
                <p className="font-semibold text-sm">{f.label}</p>
                <p className="text-[13px] text-[var(--mc-text-muted)]">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </InstallGate>
  );
}
