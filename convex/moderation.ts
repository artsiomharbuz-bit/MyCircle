import { ConvexError, v } from 'convex/values';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import {
  expiryFor,
  FOREVER,
  isSanctionActive,
  MAIN_ADMIN_USERNAME,
  MAX_STRIKES,
  durationLabel,
  formatTimeLeft,
} from '../moderationOptions';
import { rateLimiter } from './lib/rateLimit';
import { requireUser } from './lib/session';
import { sendPush } from './lib/notify';

const durationValidator = v.union(
  v.literal('1d'),
  v.literal('7d'),
  v.literal('14d'),
  v.literal('30d'),
  v.literal('1y'),
  v.literal('forever')
);

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export function isMainAdmin(user: Doc<'users'> | null): boolean {
  return user?.username?.toLowerCase() === MAIN_ADMIN_USERNAME;
}

export function isModerator(user: Doc<'users'> | null): boolean {
  return isMainAdmin(user) || user?.role === 'mod';
}

// Every moderation call carries an unlock token the moderator got by
// re-entering their password this session. Validating it here (rather than
// trusting a client flag) is what makes the password gate real. Exported so
// other modules gating their own moderator-only actions (e.g. ad review)
// reuse the exact same check rather than a second copy of it.
export async function requireUnlockedModerator(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  token: string
): Promise<Doc<'users'>> {
  const user = await ctx.db.get(userId);
  if (!isModerator(user)) {
    throw new ConvexError('You do not have moderator access.');
  }

  const session = await ctx.db
    .query('modSessions')
    .withIndex('by_token', (q) => q.eq('token', token))
    .unique();

  if (!session || session.userId !== userId || session.expiresAt < Date.now()) {
    throw new ConvexError('Your moderator session has expired. Enter your password again.');
  }

  return user!;
}

// The Main Admin is untouchable: no ban, restriction, strike, warning,
// verification change, or media takedown can ever land on that account.
async function assertTargetIsModeratable(ctx: QueryCtx | MutationCtx, targetUserId: Id<'users'>) {
  const target = await ctx.db.get(targetUserId);
  if (isMainAdmin(target)) {
    throw new ConvexError('The Main Admin cannot be moderated.');
  }
  return target;
}

async function writeLog(
  ctx: MutationCtx,
  entry: {
    targetUserId: Id<'users'>;
    actorId: Id<'users'>;
    action: Doc<'modLogs'>['action'];
    detail?: string;
    durationLabel?: string;
    postId?: Id<'posts'>;
    soundId?: Id<'sounds'>;
  }
) {
  await ctx.db.insert('modLogs', entry);
}

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

// ---------------------------------------------------------------------------
// Status / access
// ---------------------------------------------------------------------------

// Drives every "should this person see moderator UI?" decision in the app.
// Deliberately needs no unlock token — knowing you're a mod is not itself a
// privileged action; *doing* something as one is.
export const getModStatus = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const user = await ctx.db.get(userId);
    return {
      isMainAdmin: isMainAdmin(user),
      isMod: isModerator(user),
    };
  },
});

// What the app needs at launch to decide whether this account can be used at
// all (ban), whether it can post/comment (restriction), and whether there's a
// warning or strike waiting to be shown.
export const getAccountStatus = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const pendingAlert = (
      await ctx.db
        .query('userAlerts')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect()
    )
      .filter((alert) => !alert.acknowledged)
      .sort((a, b) => a._creationTime - b._creationTime)[0];

    const actor = pendingAlert ? await userSummary(ctx, pendingAlert.actorId) : null;

    return {
      isBanned: isSanctionActive(user.bannedUntil),
      bannedUntil: user.bannedUntil,
      isRestricted: isSanctionActive(user.restrictedUntil),
      restrictedUntil: user.restrictedUntil,
      strikeCount: user.strikeCount ?? 0,
      pendingAlert: pendingAlert
        ? {
            _id: pendingAlert._id,
            type: pendingAlert.type,
            message: pendingAlert.message,
            createdAt: pendingAlert._creationTime,
            fromModerator: actor?.username ?? null,
          }
        : null,
    };
  },
});

