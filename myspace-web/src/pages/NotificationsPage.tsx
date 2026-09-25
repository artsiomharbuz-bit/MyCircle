import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../lib/auth';
import { AlertTriangle, Bell, Heart, MessageCircle, ShieldAlert, UserPlus } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { AppShell } from '../layout/AppShell';
import { Avatar } from '../components/Avatar';
import { RowSkeletonList } from '../components/Skeleton';
import { formatRelativeTime } from '../../../formatRelativeTime';
import { useAuth } from '../lib/auth';

export function NotificationsPage() {
  const { userId } = useAuth();
  const notifications = useQuery(api.notifications.listNotifications, userId ? { userId } : 'skip');
  const clear = useMutation(api.notifications.clearNotifications);
  const markSeen = useMutation(api.notifications.markNotificationsSeen);

  useEffect(() => {
    if (userId) markSeen({ userId });
  }, [userId, markSeen]);

  return (
    <AppShell>
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">Notifications</h1>
        {!!notifications?.length && userId && (
          <button
            onClick={() => clear({ userId })}
            className="text-[13px] font-medium text-[var(--mc-accent)] hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {notifications === undefined && (
        <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] divide-y divide-[var(--mc-border)] overflow-hidden">
          <RowSkeletonList count={5} />
        </div>
      )}
      {notifications?.length === 0 && (
        <div className="text-center text-[var(--mc-text-muted)] py-16 bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)]">
          <Bell size={32} strokeWidth={1.5} className="mx-auto mb-2 opacity-50" />
          <p className="font-medium">No notifications yet</p>
        </div>
      )}

      {!!notifications?.length && (
        <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] divide-y divide-[var(--mc-border)] overflow-hidden">
          {notifications.map((n) => (
            <NotificationRow key={n._id} notification={n} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

type Notification = NonNullable<
  ReturnType<typeof useQuery<typeof api.notifications.listNotifications>>
>[number];

function NotificationRow({ notification: n }: { notification: Notification }) {
  const body =
    n.type === 'follow' ? (
      <>
        <strong>{n.fromUser?.name || n.fromUser?.username}</strong> started following you
      </>
    ) : n.type === 'like' ? (
      <>
        <strong>{n.fromUser?.name || n.fromUser?.username}</strong> liked your post
      </>
    ) : n.type === 'comment' ? (
      <>
        <strong>{n.fromUser?.name || n.fromUser?.username}</strong> commented: “{n.commentText}”
      </>
    ) : n.type === 'moderation' ? (
      n.message
    ) : (
      n.message || 'Ad status update'
    );

  const icon =
    n.type === 'follow' ? (
      <UserPlus size={16} className="text-[var(--mc-accent)]" />
    ) : n.type === 'like' ? (
      <Heart size={16} className="text-[var(--mc-red)]" fill="currentColor" />
    ) : n.type === 'comment' ? (
      <MessageCircle size={16} className="text-[var(--mc-accent)]" />
    ) : n.type === 'moderation' ? (
      <ShieldAlert size={16} className="text-[var(--mc-red)]" />
    ) : (
      <AlertTriangle size={16} className="text-[var(--mc-text-muted)]" />
    );

  const content = (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--mc-nav-hover)] transition">
      {n.fromUser ? (
        <Avatar user={n.fromUser} size={40} />
      ) : (
        <div className="w-10 h-10 rounded-full bg-[var(--mc-bg)] flex items-center justify-center shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-snug flex items-center gap-1.5">
          {n.fromUser && icon} {body}
        </p>
        <p className="text-[12px] text-[var(--mc-text-muted)] mt-0.5">
          {formatRelativeTime(n.createdAt)}
        </p>
      </div>
    </div>
  );

  if (n.type === 'follow' && n.fromUser) {
    return <Link to={`/profile/${n.fromUser._id}`}>{content}</Link>;
  }
  if ((n.type === 'like' || n.type === 'comment') && 'postId' in n) {
    return <Link to={`/post/${n.postId}`}>{content}</Link>;
  }
  return content;
}
