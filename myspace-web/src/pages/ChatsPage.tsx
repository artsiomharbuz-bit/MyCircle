import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthedQuery as useQuery } from '../lib/auth';
import { MessageCircle, SquarePen } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { AppShell } from '../layout/AppShell';
import { Avatar } from '../components/Avatar';
import { GroupAvatars } from '../components/GroupAvatars';
import { RowSkeletonList } from '../components/Skeleton';
import { formatRelativeTime } from '../../../formatRelativeTime';
import { useAuth } from '../lib/auth';
import { NewMessageModal } from '../components/NewMessageModal';

export function ChatsPage() {
  const { userId } = useAuth();
  const conversations = useQuery(api.messages.listConversations, userId ? { userId } : 'skip');
  const groups = useQuery(api.groups.listMyGroups, userId ? { userId } : 'skip');
  const [composing, setComposing] = useState(false);

  const items = [
    ...(conversations ?? []).map((c) => ({ type: 'dm' as const, ...c })),
    ...(groups ?? []).map((g) => ({ type: 'group' as const, ...g })),
  ].sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  return (
    <AppShell>
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">Chats</h1>
        <button
          onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--mc-accent-contrast)] bg-[var(--mc-accent)] hover:bg-[var(--mc-accent-hover)] rounded-lg px-3 py-2 transition"
        >
          <SquarePen size={15} strokeWidth={2.25} />
          New message
        </button>
      </div>

      <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] divide-y divide-[var(--mc-border)] overflow-hidden">
        {conversations === undefined && groups === undefined && <RowSkeletonList count={5} />}
        {items.length === 0 && conversations !== undefined && groups !== undefined && (
          <div className="text-center text-[var(--mc-text-muted)] py-16">
            <MessageCircle size={32} strokeWidth={1.5} className="mx-auto mb-2 opacity-50" />
            <p className="font-medium">No messages yet</p>
            <p className="text-sm">Start a conversation with someone you follow.</p>
          </div>
        )}
        {items.map((item) =>
          item.type === 'dm' ? (
            <Link
              key={item.otherUser._id}
              to={`/chats/${item.otherUser._id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--mc-nav-hover)] transition"
            >
              <Avatar user={item.otherUser} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[14px] truncate">
                  {item.otherUser.name || item.otherUser.username}
                </p>
                <p className="text-[13px] text-[var(--mc-text-muted)] truncate">
                  {item.lastMessageIsMine ? 'You: ' : ''}
                  {item.lastMessage}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[12px] text-[var(--mc-text-muted)]">
                  {formatRelativeTime(item.lastMessageAt)}
                </span>
                {item.unreadCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--mc-accent)] text-[var(--mc-accent-contrast)] text-[10px] font-semibold flex items-center justify-center">
                    {item.unreadCount}
                  </span>
                )}
              </div>
            </Link>
          ) : (
            <Link
              key={item._id}
              to={`/groups/${item._id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--mc-nav-hover)] transition"
            >
              <GroupAvatars users={item.members} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[14px] truncate">{item.name}</p>
                <p className="text-[13px] text-[var(--mc-text-muted)] truncate">
                  {item.lastMessageIsMine ? 'You: ' : ''}
                  {item.lastMessage ?? 'No messages yet'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[12px] text-[var(--mc-text-muted)]">
                  {formatRelativeTime(item.lastMessageAt)}
                </span>
                {item.unreadCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--mc-accent)] text-[var(--mc-accent-contrast)] text-[10px] font-semibold flex items-center justify-center">
                    {item.unreadCount}
                  </span>
                )}
              </div>
            </Link>
          )
        )}
      </div>

      {composing && <NewMessageModal onClose={() => setComposing(false)} />}
    </AppShell>
  );
}