export const acknowledgeAlert = mutation({
  args: { alertId: v.id('userAlerts'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { alertId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const alert = await ctx.db.get(alertId);
    if (!alert || alert.userId !== userId) return;
    await ctx.db.patch(alertId, { acknowledged: true });
  },
});

// Shared guard used by posts/comments to enforce an active restriction or
// ban at the point of writing, not just in the UI.
export async function assertCanPublish(
  ctx: MutationCtx,
  userId: Id<'users'>,
  what: 'post' | 'comment'
) {
  const user = await ctx.db.get(userId);
  if (!user) return;
  if (isSanctionActive(user.bannedUntil)) {
    throw new ConvexError(
      `You're banned (${formatTimeLeft(user.bannedUntil)}), so you can't use the app right now.`
    );
  }
  if (isSanctionActive(user.restrictedUntil)) {
    const timeLeft = formatTimeLeft(user.restrictedUntil);
    throw new ConvexError(
      what === 'comment'
        ? `You're restricted (${timeLeft}), so you can't comment right now.`
        : `You're restricted (${timeLeft}), so you can't post right now.`
    );
  }
}

// Records the network details the Information page shows. Called once per
// app session from the client, which is the only place that can see them.
export const recordSession = mutation({
  args: {
    userId: v.id('users'),
    ip: v.optional(v.string()),
    location: v.optional(v.string()),
    isRegistration: v.optional(v.boolean()),
    // Coarse, IP-derived coordinates (see deviceInfo.ts) — feeds
    // convex/lib/geo.ts's GeoScore for suggested users and ad radius
    // targeting. Never returned from a public query (see users.getUser).
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    sessionToken: v.string(),
  },
  handler: async (ctx, { userId, ip, location, isRegistration, lat, lng, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const user = await ctx.db.get(userId);
    if (!user) return;

    const patch: Partial<Doc<'users'>> = { lastSeenAt: Date.now() };
    if (ip) {
      patch.lastSeenIp = ip;
      if (isRegistration || !user.registrationIp) patch.registrationIp = ip;
    }
    if (location) patch.location = location;
    if (lat !== undefined) patch.lat = lat;
    if (lng !== undefined) patch.lng = lng;

    await ctx.db.patch(userId, patch);
  },
});

// ---------------------------------------------------------------------------
// Unlock session (minted by the action in moderationAuth.ts)
// ---------------------------------------------------------------------------

export const createUnlockSession = internalMutation({
  args: { userId: v.id('users'), token: v.string(), expiresAt: v.number() },
  handler: async (ctx, { userId, token, expiresAt }) => {
    // One live token per moderator — a fresh unlock invalidates the old one.
    const previous = await ctx.db
      .query('modSessions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    await Promise.all(previous.map((row) => ctx.db.delete(row._id)));

    await ctx.db.insert('modSessions', { userId, token, expiresAt });
  },
});

export const getUserForAuth = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      passwordHash: user.passwordHash,
      username: user.username,
      role: user.role,
      isMainAdmin: isMainAdmin(user),
    };
  },
});

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export const reportPost = mutation({
  args: {
    postId: v.id('posts'),
    reporterId: v.id('users'),
    reason: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, { postId, reporterId, reason, sessionToken }) => {
    await requireUser(ctx, reporterId, sessionToken);
    await rateLimiter.limit(ctx, 'report', { key: reporterId, throws: true });

    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError('That post no longer exists.');

    const author = await ctx.db.get(post.authorId);
    if (isMainAdmin(author)) {
      throw new ConvexError("The Main Admin's content cannot be reported.");
    }

    // One open report per person per post — re-reporting does nothing.
    const existing = await ctx.db
      .query('reports')
      .withIndex('by_post', (q) => q.eq('postId', postId))
      .collect();
    if (
      existing.some((row) => row.reporterId === reporterId && row.status !== 'resolved')
    ) {
      return;
    }

    await ctx.db.insert('reports', {
      kind: 'post',
      postId,
      targetUserId: post.authorId,
      reporterId,
      reason: reason.trim(),
      status: 'open',
    });
  },
});

export const reportProfile = mutation({
  args: {
    targetUserId: v.id('users'),
    reporterId: v.id('users'),
    reason: v.string(),
    evidenceStorageId: v.optional(v.id('_storage')),
    sessionToken: v.string(),
  },
  handler: async (ctx, { targetUserId, reporterId, reason, evidenceStorageId, sessionToken }) => {
    await requireUser(ctx, reporterId, sessionToken);
    await rateLimiter.limit(ctx, 'report', { key: reporterId, throws: true });

    const trimmed = reason.trim();
    if (!trimmed) throw new ConvexError('Please describe what is wrong.');
    if (targetUserId === reporterId) throw new ConvexError('You cannot report yourself.');

    const target = await ctx.db.get(targetUserId);
    if (isMainAdmin(target)) {
      throw new ConvexError('The Main Admin cannot be reported.');
    }

    await ctx.db.insert('reports', {
      kind: 'profile',
      targetUserId,
      reporterId,
      reason: trimmed,
      evidenceStorageId,
      status: 'open',
    });
  },
});

