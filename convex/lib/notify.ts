// Thin wrapper every notification-triggering mutation calls right after its
// own write — schedules the actual Expo push send (convex/push.ts,
// sendPushToUser) to run immediately after this mutation commits, since a
// mutation itself can't make network calls. In-app "Notifications" list
// entries are unaffected by this file — most of them are still derived live
// from their source tables at read time (see convex/notifications.ts); this
// is purely the push half.
import { Id } from '../_generated/dataModel';
import { MutationCtx } from '../_generated/server';
import { internal } from '../_generated/api';

export async function sendPush(
  ctx: MutationCtx,
  recipientId: Id<'users'>,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  await ctx.scheduler.runAfter(0, internal.push.sendPushToUser, { userId: recipientId, title, body, data });
}

// Trims a comment/message body for use in a push notification, same 80-char
// budget everywhere so previews stay short and consistent.
export function pushPreview(text: string, max = 80): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export function displayName(user: { name?: string; username?: string } | null): string {
  if (!user) return 'Someone';
  return user.name || (user.username ? `@${user.username}` : 'Someone');
}
