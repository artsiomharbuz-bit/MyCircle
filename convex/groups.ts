import { mutation, query, MutationCtx, QueryCtx } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { conversationId } from './messages';
import { rateLimiter } from './lib/rateLimit';
import { requireUser } from './lib/session';

async function userSummary(ctx: QueryCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarStorageId ? await ctx.storage.getUrl(user.avatarStorageId) : null,
    avatarGradient: user.avatarGradient,
    isVerified: user.isVerified ?? false,
  };
}

// A group's own synthetic "conversation" id, for reusing the existing
// `reads` table (keyed by an opaque conversationId string) to track each
// member's last-read time instead of adding a parallel table for it.
function groupReadKey(groupId: Id<'groupChats'>) {
  return `group:${groupId}`;
}

// Creates the group, joins the creator immediately, and invites everyone
// else — mirrors userCircles.createCircle + inviteToCircle: an invitee gets
// an 'invited' membership row plus a chat message (in their existing 1:1
// thread with the creator) carrying groupInviteId, which renders as a
// "Join <group>" card. They don't show up as a member anywhere until they
// tap Join. Shared by createGroup and createGroupFromCircle below.
async function createGroupAndInvite(
  ctx: MutationCtx,
  creatorId: Id<'users'>,
  name: string,
  memberIds: Id<'users'>[]
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Group name is required.');

  const groupId = await ctx.db.insert('groupChats', { creatorId, name: trimmed });
  await ctx.db.insert('groupMemberships', { groupId, userId: creatorId, status: 'joined' });

  const invitees = [...new Set(memberIds)].filter((id) => id !== creatorId);
  for (const inviteeId of invitees) {
    // Added straight in — no invite to accept. They can leave any time.
    await ctx.db.insert('groupMemberships', { groupId, userId: inviteeId, status: 'joined' });
    await ctx.db.insert('messages', {
      conversationId: conversationId(creatorId, inviteeId),
      senderId: creatorId,
      recipientId: inviteeId,
      text: `Added you to the group "${trimmed}"`,
    });
  }

  return groupId;
}

export const createGroup = mutation({
  args: { creatorId: v.id('users'), name: v.string(), memberIds: v.array(v.id('users')), sessionToken: v.string() },
  handler: async (ctx, { creatorId, name, memberIds, sessionToken }) => {
    await requireUser(ctx, creatorId, sessionToken);
    await rateLimiter.limit(ctx, 'createGroup', { key: creatorId, throws: true });
    return createGroupAndInvite(ctx, creatorId, name, memberIds);
  },
});