export const generateEvidenceUploadUrl = mutation({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    await rateLimiter.limit(ctx, 'generateUploadUrl', { key: userId, throws: true });
    return await ctx.storage.generateUploadUrl();
  },
});

// ---------------------------------------------------------------------------
// Mod inbox
// ---------------------------------------------------------------------------

// Every unresolved report, newest first — identical for every moderator, so
// one of them claiming or resolving a report is reflected for all of them the
// moment it happens (Convex queries are reactive).
export const listModInbox = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const viewer = await ctx.db.get(userId);
    if (!isModerator(viewer)) return [];

    const open = await ctx.db
      .query('reports')
      .withIndex('by_status', (q) => q.eq('status', 'open'))
      .collect();
    const investigating = await ctx.db
      .query('reports')
      .withIndex('by_status', (q) => q.eq('status', 'investigating'))
      .collect();

    const rows = [...open, ...investigating].sort(
      (a, b) => b._creationTime - a._creationTime
    );

    return await Promise.all(
      rows.map(async (row) => {
        const post = row.postId ? await ctx.db.get(row.postId) : null;
        const sound = row.soundId ? await ctx.db.get(row.soundId) : null;
        return {
          _id: row._id,
          kind: row.kind,
          reason: row.reason,
          status: row.status,
          createdAt: row._creationTime,
          hasEvidence: !!row.evidenceStorageId,
          claimedBy: row.claimedByModId ? await userSummary(ctx, row.claimedByModId) : null,
          claimedByMe: row.claimedByModId === userId,
          target: await userSummary(ctx, row.targetUserId),
          reporter: await userSummary(ctx, row.reporterId),
          postKind: post ? post.kind ?? 'post' : null,
          postThumbUrl: post ? await ctx.storage.getUrl(post.mediaStorageId) : null,
          soundName: sound?.name ?? null,
          soundPictureUrl:
            sound?.pictureStorageId ? await ctx.storage.getUrl(sound.pictureStorageId) : null,
          // A post/sound report whose target is already gone is dead weight.
          postMissing: row.kind === 'post' && !post,
          soundMissing: row.kind === 'sound' && !sound,
        };
      })
    );
  },
});

export const getModInboxCount = query({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const viewer = await ctx.db.get(userId);
    if (!isModerator(viewer)) return 0;

    const open = await ctx.db
      .query('reports')
      .withIndex('by_status', (q) => q.eq('status', 'open'))
      .collect();
    return open.length;
  },
});

// Opening a report is what marks it "under investigation" in every other
// moderator's inbox — so it takes an unlock token like any other mod action.
export const claimReport = mutation({
  args: { reportId: v.id('reports'), modId: v.id('users'), token: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { reportId, modId, token }) => {
    await requireUnlockedModerator(ctx, modId, token);

    const report = await ctx.db.get(reportId);
    if (!report) throw new ConvexError('That report is no longer available.');
    if (report.status === 'resolved') {
      throw new ConvexError('Another moderator already handled this report.');
    }
    if (report.status === 'open') {
      await ctx.db.patch(reportId, {
        status: 'investigating',
        claimedByModId: modId,
        claimedAt: Date.now(),
      });
    }
  },
});

// The full detail a moderator reviews: the reported post (bypassing the
// audience rules a normal viewer would be held to) or the profile report's
// text and evidence image.
export const getReportForReview = query({
  args: { reportId: v.id('reports'), modId: v.id('users'), token: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { reportId, modId, token }) => {
    await requireUnlockedModerator(ctx, modId, token);

    const report = await ctx.db.get(reportId);
    if (!report) return null;

    const post = report.postId ? await ctx.db.get(report.postId) : null;
    const sound = report.soundId ? await ctx.db.get(report.soundId) : null;

    return {
      _id: report._id,
      kind: report.kind,
      reason: report.reason,
      status: report.status,
      createdAt: report._creationTime,
      resolution: report.resolution,
      evidenceUrl: report.evidenceStorageId
        ? await ctx.storage.getUrl(report.evidenceStorageId)
        : null,
      target: await userSummary(ctx, report.targetUserId),
      targetUserId: report.targetUserId,
      reporter: await userSummary(ctx, report.reporterId),
      post: post
        ? {
            _id: post._id,
            title: post.title,
            caption: post.caption,
            mediaType: post.mediaType,
            mediaUrl: await ctx.storage.getUrl(post.mediaStorageId),
            kind: post.kind ?? 'post',
            textOverlay: post.textOverlay,
            createdAt: post._creationTime,
          }
        : null,
      sound: sound
        ? {
            _id: sound._id,
            name: sound.name,
            pictureUrl: sound.pictureStorageId
              ? await ctx.storage.getUrl(sound.pictureStorageId)
              : null,
            audioUrl: await ctx.storage.getUrl(sound.audioStorageId),
            useCount: sound.useCount,
            isGlobal: sound.isGlobal,
          }
        : null,
      postMissing: report.kind === 'post' && !post,
      soundMissing: report.kind === 'sound' && !sound,
    };
  },
});

