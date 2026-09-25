import { internalMutation, internalQuery, mutation, query, MutationCtx } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { getHiddenUserIds } from './blocks';
import { rateLimiter } from './lib/rateLimit';
import { requireUser } from './lib/session';

// Bumped by any mutation representing real user interest — likes, comments,
// bookmarks, and completed watches (see impressions.ts) — and read by
// convex/lib/coldStart.ts to smoothly ramp personalization in over a user's
// first ~100 meaningful interactions rather than jumping at a hard cutoff.
// Exported (not internal) so sibling modules across the app can call it
// directly without a function-call round trip.
export async function bumpMeaningfulInteraction(
  ctx: MutationCtx,
  userId: Id<'users'>,
  by: number = 1
) {
  const user = await ctx.db.get(userId);
  if (!user) return;
  await ctx.db.patch(userId, {
    meaningfulInteractionCount: (user.meaningfulInteractionCount ?? 0) + by,
  });
}

export const getByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();
  },
});

export const getByUsername = internalQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    return await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', username))
      .unique();
  },
});

export const insertUser = internalMutation({
  args: { email: v.string(), passwordHash: v.string() },
  handler: async (ctx, { email, passwordHash }) => {
    return await ctx.db.insert('users', {
      email,
      passwordHash,
      onboardingComplete: false,
    });
  },
});

// Mints the session row for a userId that auth.ts has already password-
// verified — called from the login/register actions (which run in the
// node runtime for bcrypt and so can't touch the database directly).
export const createSession = internalMutation({
  args: { userId: v.id('users'), token: v.string(), expiresAt: v.number() },
  handler: async (ctx, { userId, token, expiresAt }) => {
    await ctx.db.insert('userSessions', { userId, token, createdAt: Date.now(), expiresAt });
  },
});

export const deleteSession = mutation({
  args: { token: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query('userSessions')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (session) await ctx.db.delete(session._id);
  },
});

export const isUsernameAvailable = query({
  // sessionToken: unused here, but accepted so this can be called through
  // the same useAuthedQuery wrapper every other query goes through — every
  // client call site injects it unconditionally, so functions that don't
  // need it (this one runs pre-login, during username picking) just ignore
  // it rather than needing a special-cased unwrapped call.
  args: { username: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { username }) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', username))
      .unique();
    return existing === null;
  },
});

export const generateUploadUrl = mutation({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    await rateLimiter.limit(ctx, 'generateUploadUrl', { key: userId, throws: true });
    return await ctx.storage.generateUploadUrl();
  },
});

export const completeOnboarding = mutation({
  args: {
    userId: v.id('users'),
    name: v.string(),
    username: v.string(),
    dateOfBirth: v.string(),
    avatarGradient: v.array(v.string()),
    avatarStorageId: v.optional(v.id('_storage')),
    // ISO-639-1, read from the device locale client-side (see
    // deviceInfo.ts's getDeviceLanguage) — the initial value for
    // users.language, seeded once at signup and changeable in Settings
    // afterward. Never overwrites an already-set language (e.g. re-running
    // onboarding after an account switch).
    deviceLanguage: v.optional(v.string()),
    sessionToken: v.string(),
  },
  handler: async (
    ctx,
    { userId, name, username, dateOfBirth, avatarGradient, avatarStorageId, deviceLanguage, sessionToken }
  ) => {
    await requireUser(ctx, userId, sessionToken);

    const existing = await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', username))
      .unique();
    if (existing && existing._id !== userId) {
      throw new ConvexError('That username is already taken.');
    }

    const current = await ctx.db.get(userId);

    await ctx.db.patch(userId, {
      name,
      username,
      dateOfBirth,
      avatarGradient,
      avatarStorageId,
      onboardingComplete: true,
      ...(deviceLanguage && !current?.language ? { language: deviceLanguage } : {}),
    });
  },
});

// Editing an already-onboarded profile — same username-uniqueness check as
// completeOnboarding, but scoped to this one user's own account rather than
// the full name/username/dob/avatar bundle collected at signup. Avatar is
// optional per-call: omitting avatarStorageId leaves the current avatar (or
// gradient fallback) untouched rather than clearing it.
export const updateProfile = mutation({
  args: {
    userId: v.id('users'),
    name: v.string(),
    username: v.string(),
    avatarStorageId: v.optional(v.id('_storage')),
    bio: v.optional(v.string()),
    pronouns: v.optional(v.string()),
    link: v.optional(v.string()),
    sessionToken: v.string(),
  },
  handler: async (ctx, { userId, name, username, avatarStorageId, bio, pronouns, link, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new ConvexError('Name can\'t be empty.');
    }

    const existing = await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', username))
      .unique();
    if (existing && existing._id !== userId) {
      throw new ConvexError('That username is already taken.');
    }

    await ctx.db.patch(userId, {
      name: trimmedName,
      username,
      ...(avatarStorageId ? { avatarStorageId } : {}),
      // Empty string clears a field.
      ...(bio !== undefined ? { bio: bio.trim().slice(0, 150) || undefined } : {}),
      ...(pronouns !== undefined ? { pronouns: pronouns.trim().slice(0, 30) || undefined } : {}),
      ...(link !== undefined ? { link: link.trim().slice(0, 100) || undefined } : {}),
    });
  },
});

