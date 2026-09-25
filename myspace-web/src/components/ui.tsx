import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { X, Check } from 'lucide-react';
import { subscribeToErrors } from '../lib/errors';

// ---------------------------------------------------------------------------
// Shared building blocks — the web equivalents of the app's PrimaryButton,
// TextField, FollowButton, ActionSheet/FormModal, toggles and empty states, so
// every screen uses the same shapes, radii and type as the phone.
// ---------------------------------------------------------------------------

type ButtonTone = 'primary' | 'secondary' | 'coral' | 'danger' | 'ghost';

const TONES: Record<ButtonTone, string> = {
  primary: 'bg-[var(--mc-accent)] text-[var(--mc-accent-contrast)] hover:bg-[var(--mc-accent-hover)]',
  secondary: 'bg-[var(--mc-secondary)] text-[var(--mc-text)] hover:brightness-95',
  coral: 'bg-[var(--mc-coral)] text-white hover:brightness-95',
  danger: 'bg-[var(--mc-red)] text-white hover:brightness-95',
  ghost: 'bg-transparent text-[var(--mc-text)] border border-[var(--mc-border)] hover:bg-[var(--mc-nav-hover)]',
};

export function Button({
  tone = 'primary',
  size = 'md',
  loading,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  // sm = the compact 32px profile/follow buttons; md = standard CTA.
  size?: 'sm' | 'md';
  loading?: boolean;
}) {
  const sizing = size === 'sm' ? 'h-8 px-3 text-[13px] rounded-lg' : 'h-12 px-5 text-[15px] rounded-[14px]';
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${sizing} ${TONES[tone]} ${className}`}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}

export function FollowButton({
  following,
  onClick,
  className = '',
  size = 'sm',
}: {
  following: boolean;
  onClick: () => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <Button
      size={size}
      tone={following ? 'secondary' : 'coral'}
      onClick={onClick}
      className={className}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}

export function TextField({
  error,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div>
      <input
        {...props}
        className={`w-full h-12 px-4 bg-[var(--mc-surface)] border ${
          error ? 'border-[var(--mc-red)]' : 'border-[var(--mc-border)]'
        } text-[15px] outline-none focus:border-[var(--mc-text)] placeholder:text-[var(--mc-text-muted)] ${className}`}
      />
      {error && <p className="text-[13px] text-[var(--mc-red)] mt-1.5">{error}</p>}
    </div>
  );
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-4 py-3 bg-[var(--mc-surface)] border border-[var(--mc-border)] text-[15px] outline-none focus:border-[var(--mc-text)] placeholder:text-[var(--mc-text-muted)] resize-none ${className}`}
    />
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`w-11 h-[26px] rounded-full p-[3px] transition shrink-0 ${
        checked ? 'bg-[var(--mc-accent)]' : 'bg-[var(--mc-secondary)]'
      }`}
    >
      <span
        className={`block w-5 h-5 rounded-full transition-transform ${
          checked ? 'translate-x-[18px] bg-[var(--mc-accent-contrast)]' : 'bg-white'
        }`}
      />
    </button>
  );
}

// Dark mode: white circle with a black tick; light mode: dark circle with a
// white tick (same rule as the app's VerifiedBadge).
export function VerifiedBadge({ verified, size = 16 }: { verified?: boolean; size?: number }) {
  if (!verified) return null;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0 ml-1 bg-[var(--mc-accent)] text-[var(--mc-accent-contrast)]"
      style={{ width: size, height: size }}
      title="Verified"
    >
      <Check size={size * 0.7} strokeWidth={3.5} />
    </span>
  );
}

export function EmptyState({
  icon,
  message,
  action,
}: {
  icon?: ReactNode;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-14 px-6">
      {icon && <div className="text-[var(--mc-text-muted)] opacity-70">{icon}</div>}
      <p className="text-[15px] text-[var(--mc-text-muted)]">{message}</p>
      {action}
    </div>
  );
}

// Card surface used everywhere a card sits on the page (posts, settings
// groups, list cards): Stone in light mode, warm charcoal in dark mode.
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`bg-[var(--mc-surface)] rounded-3xl ${className}`}>{children}</div>
  );
}

// Text-only tab switch with an underline (the app's Circles/Global switch,
// profile Posts/Clips switch).
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-6 ${className}`}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`py-1 text-[13px] font-semibold border-b-2 transition ${
            value === o.key
              ? 'text-[var(--mc-text)] border-[var(--mc-text)]'
              : 'text-[var(--mc-text-muted)] border-transparent'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal — a bottom sheet on narrow screens, a centered card on wide ones.
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[88vh] flex flex-col bg-[var(--mc-bg)] border border-[var(--mc-border)] rounded-t-[28px] sm:rounded-[28px] shadow-[var(--mc-shadow)]`}
      >
        <div className="sm:hidden mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-[var(--mc-secondary)]" />
        {(title || subtitle) && (
          <div className="flex items-start gap-3 px-6 pt-5 pb-3">
            <div className="flex-1 min-w-0">
              {title && <h2 className="text-[20px] font-semibold leading-tight">{title}</h2>}
              {subtitle && <p className="text-[13px] text-[var(--mc-text-muted)] mt-1">{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label="Close" className="p-1 text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]">
              <X size={22} />
            </button>
          </div>
        )}
        <div className="px-6 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 pb-6 pt-1">{footer}</div>}
      </div>
    </div>
  );
}

// A list of tappable rows in a Modal (the app's ActionSheet).
export function ActionList({
  actions,
}: {
  actions: { label: string; hint?: string; icon?: ReactNode; danger?: boolean; onClick: () => void }[];
}) {
  return (
    <div className="rounded-2xl bg-[var(--mc-surface)] border border-[var(--mc-border)] overflow-hidden">
      {actions.map((a, i) => (
        <button
          key={a.label}
          onClick={a.onClick}
          className={`w-full flex items-center gap-3 px-4 min-h-[56px] text-left hover:bg-[var(--mc-nav-hover)] transition ${
            i > 0 ? 'border-t border-[var(--mc-border)]' : ''
          } ${a.danger ? 'text-[var(--mc-red)]' : ''}`}
        >
          {a.icon && <span className="w-6 flex justify-center">{a.icon}</span>}
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-medium">{a.label}</span>
            {a.hint && <span className="block text-[12px] text-[var(--mc-text-muted)]">{a.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-[14px] text-[var(--mc-text-muted)] mb-5">{message}</p>
      <div className="flex gap-3">
        <Button tone="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          tone={danger ? 'danger' : 'primary'}
          className="flex-1"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onCancel();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Toasts + error boundary
// ---------------------------------------------------------------------------

const ToastContext = createContext(null);
export const useToastContext = () => useContext(ToastContext);

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () =>
      subscribeToErrors((m) => {
        setMessage(m);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setMessage(null), 3500);
      }),
    []
  );
  if (!message) return null;
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-[90vw] px-4 py-3 rounded-2xl bg-[var(--mc-bg)] border border-[var(--mc-border)] shadow-[var(--mc-shadow)] text-[14px] text-center">
      {message}
    </div>
  );
}

// Colored dot + circle name pill (the app's CircleLabel).
export function CircleLabel({
  circles,
}: {
  circles?: { id: string; name: string; color: string }[] | null;
}) {
  if (!circles || circles.length === 0) return null;
  const extra = circles.length - 1;
  return (
    <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full bg-[var(--mc-secondary)] text-[12px] font-semibold max-w-[200px]">
      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: circles[0].color }} />
      <span className="truncate">
        {circles[0].name}
        {extra > 0 ? ` +${extra}` : ''}
      </span>
    </span>
  );
}