// A sound "born" from a video post reuses that post's own mediaStorageId
// directly rather than duplicating the upload — so before a post's media
// gets hard-deleted, this checks whether a still-active sound depends on
// that exact same blob. If so, the storage is left alone (the sound keeps
// working for whoever's using it); only the post row itself goes.
async function isStorageStillNeededBySound(ctx: MutationCtx, storageId: Id<'_storage'>) {
  const sounds = await ctx.db.query('sounds').collect();
  return sounds.some((sound) => sound.status === 'active' && sound.audioStorageId === storageId);
}

// Wipes a post and everything hanging off it. Exported so posts.ts's
// scheduled expirePost (auto-delete for circles posts/clips — see
// postExpiry.ts) can reuse the exact same cleanup instead of a second copy
// of it; callers that also need to resolve open reports do that separately
// (see closeReportsForPost below) since a scheduled expiry has no report to
// close.
export async function deletePostCompletely(ctx: MutationCtx, postId: Id<'posts'>) {
  const post = await ctx.db.get(postId);
  if (!post) return;

  const comments = await ctx.db
    .query('comments')
    .withIndex('by_post', (q) => q.eq('postId', postId))
    .collect();
  for (const comment of comments) {
    const commentLikes = await ctx.db
      .query('commentLikes')
      .withIndex('by_comment', (q) => q.eq('commentId', comment._id))
      .collect();
    await Promise.all(commentLikes.map((like) => ctx.db.delete(like._id)));
    await ctx.db.delete(comment._id);
  }

  const likes = await ctx.db
    .query('likes')
    .withIndex('by_post', (q) => q.eq('postId', postId))
    .collect();
  await Promise.all(likes.map((like) => ctx.db.delete(like._id)));

  const bookmarks = (await ctx.db.query('bookmarks').collect()).filter(
    (row) => row.postId === postId
  );
  await Promise.all(bookmarks.map((row) => ctx.db.delete(row._id)));

  // One fewer post uses whatever sound this one carried.
  if (post.soundId) {
    const sound = await ctx.db.get(post.soundId);
    if (sound) {
      await ctx.db.patch(post.soundId, { useCount: Math.max(0, sound.useCount - 1) });
    }
  }

  if (!(await isStorageStillNeededBySound(ctx, post.mediaStorageId))) {
    await ctx.storage.delete(post.mediaStorageId);
  }
  for (const extraId of post.extraMediaStorageIds ?? []) {
    await ctx.storage.delete(extraId);
  }
  await ctx.db.delete(postId);
}

async function closeReportsForPost(
  ctx: MutationCtx,
  postId: Id<'posts'>,
  modId: Id<'users'>,
  resolution: 'deleted' | 'dismissed'
) {
  const related = await ctx.db
    .query('reports')
    .withIndex('by_post', (q) => q.eq('postId', postId))
    .collect();

  await Promise.all(
    related
      .filter((row) => row.status !== 'resolved')
      .map(async (row) => {
        await ctx.db.patch(row._id, {
          status: 'resolved' as const,
          resolution,
          resolvedByModId: modId,
          resolvedAt: Date.now(),
        });
        await sendPush(
          ctx,
          row.reporterId,
          'Report reviewed',
          resolution === 'deleted'
            ? 'Thanks for the report — we removed the content you flagged.'
            : 'Thanks for the report — our team reviewed it and took no action.',
          { type: 'report_resolved', reportId: row._id }
        );
      })
  );
}

