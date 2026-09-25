import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthedQuery as useQuery } from '../lib/auth';
import {
  Bell,
  Bookmark,
  Clapperboard,
  Compass,
  Home,
  LogOut,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { Logo } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import { RowSkeletonList } from '../components/Skeleton';
import { useAuth } from '../lib/auth';

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/clips', label: 'Clips', icon: Clapperboard },
  { to: '/chats', label: 'Chats', icon: MessageCircle },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/saved', label: 'Saved', icon: Bookmark },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { userId, user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const following = useQuery(api.follows.getFollowingUsers, userId ? { userId } : 'skip');
  const unseenCount = useQuery(
    api.notifications.getUnseenNotificationCount,
    userId ? { userId } : 'skip'
  );
  const unreadMessages = useQuery(
    api.messages.getUnreadMessageCount,
    userId ? { userId } : 'skip'
  );

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 bg-[var(--mc-surface)] border-b border-[var(--mc-border)] sticky top-0 z-30">
        <div className="h-full max-w-[1600px] mx-auto px-4 flex items-center gap-4">
          <Link
            to="/"
            className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-[var(--mc-accent)] focus-visible:outline-offset-2"
          >
            <Logo />
          </Link>

          <form onSubmit={onSearch} className="flex-1 max-w-md">
            <div className="relative">
              <Search
                size={16}
                strokeWidth={2.25}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--mc-text-muted)]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search MyCircle"
                className="w-full bg-[var(--mc-bg)] rounded-full pl-10 pr-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-[var(--mc-accent)] transition"
              />
            </div>
          </form>

          <nav className="hidden lg:flex items-center gap-1 mx-auto">
            {NAV_ITEMS.slice(0, 5).map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`relative w-14 h-14 flex items-center justify-center rounded-lg transition ${
                    active
                      ? 'text-[var(--mc-text)] bg-[var(--mc-nav-hover)]'
                      : 'text-[var(--mc-text-muted)] hover:bg-[var(--mc-nav-hover)] hover:text-[var(--mc-text)]'
                  }`}
                  title={item.label}
                >
                  <item.icon size={24} strokeWidth={active ? 2.25 : 2} />
                  {((item.to === '/notifications' && !!unseenCount) ||
                    (item.to === '/chats' && !!unreadMessages)) && (
                    <span className="absolute top-2.5 right-3 w-2 h-2 rounded-full bg-[var(--mc-red)] ring-2 ring-[var(--mc-surface)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Link
              to="/friends"
              className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                isActive('/friends')
                  ? 'bg-[var(--mc-accent)] text-[var(--mc-accent-contrast)]'
                  : 'bg-[var(--mc-nav-hover)] text-[var(--mc-text)] hover:bg-[var(--mc-border)]'
              }`}
              title="Friends"
            >
              <UserRound size={20} strokeWidth={2} />
            </Link>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-full focus-visible:outline-2 focus-visible:outline-[var(--mc-accent)] focus-visible:outline-offset-2"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <Avatar user={user} size={36} />
              </button>
              {menuOpen && (
                <div
                  onMouseLeave={() => setMenuOpen(false)}
                  role="menu"
                  className="absolute right-0 mt-2 w-56 bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] shadow-[var(--mc-shadow)] py-2 z-40"
                >
                  <Link
                    to={`/profile/${userId}`}
                    className="block px-4 py-2 text-sm font-medium hover:bg-[var(--mc-nav-hover)] transition"
                    onClick={() => setMenuOpen(false)}
                  >
                    {user?.name || user?.username || 'Your profile'}
                  </Link>
                  <div className="my-1 border-t border-[var(--mc-border)]" />
                  <Link
                    to="/settings"
                    className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-[var(--mc-nav-hover)] transition"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings size={15} strokeWidth={2} className="text-[var(--mc-text-muted)]" />
                    Settings
                  </Link>
                  <Link
                    to="/friends?tab=suggestions"
                    className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-[var(--mc-nav-hover)] transition"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Sparkles size={15} strokeWidth={2} className="text-[var(--mc-text-muted)]" />
                    Suggestions
                  </Link>
                  <div className="my-1 border-t border-[var(--mc-border)]" />
                  <button
                    onClick={() => {
                      signOut();
                      setMenuOpen(false);
                      navigate('/login');
                    }}
                    className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm font-medium text-[var(--mc-red)] hover:bg-[var(--mc-red)]/10 transition"
                  >
                    <LogOut size={15} strokeWidth={2} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1600px] w-full mx-auto flex items-start gap-6 px-4 py-5">
        <aside className="hidden md:block w-64 shrink-0 sticky top-[84px] space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] transition ${
                  active
                    ? 'font-semibold bg-[var(--mc-nav-hover)] text-[var(--mc-text)]'
                    : 'font-medium text-[var(--mc-text)] hover:bg-[var(--mc-nav-hover)]'
                }`}
              >
                <item.icon
                  size={22}
                  strokeWidth={active ? 2.25 : 2}
                  className={active ? 'text-[var(--mc-text)]' : 'text-[var(--mc-text-muted)]'}
                />
                {item.label}
                {item.to === '/notifications' && !!unseenCount && (
                  <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-[var(--mc-red)] text-white text-[11px] font-semibold flex items-center justify-center">
                    {unseenCount > 9 ? '9+' : unseenCount}
                  </span>
                )}
                {item.to === '/chats' && !!unreadMessages && (
                  <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-[var(--mc-red)] text-white text-[11px] font-semibold flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            to={`/profile/${userId}`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] transition ${
              isActive(`/profile/${userId}`)
                ? 'font-semibold bg-[var(--mc-nav-hover)] text-[var(--mc-text)]'
                : 'font-medium text-[var(--mc-text)] hover:bg-[var(--mc-nav-hover)]'
            }`}
          >
            <Avatar user={user} size={28} />
            {user?.name || user?.username || 'Profile'}
          </Link>
        </aside>

        <main className="flex-1 min-w-0 max-w-[640px] mx-auto space-y-4 w-full">{children}</main>

        <aside className="hidden xl:block w-72 shrink-0 sticky top-[84px]">
          <h3 className="text-[15px] font-semibold text-[var(--mc-text-muted)] px-2 mb-2">Friends</h3>
          <div className="space-y-1">
            {following === undefined && <RowSkeletonList count={5} />}
            {following?.length === 0 && (
              <div className="text-center px-4 py-8 rounded-xl border border-dashed border-[var(--mc-border)]">
                <Users size={24} strokeWidth={1.5} className="mx-auto mb-2 text-[var(--mc-text-muted)] opacity-60" />
                <p className="text-sm text-[var(--mc-text-muted)]">
                  No friends yet.
                  <br />
                  Follow people to see them here.
                </p>
              </div>
            )}
            {following?.map((f) => (
              <Link
                key={f._id}
                to={`/profile/${f._id}`}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--mc-nav-hover)] transition"
              >
                <Avatar user={f} size={36} />
                <span className="text-sm font-medium truncate">{f.name || f.username}</span>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