export const joinGroup = mutation({
  args: { groupId: v.id('groupChats'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { groupId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const existing = await ctx.db
      .query('groupMemberships')
      .withIndex('by_group_user', (q) => q.eq('groupId', groupId).eq('userId', userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { status: 'joined' });
    } else {
      await ctx.db.insert('groupMemberships', { groupId, userId, status: 'joined' });
    }
  },
});

// Drops the viewer's own membership — they stop seeing the group and its
// messages; everyone else is unaffected.
export const leaveGroup = mutation({
  args: { groupId: v.id('groupChats'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { groupId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const membership = await ctx.db
      .query('groupMemberships')
      .withIndex('by_group_user', (q) => q.eq('groupId', groupId).eq('userId', userId))
      .unique();
    if (membership) await ctx.db.delete(membership._id);
  },
});

// Powers the invite card in chat — name plus whether this viewer has
// already joined, is still invited, or has no relationship to it at all.
export const getGroupInviteInfo = query({
  args: { groupId: v.id('groupChats'), viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { groupId, viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);

    const group = await ctx.db.get(groupId);
    if (!group) return null;

    const membership = await ctx.db
      .query('groupMemberships')
      .withIndex('by_group_user', (q) => q.eq('groupId', groupId).eq('userId', viewerId))
      .unique();

    const rows = await ctx.db
      .query('groupMemberships')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect();

    return {
      _id: group._id,
      name: group.name,
      status: membership?.status ?? 'none',
      memberCount: rows.filter((r) => r.status === 'joined').length,
    };
  },
});

async function listJoinedMembers(ctx: QueryCtx, groupId: Id<'groupChats'>) {
  const rows = await ctx.db
    .query('groupMemberships')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect();
  const joined = rows.filter((r) => r.status === 'joined');
  const members = await Promise.all(joined.map((r) => userSummary(ctx, r.userId)));
  return members.filter((m): m is NonNullable<typeof m> => m !== null);
}

export const listGroupMembers = query({
  args: { groupId: v.id('groupChats'), viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { groupId, viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);
    return listJoinedMembers(ctx, groupId);
  },
});

// One row per group this user has joined, newest activity first — what the
// DMs list interleaves alongside 1:1 conversations. `members` (capped to a
// handful by the caller) is what GroupAvatarStack renders in place of a
// single photo.
export const listMyGroups = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const memberships = await ctx.db
      .query('groupMemberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const joined = memberships.filter((m) => m.status === 'joined');

    const groups = await Promise.all(
      joined.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId);
        if (!group) return null;

        const members = await listJoinedMembers(ctx, membership.groupId);

        const allMessages = await ctx.db
          .query('groupMessages')
          .withIndex('by_group', (q) => q.eq('groupId', membership.groupId))
          .collect();
        const last = allMessages.reduce<(typeof allMessages)[number] | null>(
          (latest, m) => (!latest || m._creationTime > latest._creationTime ? m : latest),
          null
        );

        const read = await ctx.db
          .query('reads')
          .withIndex('by_conversation_user', (q) =>
            q.eq('conversationId', groupReadKey(membership.groupId)).eq('userId', userId)
          )
          .unique();
        const unreadCount = allMessages.filter(
          (m) => m.senderId !== userId && m._creationTime > (read?.lastReadAt ?? 0)
        ).length;

        return {
          _id: group._id,
          name: group.name,
          members,
          lastMessage: last?.text ?? null,
          lastMessageIsMine: last ? last.senderId === userId : false,
          lastMessageAt: last?._creationTime ?? group._creationTime,
          unreadCount,
        };
      })
    );

    return groups
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

// The full back-and-forth in a group, oldest first, each message carrying
// who sent it (unlike a 1:1 thread, "them" isn't a single fixed person).
export const listGroupMessages = query({
  args: { groupId: v.id('groupChats'), viewerId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { groupId, viewerId, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);

    const membership = await ctx.db
      .query('groupMemberships')
      .withIndex('by_group_user', (q) => q.eq('groupId', groupId).eq('userId', viewerId))
      .unique();
    if (membership?.status !== 'joined') return [];

    const rows = await ctx.db
      .query('groupMessages')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .order('asc')
      .collect();

    return await Promise.all(
      rows.map(async (row) => {
        const sender = await userSummary(ctx, row.senderId);
        const sticker = row.stickerId ? await ctx.db.get(row.stickerId) : null;
        return {
          _id: row._id,
          _creationTime: row._creationTime,
          text: row.text,
          sticker: sticker
            ? {
                _id: sticker._id,
                name: sticker.name,
                imageUrl: await ctx.storage.getUrl(sticker.imageStorageId),
              }
            : null,
          mediaType: row.mediaType,
          mediaUrl: row.mediaStorageId ? await ctx.storage.getUrl(row.mediaStorageId) : null,
          sender,
          isMine: row.senderId === viewerId,
        };
      })
    );
  },
});

export const sendGroupMessage = mutation({
  args: {
    groupId: v.id('groupChats'),
    senderId: v.id('users'),
    text: v.string(),
    stickerId: v.optional(v.id('stickers')),
    mediaStorageId: v.optional(v.id('_storage')),
    mediaType: v.optional(v.union(v.literal('photo'), v.literal('video'))),
    sessionToken: v.string(),
  },
  handler: async (ctx, { groupId, senderId, text, stickerId, mediaStorageId, mediaType, sessionToken }) => {
    await requireUser(ctx, senderId, sessionToken);

    const trimmed = text.trim();
    if (!trimmed && !stickerId && !mediaStorageId) return;

    await rateLimiter.limit(ctx, 'sendGroupMessage', { key: senderId, throws: true });

    const membership = await ctx.db
      .query('groupMemberships')
      .withIndex('by_group_user', (q) => q.eq('groupId', groupId).eq('userId', senderId))
      .unique();
    if (membership?.status !== 'joined') {
      throw new ConvexError("You're not a member of this group.");
    }

    await ctx.db.insert('groupMessages', {
      groupId,
      senderId,
      text:
        trimmed ||
        (stickerId ? 'Sent a sticker' : mediaType === 'video' ? 'Sent a video' : mediaStorageId ? 'Sent a photo' : ''),
      stickerId,
      mediaStorageId,
      mediaType,
    });
  },
});

export const markGroupRead = mutation({
  args: { groupId: v.id('groupChats'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { groupId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const convId = groupReadKey(groupId);
    const existing = await ctx.db
      .query('reads')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', convId).eq('userId', userId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastReadAt: Date.now() });
    } else {
      await ctx.db.insert('reads', { conversationId: convId, userId, lastReadAt: Date.now() });
    }
  },
});

// Circle settings' "Create group chat" — every joined member of the circle
// becomes an invitee (the circle owner, who calls this, auto-joins as the
// group's creator same as createGroup always does).
export const createGroupFromCircle = mutation({
  args: { circleId: v.id('userCircles'), creatorId: v.id('users'), name: v.string(), sessionToken: v.string() },
  handler: async (ctx, { circleId, creatorId, name, sessionToken }) => {
    await requireUser(ctx, creatorId, sessionToken);

    const circle = await ctx.db.get(circleId);
    if (!circle || circle.ownerId !== creatorId) {
      throw new Error('Only the circle owner can create a group chat from it.');
    }

    const memberships = await ctx.db
      .query('circleMemberships')
      .withIndex('by_circle', (q) => q.eq('circleId', circleId))
      .collect();
    const memberIds = memberships
      .filter((m) => m.status === 'joined' && m.userId !== creatorId)
      .map((m) => m.userId);

    return createGroupAndInvite(ctx, creatorId, name.trim() || circle.name, memberIds);
  },
});