async function closeReportsForSound(
  ctx: MutationCtx,
  soundId: Id<'sounds'>,
  modId: Id<'users'>,
  resolution: 'deleted' | 'dismissed'
) {
  const related = await ctx.db
    .query('reports')
    .withIndex('by_sound', (q) => q.eq('soundId', soundId))
    .collect();

  await Promise.all(
    related
      .filter((row) => row.status !== 'resolved')
      .map(async (row) => {
        await ctx.db.patch(row._id, {
          status: 'resolved' as const,
          resolution,
          resolvedByModId: modId,
          resolvedAt: Date.now(),
        });
        await sendPush(
          ctx,
          row.reporterId,
          'Report reviewed',
          resolution === 'deleted'
            ? 'Thanks for the report — we removed the content you flagged.'
            : 'Thanks for the report — our team reviewed it and took no action.',
          { type: 'report_resolved', reportId: row._id }
        );
      })
  );
}

export const deleteReportedPost = mutation({
  args: { reportId: v.id('reports'), modId: v.id('users'), token: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { reportId, modId, token }) => {
    await requireUnlockedModerator(ctx, modId, token);

    const report = await ctx.db.get(reportId);
    if (!report || !report.postId) throw new ConvexError('That report is no longer available.');
    await assertTargetIsModeratable(ctx, report.targetUserId);

    await closeReportsForPost(ctx, report.postId, modId, 'deleted');
    await deletePostCompletely(ctx, report.postId);

    await writeLog(ctx, {
      targetUserId: report.targetUserId,
      actorId: modId,
      action: 'delete_media',
      detail: `Removed a reported ${report.kind === 'post' ? 'post/clip' : 'item'} — "${report.reason}"`,
      postId: report.postId,
    });
  },
});

// Marks a reported sound as deleted — every post/clip carrying it goes mute
// and its label switches to "Deleted sound" (formatSoundSummary in posts.ts
// reads sound.status, not this row directly), and closes every report on it
// so it disappears from all inboxes at once. The audio blob itself is only
// hard-deleted when nothing else still needs it — see deletePostCompletely's
// isStorageStillNeededBySound for the mirror-image check.
export const deleteReportedSound = mutation({
  args: { reportId: v.id('reports'), modId: v.id('users'), token: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { reportId, modId, token }) => {
    await requireUnlockedModerator(ctx, modId, token);

    const report = await ctx.db.get(reportId);
    if (!report || !report.soundId) throw new ConvexError('That report is no longer available.');
    await assertTargetIsModeratable(ctx, report.targetUserId);

    const sound = await ctx.db.get(report.soundId);
    if (!sound) throw new ConvexError('That sound no longer exists.');

    await closeReportsForSound(ctx, report.soundId, modId, 'deleted');

    const originPost = sound.originPostId ? await ctx.db.get(sound.originPostId) : null;
    const originStillNeedsBlob = originPost?.mediaStorageId === sound.audioStorageId;
    if (!originStillNeedsBlob) {
      await ctx.storage.delete(sound.audioStorageId);
    }
    if (sound.pictureStorageId) {
      await ctx.storage.delete(sound.pictureStorageId);
    }

    await ctx.db.patch(report.soundId, { status: 'deleted' });

    await writeLog(ctx, {
      targetUserId: report.targetUserId,
      actorId: modId,
      action: 'delete_sound',
      detail: `Removed a reported sound — "${report.reason}"`,
      soundId: report.soundId,
    });
  },
});

export const dismissReport = mutation({
  args: { reportId: v.id('reports'), modId: v.id('users'), token: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { reportId, modId, token }) => {
    await requireUnlockedModerator(ctx, modId, token);

    const report = await ctx.db.get(reportId);
    if (!report) throw new ConvexError('That report is no longer available.');

    if (report.postId) {
      // Dismissing one report on a post clears every open report on it, so
      // the same content isn't queued up again for the next moderator.
      await closeReportsForPost(ctx, report.postId, modId, 'dismissed');
    } else if (report.soundId) {
      await closeReportsForSound(ctx, report.soundId, modId, 'dismissed');
    } else {
      await ctx.db.patch(reportId, {
        status: 'resolved',
        resolution: 'dismissed',
        resolvedByModId: modId,
        resolvedAt: Date.now(),
      });
      await sendPush(
        ctx,
        report.reporterId,
        'Report reviewed',
        'Thanks for the report — our team reviewed it and took no action.',
        { type: 'report_resolved', reportId: report._id }
      );
    }

    await writeLog(ctx, {
      targetUserId: report.targetUserId,
      actorId: modId,
      action: 'dismiss_report',
      detail: `Dismissed a ${report.kind} report — "${report.reason}"`,
      postId: report.postId,
      soundId: report.soundId,
    });
  },
});

// ---------------------------------------------------------------------------
// Sanctions
// ---------------------------------------------------------------------------

