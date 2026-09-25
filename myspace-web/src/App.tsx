import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { useIsMobile } from './lib/useIsMobile';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { PostPage } from './pages/PostPage';
import { ProfilePage } from './pages/ProfilePage';
import { MobileLandingPage } from './pages/MobileLandingPage';
import { SavedPage } from './pages/SavedPage';
import { SearchPage } from './pages/SearchPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { FriendsPage } from './pages/FriendsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ClipsPage } from './pages/ClipsPage';
import { ChatsPage } from './pages/ChatsPage';
import { ChatThreadPage } from './pages/ChatThreadPage';
import { GroupThreadPage } from './pages/GroupThreadPage';
import { AdsManagerPage } from './pages/AdsManagerPage';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { userId, isLoading, user } = useAuth();
  if (isLoading) return null;
  if (!userId) return <Navigate to="/login" replace />;
  if (user && !user.onboardingComplete) return <Navigate to="/onboarding" replace />;
  return children;
}

export function App() {
  const isMobile = useIsMobile();
  const location = useLocation();

  // Mobile web is a thin "install the app" wall. The only thing a phone
  // browser can do here is preview a single shared post (handled inside
  // PostPage itself) — everything else, including auth and onboarding,
  // is desktop/app-only.
  const isSharedPostRoute = /^\/post\/[^/]+$/.test(location.pathname);
  if (isMobile && !isSharedPostRoute) {
    return <MobileLandingPage />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuthLoose>
            <OnboardingPage />
          </RequireAuthLoose>
        }
      />
      <Route path="/post/:postId" element={<PostPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/explore"
        element={
          <RequireAuth>
            <ExplorePage />
          </RequireAuth>
        }
      />
      <Route
        path="/profile/:userId"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/clips"
        element={
          <RequireAuth>
            <ClipsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/chats"
        element={
          <RequireAuth>
            <ChatsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/chats/:userId"
        element={
          <RequireAuth>
            <ChatThreadPage />
          </RequireAuth>
        }
      />
      <Route
        path="/notifications"
        element={
          <RequireAuth>
            <NotificationsPage />
          </RequireAuth>
        }
      />
      <Route path="/groups" element={<Navigate to="/chats" replace />} />
      <Route
        path="/groups/:groupId"
        element={
          <RequireAuth>
            <GroupThreadPage />
          </RequireAuth>
        }
      />
      <Route
        path="/saved"
        element={
          <RequireAuth>
            <SavedPage />
          </RequireAuth>
        }
      />
      <Route
        path="/friends"
        element={
          <RequireAuth>
            <FriendsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/search"
        element={
          <RequireAuth>
            <SearchPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/ads"
        element={
          <RequireAuth>
            <AdsManagerPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RequireAuthLoose({ children }: { children: React.ReactElement }) {
  const { userId, isLoading } = useAuth();
  if (isLoading) return null;
  if (!userId) return <Navigate to="/login" replace />;
  return children;
}
