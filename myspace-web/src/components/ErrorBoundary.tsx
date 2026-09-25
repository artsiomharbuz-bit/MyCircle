import { Component, type ReactNode } from 'react';
import { isSessionExpiredError, readableError } from '../lib/errors';

// Last line of defense — a failed render shows a plain message with a way
// back instead of a blank page (mirrors AppErrorBoundary in the app).
export class ErrorBoundary extends Component<
  { children: ReactNode; onSessionExpired: () => void },
  { error: unknown | null }
> {
  state = { error: null as unknown | null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.log('Screen error caught by boundary:', readableError(error));
  }

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    const expired = isSessionExpiredError(error);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-8 text-center">
        <h1 className="text-[20px] font-semibold">
          {expired ? 'Please log in again' : 'Something went wrong'}
        </h1>
        <p className="text-[15px] text-[var(--mc-text-muted)]">
          {expired ? 'Your session has expired.' : readableError(error)}
        </p>
        <button
          className="mt-3 h-12 px-8 rounded-[14px] font-semibold bg-[var(--mc-accent)] text-[var(--mc-accent-contrast)]"
          onClick={() => {
            if (expired) this.props.onSessionExpired();
            this.setState({ error: null });
          }}
        >
          {expired ? 'Log in' : 'Try again'}
        </button>
      </div>
    );
  }
}