export const restrictUser = mutation({
  args: {
    targetUserId: v.id('users'),
    modId: v.id('users'),
    token: v.string(), sessionToken: v.optional(v.string()),
    duration: durationValidator,
  },
  handler: async (ctx, { targetUserId, modId, token, duration }) => {
    await requireUnlockedModerator(ctx, modId, token);
    await assertTargetIsModeratable(ctx, targetUserId);

    await ctx.db.patch(targetUserId, { restrictedUntil: expiryFor(duration, Date.now()) });
    await writeLog(ctx, {
      targetUserId,
      actorId: modId,
      action: 'restrict',
      durationLabel: durationLabel(duration),
      detail: 'Restricted from posting and commenting',
    });
    await sendPush(
      ctx,
      targetUserId,
      'Account restricted',
      `You've been restricted from posting and commenting (${durationLabel(duration)}).`,
      { type: 'moderation' }
    );
  },
});

export const banUser = mutation({
  args: {
    targetUserId: v.id('users'),
    modId: v.id('users'),
    token: v.string(), sessionToken: v.optional(v.string()),
    duration: durationValidator,
  },
  handler: async (ctx, { targetUserId, modId, token, duration }) => {
    await requireUnlockedModerator(ctx, modId, token);
    await assertTargetIsModeratable(ctx, targetUserId);

    await ctx.db.patch(targetUserId, { bannedUntil: expiryFor(duration, Date.now()) });
    await writeLog(ctx, {
      targetUserId,
      actorId: modId,
      action: 'ban',
      durationLabel: durationLabel(duration),
      detail: 'Banned from the app',
    });
    await sendPush(
      ctx,
      targetUserId,
      'Account banned',
      `You've been banned from MyCircle (${durationLabel(duration)}).`,
      { type: 'moderation' }
    );
  },
});

export const liftSanction = mutation({
  args: {
    targetUserId: v.id('users'),
    modId: v.id('users'),
    token: v.string(), sessionToken: v.optional(v.string()),
    sanction: v.union(v.literal('restriction'), v.literal('ban')),
  },
  handler: async (ctx, { targetUserId, modId, token, sanction }) => {
    await requireUnlockedModerator(ctx, modId, token);

    if (sanction === 'restriction') {
      await ctx.db.patch(targetUserId, { restrictedUntil: undefined });
      await writeLog(ctx, {
        targetUserId,
        actorId: modId,
        action: 'unrestrict',
        detail: 'Restriction lifted',
      });
    } else {
      await ctx.db.patch(targetUserId, { bannedUntil: undefined });
      await writeLog(ctx, {
        targetUserId,
        actorId: modId,
        action: 'unban',
        detail: 'Ban lifted',
      });
    }
  },
});

export const warnUser = mutation({
  args: {
    targetUserId: v.id('users'),
    modId: v.id('users'),
    token: v.string(), sessionToken: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, { targetUserId, modId, token, message }) => {
    await requireUnlockedModerator(ctx, modId, token);
    await assertTargetIsModeratable(ctx, targetUserId);

    const trimmed = message.trim();
    if (!trimmed) throw new ConvexError('Write what the warning is about.');

    await ctx.db.insert('userAlerts', {
      userId: targetUserId,
      actorId: modId,
      type: 'warning',
      message: trimmed,
      acknowledged: false,
    });
    await writeLog(ctx, {
      targetUserId,
      actorId: modId,
      action: 'warn',
      detail: trimmed,
    });
    await sendPush(ctx, targetUserId, 'Account warning', trimmed, { type: 'moderation' });
  },
});

export const setVerified = mutation({
  args: {
    targetUserId: v.id('users'),
    modId: v.id('users'),
    token: v.string(), sessionToken: v.optional(v.string()),
    verified: v.boolean(),
  },
  handler: async (ctx, { targetUserId, modId, token, verified }) => {
    await requireUnlockedModerator(ctx, modId, token);
    await assertTargetIsModeratable(ctx, targetUserId);

    await ctx.db.patch(targetUserId, { isVerified: verified });
    await writeLog(ctx, {
      targetUserId,
      actorId: modId,
      action: verified ? 'verify' : 'unverify',
      detail: verified ? 'Account verified' : 'Verification removed',
    });
  },
});

