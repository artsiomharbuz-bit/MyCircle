import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../lib/auth';
import { ArrowLeft, Send } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { AppShell } from '../layout/AppShell';
import { Avatar } from '../components/Avatar';
import { formatRelativeTime } from '../../../formatRelativeTime';
import { useAuth } from '../lib/auth';

export function ChatThreadPage() {
  const { userId: otherUserId } = useParams<{ userId: string }>();
  const { userId } = useAuth();
  const otherId = otherUserId as Id<'users'>;

  const other = useQuery(api.users.getUser, userId ? { userId: otherId, viewerId: userId } : 'skip');
  const messages = useQuery(
    api.messages.listMessages,
    userId ? { userId, otherUserId: otherId } : 'skip'
  );
  const sendMessage = useMutation(api.messages.sendMessage);
  const markRead = useMutation(api.messages.markRead);

  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userId) markRead({ userId, otherUserId: otherId });
  }, [userId, otherId, markRead, messages?.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length]);

  const onSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !text.trim()) return;
    sendMessage({ senderId: userId, recipientId: otherId, text: text.trim() });
    setText('');
  };

  return (
    <AppShell>
      <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] flex flex-col h-[75vh]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--mc-border)]">
          <Link to="/chats" className="text-[var(--mc-text-muted)] lg:hidden">
            <ArrowLeft size={20} strokeWidth={2} />
          </Link>
          <Avatar user={other} size={36} />
          <Link to={`/profile/${otherId}`} className="font-semibold text-[14px] hover:underline">
            {other?.name || other?.username}
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages === undefined && (
            <p className="text-center text-[var(--mc-text-muted)] text-sm py-8">Loading…</p>
          )}
          {messages?.map((m) => (
            <div key={m._id} className={`flex ${m.isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-[14px] ${
                  m.isMine
                    ? 'bg-[var(--mc-accent)] text-[var(--mc-accent-contrast)] rounded-br-sm'
                    : 'bg-[var(--mc-bg)] text-[var(--mc-text)] rounded-bl-sm'
                }`}
              >
                {m.text}
                <div
                  className={`text-[10px] mt-0.5 ${m.isMine ? 'text-[var(--mc-accent-contrast)] opacity-70' : 'text-[var(--mc-text-muted)]'}`}
                >
                  {formatRelativeTime(m._creationTime)}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={onSend} className="flex items-center gap-2 px-4 py-3 border-t border-[var(--mc-border)]">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message…"
            className="flex-1 bg-[var(--mc-bg)] rounded-full px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="text-[var(--mc-accent)] disabled:opacity-40 p-2"
          >
            <Send size={20} strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </AppShell>
  );
}
