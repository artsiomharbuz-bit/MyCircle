import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConvexProvider } from 'convex/react';
import './index.css';
import { App } from './App';
import { AuthProvider } from './lib/auth';
import { convex } from './lib/convexClient';
import { applyTheme, getThemeChoice } from './lib/theme';
import { ToastHost } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';

applyTheme(getThemeChoice());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary
            onSessionExpired={() => {
              localStorage.clear();
              window.location.assign('/login');
            }}
          >
            <App />
          </ErrorBoundary>
          <ToastHost />
        </BrowserRouter>
      </AuthProvider>
    </ConvexProvider>
  </StrictMode>
);