// Third strike bans the account forever — that escalation is applied here,
// server-side, so it can't be skipped by a client that forgets to check.
export const giveStrike = mutation({
  args: {
    targetUserId: v.id('users'),
    modId: v.id('users'),
    token: v.string(), sessionToken: v.optional(v.string()),
    reason: v.string(),
  },
  handler: async (ctx, { targetUserId, modId, token, reason }) => {
    await requireUnlockedModerator(ctx, modId, token);
    const target = await assertTargetIsModeratable(ctx, targetUserId);
    if (!target) throw new ConvexError('That account no longer exists.');

    const trimmed = reason.trim();
    if (!trimmed) throw new ConvexError('Write why this strike is being given.');

    const nextCount = Math.min(MAX_STRIKES, (target.strikeCount ?? 0) + 1);
    const isFinal = nextCount >= MAX_STRIKES;

    await ctx.db.patch(targetUserId, {
      strikeCount: nextCount,
      ...(isFinal ? { bannedUntil: FOREVER } : {}),
    });

    await ctx.db.insert('userAlerts', {
      userId: targetUserId,
      actorId: modId,
      type: 'strike',
      message: isFinal
        ? `${trimmed}\n\nThis was your third strike, so your account has been permanently banned.`
        : trimmed,
      acknowledged: false,
    });

    await writeLog(ctx, {
      targetUserId,
      actorId: modId,
      action: 'strike',
      detail: `Strike ${nextCount} of ${MAX_STRIKES} — ${trimmed}`,
    });

    if (isFinal) {
      await writeLog(ctx, {
        targetUserId,
        actorId: modId,
        action: 'ban',
        durationLabel: 'Forever',
        detail: `Automatic ban after ${MAX_STRIKES} strikes`,
      });
    }

    await sendPush(
      ctx,
      targetUserId,
      isFinal ? 'Account banned' : 'Strike received',
      isFinal
        ? `This was your third strike — your account has been permanently banned.`
        : `You received strike ${nextCount} of ${MAX_STRIKES}: ${trimmed}`,
      { type: 'moderation' }
    );

    return { strikeCount: nextCount, banned: isFinal };
  },
});

// Moderator-initiated takedown straight from a post's three-dot menu, with
// no report involved.
export const deletePostAsMod = mutation({
  args: { postId: v.id('posts'), modId: v.id('users'), token: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { postId, modId, token }) => {
    await requireUnlockedModerator(ctx, modId, token);

    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError('That post no longer exists.');
    await assertTargetIsModeratable(ctx, post.authorId);

    await closeReportsForPost(ctx, postId, modId, 'deleted');
    await deletePostCompletely(ctx, postId);

    await writeLog(ctx, {
      targetUserId: post.authorId,
      actorId: modId,
      action: 'delete_media',
      detail: `Removed a ${post.kind === 'clip' ? 'clip' : 'post'}`,
      postId,
    });
  },
});

// Moderator override for content whose creator didn't self-label it as AI —
// a one-way flip (no "unlabel"), same as every other mod-only tag.
export const labelPostAsAi = mutation({
  args: { postId: v.id('posts'), modId: v.id('users'), token: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { postId, modId, token }) => {
    await requireUnlockedModerator(ctx, modId, token);

    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError('That post no longer exists.');
    if (post.containsAi) return;
    await assertTargetIsModeratable(ctx, post.authorId);

    await ctx.db.patch(postId, { containsAi: true });

    await writeLog(ctx, {
      targetUserId: post.authorId,
      actorId: modId,
      action: 'label_ai',
      detail: `Labeled a ${post.kind === 'clip' ? 'clip' : 'post'} as containing AI`,
      postId,
    });
  },
});

// ---------------------------------------------------------------------------
// Profile moderation panels: Information and Logs
// ---------------------------------------------------------------------------

export const getUserInformation = query({
  args: { targetUserId: v.id('users'), modId: v.id('users'), token: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { targetUserId, modId, token }) => {
    await requireUnlockedModerator(ctx, modId, token);

    const user = await ctx.db.get(targetUserId);
    if (!user) return null;

    return {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      dateOfBirth: user.dateOfBirth,
      registeredAt: user._creationTime,
      registrationIp: user.registrationIp ?? null,
      lastSeenIp: user.lastSeenIp ?? null,
      lastSeenAt: user.lastSeenAt ?? null,
      location: user.location ?? null,
      strikeCount: user.strikeCount ?? 0,
      isVerified: user.isVerified ?? false,
      restrictedUntil: user.restrictedUntil,
      bannedUntil: user.bannedUntil,
      role: isMainAdmin(user) ? 'Main Admin' : user.role === 'mod' ? 'Moderator' : 'Member',
    };
  },
});