// A short, curated list rather than the full ISO-639-1 table — covers the
// languages this product's content-language heuristics (see
// convex/lib/language.ts) can actually recognize today. The picker isn't
// restricted to these codes on the client, but they're what shows by
// default.
export const COMMON_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pl', label: 'Polish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'ru', label: 'Russian' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
];

export const listCommonLanguages = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async () => COMMON_LANGUAGES,
});

export const setLanguage = mutation({
  args: {
    userId: v.id('users'),
    language: v.string(),
    spokenLanguages: v.optional(v.array(v.string())),
    sessionToken: v.string(),
  },
  handler: async (ctx, { userId, language, spokenLanguages, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    await ctx.db.patch(userId, { language, spokenLanguages });
  },
});

// Anyone can look up anyone here (it backs every profile view), so this
// returns the public shape explicitly rather than spreading the row —
// email, IP history and moderation state are for the Information page, which
// is gated behind an unlocked moderator session.
export const getUser = query({
  // Deliberately public (see comment above) — sessionToken is accepted and
  // ignored, same reasoning as isUsernameAvailable above.
  args: { userId: v.id('users'), viewerId: v.optional(v.id('users')), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId, viewerId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;

    // A block hides everything about this account from the other side — no
    // avatar, no name, no bio — except the bare fact that it's blocked.
    if (viewerId && viewerId !== userId) {
      const hidden = await getHiddenUserIds(ctx, viewerId);
      if (hidden.has(userId)) {
        const blockedByMe = await ctx.db
          .query('blocks')
          .withIndex('by_blocker_blocked', (q) => q.eq('blockerId', viewerId).eq('blockedId', userId))
          .unique();
        return {
          _id: user._id,
          _creationTime: user._creationTime,
          name: undefined,
          username: user.username,
          bio: undefined,
          pronouns: undefined,
          link: undefined,
          avatarGradient: undefined,
          avatarStorageId: undefined,
          onboardingComplete: user.onboardingComplete,
          isVerified: false,
          avatarUrl: null,
          hideAiContent: false,
          isBlocked: true,
          blockedByMe: blockedByMe !== null,
        };
      }
    }

    const avatarUrl = user.avatarStorageId
      ? await ctx.storage.getUrl(user.avatarStorageId)
      : null;
    return {
      _id: user._id,
      _creationTime: user._creationTime,
      name: user.name,
      username: user.username,
      bio: user.bio,
      pronouns: user.pronouns,
      link: user.link,
      avatarGradient: user.avatarGradient,
      avatarStorageId: user.avatarStorageId,
      onboardingComplete: user.onboardingComplete,
      isVerified: user.isVerified ?? false,
      avatarUrl,
      hideAiContent: user.hideAiContent ?? false,
      // Not sensitive on its own (see AGENTS.md section 2/26 — language is
      // never used to infer sensitive attributes), so it's fine to return
      // generally like hideAiContent above. Exact coordinates (lat/lng)
      // deliberately never appear in this public shape.
      language: user.language ?? null,
      spokenLanguages: user.spokenLanguages ?? [],
      discoverable: user.discoverable ?? true,
      isBlocked: false,
      blockedByMe: false,
    };
  },
});

export const setDiscoverable = mutation({
  args: { userId: v.id('users'), discoverable: v.boolean(), sessionToken: v.string() },
  handler: async (ctx, { userId, discoverable, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    await ctx.db.patch(userId, { discoverable });
  },
});

export const setHideAiContent = mutation({
  args: { userId: v.id('users'), hideAiContent: v.boolean(), sessionToken: v.string() },
  handler: async (ctx, { userId, hideAiContent, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    await ctx.db.patch(userId, { hideAiContent });
  },
});

// Summaries for the account switcher — one or more saved logins on this device.
export const getUsersByIds = query({
  args: { userIds: v.array(v.id('users')), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userIds }) => {
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    return await Promise.all(
      users.filter((user): user is NonNullable<typeof user> => user !== null).map(async (user) => ({
        _id: user._id,
        name: user.name,
        username: user.username,
        avatarGradient: user.avatarGradient,
        avatarUrl: user.avatarStorageId ? await ctx.storage.getUrl(user.avatarStorageId) : null,
        isVerified: user.isVerified ?? false,
      }))
    );
  },
});