export const listUserLogs = query({
  args: { targetUserId: v.id('users'), modId: v.id('users'), token: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { targetUserId, modId, token }) => {
    await requireUnlockedModerator(ctx, modId, token);

    const rows = await ctx.db
      .query('modLogs')
      .withIndex('by_target', (q) => q.eq('targetUserId', targetUserId))
      .order('desc')
      .collect();

    return await Promise.all(
      rows.map(async (row) => {
        const actor = await ctx.db.get(row.actorId);
        return {
          _id: row._id,
          action: row.action,
          detail: row.detail ?? null,
          durationLabel: row.durationLabel ?? null,
          createdAt: row._creationTime,
          actorName: actor?.username ? `@${actor.username}` : 'Unknown moderator',
          actorIsMainAdmin: isMainAdmin(actor),
        };
      })
    );
  },
});

// The moderation popup needs the target's current state to label its own
// options ("Lift restriction" vs "Restrict", "Verified" vs "Verify").
export const getModerationTarget = query({
  args: { targetUserId: v.id('users'), modId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { targetUserId, modId, sessionToken }) => {
    await requireUser(ctx, modId, sessionToken);
    const viewer = await ctx.db.get(modId);
    if (!isModerator(viewer)) return null;

    const user = await ctx.db.get(targetUserId);
    if (!user) return null;

    return {
      username: user.username,
      isMainAdmin: isMainAdmin(user),
      isMod: user.role === 'mod',
      isVerified: user.isVerified ?? false,
      strikeCount: user.strikeCount ?? 0,
      isRestricted: isSanctionActive(user.restrictedUntil),
      restrictedUntil: user.restrictedUntil,
      isBanned: isSanctionActive(user.bannedUntil),
      bannedUntil: user.bannedUntil,
    };
  },
});

// ---------------------------------------------------------------------------
// Manage Admins (Main Admin only)
// ---------------------------------------------------------------------------

export const searchUsersForAdmin = query({
  args: { adminId: v.id('users'), search: v.string(), sessionToken: v.string() },
  handler: async (ctx, { adminId, search, sessionToken }) => {
    await requireUser(ctx, adminId, sessionToken);
    const admin = await ctx.db.get(adminId);
    if (!isMainAdmin(admin)) return [];

    const term = search.trim().toLowerCase();
    const users = await ctx.db.query('users').collect();

    const matched = users.filter((user) => {
      if (isMainAdmin(user)) return false;
      if (!user.onboardingComplete) return false;
      if (!term) return user.role === 'mod';
      return (
        user.username?.toLowerCase().includes(term) || user.name?.toLowerCase().includes(term)
      );
    });

    // Existing moderators first, so the page doubles as the current roster.
    matched.sort(
      (a, b) =>
        Number(b.role === 'mod') - Number(a.role === 'mod') ||
        (a.username ?? '').localeCompare(b.username ?? '')
    );

    return await Promise.all(
      matched.slice(0, 30).map(async (user) => ({
        _id: user._id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarStorageId ? await ctx.storage.getUrl(user.avatarStorageId) : null,
        avatarGradient: user.avatarGradient,
        isVerified: user.isVerified ?? false,
        isMod: user.role === 'mod',
      }))
    );
  },
});

export const applyModRole = internalMutation({
  args: {
    adminId: v.id('users'),
    targetUserId: v.id('users'),
    makeMod: v.boolean(),
  },
  handler: async (ctx, { adminId, targetUserId, makeMod }) => {
    const admin = await ctx.db.get(adminId);
    if (!isMainAdmin(admin)) {
      throw new ConvexError('Only the Main Admin can manage moderators.');
    }

    const target = await ctx.db.get(targetUserId);
    if (!target) throw new ConvexError('That account no longer exists.');
    if (isMainAdmin(target)) {
      throw new ConvexError('The Main Admin role cannot be changed.');
    }

    await ctx.db.patch(targetUserId, { role: makeMod ? ('mod' as const) : undefined });

    if (!makeMod) {
      // Revoking access has to kill any unlock token they still hold.
      const sessions = await ctx.db
        .query('modSessions')
        .withIndex('by_user', (q) => q.eq('userId', targetUserId))
        .collect();
      await Promise.all(sessions.map((row) => ctx.db.delete(row._id)));
    }

    await writeLog(ctx, {
      targetUserId,
      actorId: adminId,
      action: makeMod ? 'promote_mod' : 'revoke_mod',
      detail: makeMod ? 'Granted moderator access' : 'Moderator access revoked',
    });

    return { username: target.username ?? '', isMod: makeMod };
  },
});
