import { ConvexError, v } from 'convex/values';
import { mutation, query, QueryCtx } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import { assertCanPublish, isModerator, requireUnlockedModerator } from './moderation';
import { formatEngagement } from './posts';
import { getHiddenUserIds } from './blocks';
import { activePeriodMs, adDailyPrice } from '../adPricing';
import { normalizeLocationName } from './lib/locations';
import { haversineKm } from './lib/geo';
import { userSpokenLanguages } from './lib/language';
import { smoothedRate } from './lib/quality';
import { ADS } from './lib/rankingConfig';
import { rateLimiter } from './lib/rateLimit';
import { requireUser } from './lib/session';
import { sendPush } from './lib/notify';

const adKindValidator = v.union(v.literal('post'), v.literal('clip'));
const billingPlanValidator = v.union(v.literal('daily'), v.literal('monthly'));
const targetGeoValidator = v.object({ lat: v.number(), lng: v.number(), radiusKm: v.number() });

// ---------------------------------------------------------------------------
// Targeting — the single source of truth for eligibility, reused identically
// by actual ad delivery (listActiveAdsForSurface) and audience estimation
// (estimateAdAudience), per AGENTS.md section 17: "the estimate must use the
// same targeting rules as actual eligibility."
// ---------------------------------------------------------------------------
type Targeting = {
  targetLocations?: string[];
  targetGeo?: { lat: number; lng: number; radiusKm: number };
  targetLanguages?: string[];
};

function matchesTargeting(user: Doc<'users'>, targeting: Targeting): boolean {
  if (targeting.targetLanguages && targeting.targetLanguages.length > 0) {
    const userLangs = userSpokenLanguages(user);
    if (!targeting.targetLanguages.some((lang) => userLangs.includes(lang))) return false;
  }

  const hasLocationTargeting =
    (targeting.targetLocations && targeting.targetLocations.length > 0) || !!targeting.targetGeo;
  if (!hasLocationTargeting) return true; // no restriction configured — the product default is "everyone eligible"

  const userCity = user.location ? normalizeLocationName(user.location) : null;
  const cityMatch = !!(
    targeting.targetLocations &&
    userCity &&
    targeting.targetLocations.includes(userCity)
  );
  if (cityMatch) return true;

  if (targeting.targetGeo && user.lat != null && user.lng != null) {
    const distance = haversineKm({ lat: user.lat, lng: user.lng }, targeting.targetGeo);
    if (distance <= targeting.targetGeo.radiusKm) return true;
  }

  // Targeting was configured but this user matched neither mechanism —
  // ineligible. Bid/engagement can never override this (see ranking below,
  // which only ever sorts among already-eligible ads).
  return false;
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

async function formatMyAd(ctx: QueryCtx, ad: Doc<'ads'>) {
  const post = await ctx.db.get(ad.postId);
  return {
    _id: ad._id,
    postId: ad.postId,
    kind: ad.kind,
    status: ad.status,
    rejectionReason: ad.rejectionReason ?? null,
    billingPlan: ad.billingPlan ?? null,
    activeUntil: ad.activeUntil ?? null,
    createdAt: ad._creationTime,
    title: post?.title ?? '',
    caption: post?.caption ?? '',
    mediaType: post?.mediaType ?? 'photo',
    mediaUrl: post ? await ctx.storage.getUrl(post.mediaStorageId) : null,
    link: ad.link,
    buttonText: ad.buttonText,
    buttonColor: ad.buttonColor,
    displayName: ad.displayName,
    displayAvatarUrl: ad.displayAvatarStorageId
      ? await ctx.storage.getUrl(ad.displayAvatarStorageId)
      : null,
    displayAvatarGradient: ad.displayAvatarGradient ?? null,
    views: ad.views ?? 0,
    clicks: ad.clicks ?? 0,
    targetLocations: ad.targetLocations ?? [],
    targetGeo: ad.targetGeo ?? null,
    targetLanguages: ad.targetLanguages ?? [],
  };
}

// ---------------------------------------------------------------------------
// Creation & editing (creator-side)
// ---------------------------------------------------------------------------

export const generateUploadUrl = mutation({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    await rateLimiter.limit(ctx, 'generateUploadUrl', { key: userId, throws: true });
    return await ctx.storage.generateUploadUrl();
  },
});

export const createAd = mutation({
  args: {
    creatorId: v.id('users'),
    sessionToken: v.string(),
    kind: adKindValidator,
    title: v.optional(v.string()),
    caption: v.optional(v.string()),
    mediaStorageId: v.id('_storage'),
    mediaType: v.union(v.literal('photo'), v.literal('video')),
    link: v.string(),
    buttonText: v.string(),
    buttonColor: v.string(),
    displayName: v.string(),
    displayAvatarStorageId: v.optional(v.id('_storage')),
    displayAvatarGradient: v.optional(v.array(v.string())),
    // Raw, advertiser-typed city names — normalized here (once, at write
    // time) so eligibility never has to re-normalize on every feed request.
    targetLocations: v.optional(v.array(v.string())),
    targetGeo: v.optional(targetGeoValidator),
    targetLanguages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.creatorId, args.sessionToken);
    await rateLimiter.limit(ctx, 'createAd', { key: args.creatorId, throws: true });
    await assertCanPublish(ctx, args.creatorId, 'post');

    const link = args.link.trim();
    const buttonText = args.buttonText.trim();
    const displayName = args.displayName.trim();
    if (!link) throw new ConvexError('Add a link for this ad to send people to.');
    if (!buttonText) throw new ConvexError('Give the button some text.');
    if (!displayName) throw new ConvexError('Give this ad a display name.');

    const postId = await ctx.db.insert('posts', {
      authorId: args.creatorId,
      title: args.title?.trim() || undefined,
      caption: args.caption?.trim() || undefined,
      mediaStorageId: args.mediaStorageId,
      mediaType: args.mediaType,
      audience: 'global',
      kind: args.kind,
      isAd: true,
    });

    const normalizedLocations =
      args.targetLocations && args.targetLocations.length > 0
        ? [...new Set(args.targetLocations.map(normalizeLocationName))]
        : undefined;

    const adId = await ctx.db.insert('ads', {
      postId,
      creatorId: args.creatorId,
      kind: args.kind,
      link,
      buttonText,
      buttonColor: args.buttonColor,
      displayName,
      displayAvatarStorageId: args.displayAvatarStorageId,
      displayAvatarGradient: args.displayAvatarGradient,
      status: 'pending_review',
      targetLocations: normalizedLocations,
      targetGeo: args.targetGeo,
      targetLanguages: args.targetLanguages && args.targetLanguages.length > 0 ? args.targetLanguages : undefined,
    });

    return adId;
  },
});

// Only a rejected ad can be edited — editing it resubmits it for review.
export const updateAd = mutation({
  args: {
    adId: v.id('ads'),
    creatorId: v.id('users'),
    title: v.optional(v.string()),
    caption: v.optional(v.string()),
    mediaStorageId: v.optional(v.id('_storage')),
    mediaType: v.optional(v.union(v.literal('photo'), v.literal('video'))),
    link: v.optional(v.string()),
    buttonText: v.optional(v.string()),
    buttonColor: v.optional(v.string()),
    displayName: v.optional(v.string()),
    displayAvatarStorageId: v.optional(v.id('_storage')),
    displayAvatarGradient: v.optional(v.array(v.string())),
    targetLocations: v.optional(v.array(v.string())),
    targetGeo: v.optional(targetGeoValidator),
    targetLanguages: v.optional(v.array(v.string())),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.creatorId, args.sessionToken);

    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.creatorId !== args.creatorId) {
      throw new ConvexError('That ad no longer exists.');
    }
    if (ad.status !== 'rejected') {
      throw new ConvexError('Only a rejected ad can be edited.');
    }

    await assertCanPublish(ctx, args.creatorId, 'post');

    const postPatch: Partial<Doc<'posts'>> = {};
    if (args.title !== undefined) postPatch.title = args.title.trim() || undefined;
    if (args.caption !== undefined) postPatch.caption = args.caption.trim() || undefined;
    if (args.mediaStorageId !== undefined) postPatch.mediaStorageId = args.mediaStorageId;
    if (args.mediaType !== undefined) postPatch.mediaType = args.mediaType;
    if (Object.keys(postPatch).length > 0) {
      await ctx.db.patch(ad.postId, postPatch);
    }

    const adPatch: Partial<Doc<'ads'>> = {
      status: 'pending_review',
      rejectionReason: undefined,
      reviewedByModId: undefined,
      reviewedAt: undefined,
    };
    if (args.link !== undefined) {
      const link = args.link.trim();
      if (!link) throw new ConvexError('Add a link for this ad to send people to.');
      adPatch.link = link;
    }
    if (args.buttonText !== undefined) {
      const buttonText = args.buttonText.trim();
      if (!buttonText) throw new ConvexError('Give the button some text.');
      adPatch.buttonText = buttonText;
    }
    if (args.buttonColor !== undefined) adPatch.buttonColor = args.buttonColor;
    if (args.displayName !== undefined) {
      const displayName = args.displayName.trim();
      if (!displayName) throw new ConvexError('Give this ad a display name.');
      adPatch.displayName = displayName;
    }
    if (args.displayAvatarStorageId !== undefined) {
      adPatch.displayAvatarStorageId = args.displayAvatarStorageId;
    }
    if (args.displayAvatarGradient !== undefined) {
      adPatch.displayAvatarGradient = args.displayAvatarGradient;
    }
    if (args.targetLocations !== undefined) {
      adPatch.targetLocations =
        args.targetLocations.length > 0
          ? [...new Set(args.targetLocations.map(normalizeLocationName))]
          : undefined;
    }
    if (args.targetGeo !== undefined) adPatch.targetGeo = args.targetGeo;
    if (args.targetLanguages !== undefined) {
      adPatch.targetLanguages = args.targetLanguages.length > 0 ? args.targetLanguages : undefined;
    }

    await ctx.db.patch(args.adId, adPatch);
  },
});

export const listMyAds = query({
  args: { creatorId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { creatorId, sessionToken }) => {
    await requireUser(ctx, creatorId, sessionToken);

    const ads = await ctx.db
      .query('ads')
      .withIndex('by_creator', (q) => q.eq('creatorId', creatorId))
      .order('desc')
      .collect();

    return await Promise.all(ads.map((ad) => formatMyAd(ctx, ad)));
  },
});

// ---------------------------------------------------------------------------
// Payment (Stripe integration left for later — this just activates the ad
// immediately, exactly as a successful charge would, so the rest of the
// product can be built and tested end to end before billing is wired in).
// ---------------------------------------------------------------------------

export const payAd = mutation({
  args: { adId: v.id('ads'), creatorId: v.id('users'), plan: billingPlanValidator, sessionToken: v.string() },
  handler: async (ctx, { adId, creatorId, plan, sessionToken }) => {
    await requireUser(ctx, creatorId, sessionToken);

    const ad = await ctx.db.get(adId);
    if (!ad || ad.creatorId !== creatorId) {
      throw new ConvexError('That ad no longer exists.');
    }
    if (ad.status !== 'approved' && ad.status !== 'active' && ad.status !== 'expired') {
      throw new ConvexError('This ad needs to be approved before you can pay for it.');
    }

    // TODO(stripe): replace this with a real charge — this stub assumes
    // payment always succeeds and activates the ad immediately.
    const now = Date.now();
    const base = ad.status === 'active' && ad.activeUntil && ad.activeUntil > now ? ad.activeUntil : now;

    await ctx.db.patch(adId, {
      status: 'active',
      billingPlan: plan,
      activeUntil: base + activePeriodMs(plan),
    });
  },
});

// ---------------------------------------------------------------------------
// Admin review
// ---------------------------------------------------------------------------

export const getPendingAdCount = query({
  args: { modId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { modId, sessionToken }) => {
    await requireUser(ctx, modId, sessionToken);
    const viewer = await ctx.db.get(modId);
    if (!isModerator(viewer)) return 0;

    const pending = await ctx.db
      .query('ads')
      .withIndex('by_status', (q) => q.eq('status', 'pending_review'))
      .collect();
    return pending.length;
  },
});

export const listPendingAds = query({
  args: { modId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { modId, sessionToken }) => {
    await requireUser(ctx, modId, sessionToken);
    const viewer = await ctx.db.get(modId);
    if (!isModerator(viewer)) return [];

    const pending = await ctx.db
      .query('ads')
      .withIndex('by_status', (q) => q.eq('status', 'pending_review'))
      .order('desc')
      .collect();

    return await Promise.all(
      pending.map(async (ad) => {
        const post = await ctx.db.get(ad.postId);
        const creator = await userSummary(ctx, ad.creatorId);
        return {
          _id: ad._id,
          kind: ad.kind,
          createdAt: ad._creationTime,
          displayName: ad.displayName,
          mediaUrl: post ? await ctx.storage.getUrl(post.mediaStorageId) : null,
          mediaType: post?.mediaType ?? 'photo',
          creator,
        };
      })
    );
  },
});

export const getAdForReview = query({
  args: { adId: v.id('ads'), modId: v.id('users'), token: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { adId, modId, token }) => {
    await requireUnlockedModerator(ctx, modId, token);

    const ad = await ctx.db.get(adId);
    if (!ad) return null;
    const post = await ctx.db.get(ad.postId);

    return {
      _id: ad._id,
      kind: ad.kind,
      status: ad.status,
      rejectionReason: ad.rejectionReason ?? null,
      createdAt: ad._creationTime,
      title: post?.title ?? '',
      caption: post?.caption ?? '',
      mediaType: post?.mediaType ?? 'photo',
      mediaUrl: post ? await ctx.storage.getUrl(post.mediaStorageId) : null,
      link: ad.link,
      buttonText: ad.buttonText,
      buttonColor: ad.buttonColor,
      displayName: ad.displayName,
      displayAvatarUrl: ad.displayAvatarStorageId
        ? await ctx.storage.getUrl(ad.displayAvatarStorageId)
        : null,
      displayAvatarGradient: ad.displayAvatarGradient ?? null,
      creatorId: ad.creatorId,
      creator: await userSummary(ctx, ad.creatorId),
    };
  },
});

export const approveAd = mutation({
  args: { adId: v.id('ads'), modId: v.id('users'), token: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { adId, modId, token }) => {
    await requireUnlockedModerator(ctx, modId, token);

    const ad = await ctx.db.get(adId);
    if (!ad) throw new ConvexError('That ad no longer exists.');

    await ctx.db.patch(adId, {
      status: 'approved',
      rejectionReason: undefined,
      reviewedByModId: modId,
      reviewedAt: Date.now(),
    });

    await ctx.db.insert('adNotifications', {
      userId: ad.creatorId,
      adId,
      status: 'approved',
    });
    await sendPush(ctx, ad.creatorId, 'Ad approved', 'Your ad was approved and is ready to run.', {
      type: 'ad_status',
      adId,
    });
  },
});

export const rejectAd = mutation({
  args: { adId: v.id('ads'), modId: v.id('users'), token: v.string(), sessionToken: v.optional(v.string()), reason: v.string() },
  handler: async (ctx, { adId, modId, token, reason }) => {
    await requireUnlockedModerator(ctx, modId, token);

    const trimmed = reason.trim();
    if (!trimmed) throw new ConvexError('Write why this ad is being rejected.');

    const ad = await ctx.db.get(adId);
    if (!ad) throw new ConvexError('That ad no longer exists.');

    await ctx.db.patch(adId, {
      status: 'rejected',
      rejectionReason: trimmed,
      reviewedByModId: modId,
      reviewedAt: Date.now(),
    });

    await ctx.db.insert('adNotifications', {
      userId: ad.creatorId,
      adId,
      status: 'rejected',
      message: trimmed,
    });
    await sendPush(ctx, ad.creatorId, 'Ad rejected', trimmed, { type: 'ad_status', adId });
  },
});

// ---------------------------------------------------------------------------
// Ranking — eCPM(u,a) = Bid(a) * pCTR(u,a) * PacingFactor(a)
//
// This product bills a flat daily/monthly placement fee rather than selling
// impressions directly, so there's no advertiser-set bid or dollar budget to
// pace against. Bid is approximated by the plan's daily rate (a real,
// product-defined value, not an arbitrary constant) — a clip ad "bids"
// higher than a post ad because it costs more, which is a defensible proxy
// until real CPM bidding exists. Pacing correspondingly smooths delivery
// across the *paid time period* rather than a spend rate.
// ---------------------------------------------------------------------------

function pCTR(ad: Doc<'ads'>): number {
  const { alpha, beta } = ADS.ctrPrior;
  return ((ad.clicks ?? 0) + alpha) / ((ad.views ?? 0) + alpha + beta);
}

// Winds delivery down gracefully in the final stretch of a paid period
// instead of ranking identically right up until expiry then vanishing —
// bounded to (0, 1].
function pacingFactor(ad: Doc<'ads'>, now: number): number {
  if (!ad.activeUntil) return 1;
  const remainingHours = Math.max(0, (ad.activeUntil - now) / (1000 * 60 * 60));
  const WIND_DOWN_HOURS = 2;
  return Math.min(1, Math.max(0.1, remainingHours / WIND_DOWN_HOURS));
}

function bidFor(ad: Doc<'ads'>): number {
  return adDailyPrice(ad.kind);
}

// Fatigue (see AGENTS.md section 16): starts from click-through relative to
// exposure over the trailing window, then leans harder on *recent* exposure
// so someone shown the same ad five times today is more fatigued than
// someone shown it five times spread over a month, even at equal CTR.
function computeFatigue(recentImpressions: Doc<'adImpressions'>[]): number {
  if (recentImpressions.length === 0) return 1;
  const clicked = recentImpressions.filter((i) => i.clicked).length;
  const baseFatigue = 1 - clicked / recentImpressions.length;

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const shownToday = recentImpressions.filter((i) => i.shownAt >= dayAgo).length;
  const recencyPenalty = Math.min(0.5, shownToday * 0.05);

  return Math.max(ADS.fatigue.floor, baseFatigue - recencyPenalty);
}

function passesFrequencyCap(
  userImpressions: Doc<'adImpressions'>[],
  adId: Id<'ads'>,
  now: number
): boolean {
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const shownToday = userImpressions.filter((i) => i.shownAt >= dayAgo);
  if (shownToday.length >= ADS.fatigue.perUserDailyCap) return false;

  const shownTodaySameAd = shownToday.filter((i) => i.adId === adId);
  if (shownTodaySameAd.length >= ADS.fatigue.perUserPerAdDailyCap) return false;

  const lastShownSameAd = userImpressions
    .filter((i) => i.adId === adId)
    .sort((a, b) => b.shownAt - a.shownAt)[0];
  if (lastShownSameAd) {
    const hoursSince = (now - lastShownSameAd.shownAt) / (1000 * 60 * 60);
    if (hoursSince < ADS.fatigue.minHoursBetweenSameAd) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Feed injection
// ---------------------------------------------------------------------------

// Every currently-paid-and-running, *eligible* ad of the given kind, ranked
// by eCPM, shaped for the feed. Targeting (language/location — see
// matchesTargeting) is a hard filter applied before any ranking: an ad
// outside its configured targeting never appears here no matter how well it
// would otherwise rank. The creator's REAL identity comes back too (in
// `creator`) — it's only ever shown once someone opens the ad's options
// menu, never in the card itself, which shows the persona
// (displayName/displayAvatar*) instead.
export const listActiveAdsForSurface = query({
  args: { viewerId: v.id('users'), kind: adKindValidator, sessionToken: v.string() },
  handler: async (ctx, { viewerId, kind, sessionToken }) => {
    await requireUser(ctx, viewerId, sessionToken);

    const now = Date.now();
    const viewer = await ctx.db.get(viewerId);
    if (!viewer) return [];

    const active = await ctx.db
      .query('ads')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .take(ADS.candidateLimit);

    const hidden = await getHiddenUserIds(ctx, viewerId);
    const eligible = active.filter(
      (ad) =>
        ad.kind === kind &&
        ad.activeUntil !== undefined &&
        ad.activeUntil > now &&
        !hidden.has(ad.creatorId) &&
        matchesTargeting(viewer, ad)
    );
    if (eligible.length === 0) return [];

    // One bounded read of this viewer's own recent ad exposure, shared
    // across every candidate's frequency/fatigue check below instead of a
    // per-ad query.
    const windowStart = now - ADS.fatigue.windowMs;
    const recentImpressions = (
      await ctx.db
        .query('adImpressions')
        .withIndex('by_user', (q) => q.eq('userId', viewerId))
        .order('desc')
        .take(500)
    ).filter((i) => i.shownAt >= windowStart);

    const withinFrequency = eligible.filter((ad) => passesFrequencyCap(recentImpressions, ad._id, now));
    if (withinFrequency.length === 0) return [];

    const fatigue = computeFatigue(recentImpressions.filter((i) => i.shownAt >= now - 24 * 60 * 60 * 1000 * 30));

    const ranked = withinFrequency
      .map((ad) => ({
        ad,
        eCPM: bidFor(ad) * pCTR(ad) * pacingFactor(ad, now) * fatigue,
      }))
      .sort((a, b) => b.eCPM - a.eCPM)
      .map((r) => r.ad);

    const results = await Promise.all(
      ranked.map(async (ad) => {
        const post = await ctx.db.get(ad.postId);
        if (!post) return null;

        const engagement = await formatEngagement(ctx, post._id, viewerId);
        return {
          _id: ad._id,
          postId: post._id,
          title: post.title,
          caption: post.caption,
          mediaType: post.mediaType,
          mediaUrl: await ctx.storage.getUrl(post.mediaStorageId),
          displayName: ad.displayName,
          displayAvatarUrl: ad.displayAvatarStorageId
            ? await ctx.storage.getUrl(ad.displayAvatarStorageId)
            : null,
          displayAvatarGradient: ad.displayAvatarGradient ?? null,
          buttonText: ad.buttonText,
          buttonColor: ad.buttonColor,
          link: ad.link,
          creator: await userSummary(ctx, ad.creatorId),
          ...engagement,
        };
      })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

// ---------------------------------------------------------------------------
// Audience estimation — same targeting logic as actual delivery (see
// matchesTargeting), applied to a bounded, most-recent-signups sample and
// scaled up when the platform has grown past that sample. Approximate by
// design (see AGENTS.md section 17), never a full-table scan on every
// keystroke of the ad-creation form.
// ---------------------------------------------------------------------------
export const estimateAdAudience = query({
  args: {
    targetLocations: v.optional(v.array(v.string())),
    targetGeo: v.optional(targetGeoValidator),
    targetLanguages: v.optional(v.array(v.string())),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedLocations = args.targetLocations?.map(normalizeLocationName);
    const targeting: Targeting = {
      targetLocations: normalizedLocations,
      targetGeo: args.targetGeo,
      targetLanguages: args.targetLanguages,
    };

    const sample = await ctx.db.query('users').order('desc').take(ADS.audienceEstimateSampleCap);
    const onboarded = sample.filter((u) => u.onboardingComplete);
    const matches = onboarded.filter((u) => matchesTargeting(u, targeting)).length;

    // If the sample was truncated (there are likely more users than we
    // fetched), the ratio observed in the sample is our best estimate of
    // the ratio across everyone — scale the match count up accordingly
    // rather than silently under-reporting reach for a large user base.
    const wasTruncated = sample.length >= ADS.audienceEstimateSampleCap;
    const estimatedUsers = wasTruncated && onboarded.length > 0
      ? Math.round(matches * (sample.length / onboarded.length) * 1)
      : matches;

    return { estimatedUsers, isExact: !wasTruncated, sampledUsers: sample.length };
  },
});

// ---------------------------------------------------------------------------
// Stats — `views`/`clicks` stay as cheap running counters for the creator's
// own dashboard (no dedup by viewer — matches what those numbers mean on
// most self-serve ad tools). Every call also logs a per-user adImpressions
// row, which is what eligibility/ranking above actually reads for
// frequency capping, fatigue, and pCTR.
// ---------------------------------------------------------------------------

export const recordAdView = mutation({
  args: { adId: v.id('ads'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { adId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const ad = await ctx.db.get(adId);
    if (!ad) return;
    await ctx.db.patch(adId, { views: (ad.views ?? 0) + 1 });
    await ctx.db.insert('adImpressions', { adId, userId, shownAt: Date.now(), clicked: false });
  },
});

export const recordAdClick = mutation({
  args: { adId: v.id('ads'), userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { adId, userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);

    const ad = await ctx.db.get(adId);
    if (!ad) return;
    await ctx.db.patch(adId, { clicks: (ad.clicks ?? 0) + 1 });

    const now = Date.now();
    const recent = await ctx.db
      .query('adImpressions')
      .withIndex('by_ad_user', (q) => q.eq('adId', adId).eq('userId', userId))
      .order('desc')
      .first();
    if (recent && !recent.clicked) {
      await ctx.db.patch(recent._id, { clicked: true, clickAt: now });
    } else {
      await ctx.db.insert('adImpressions', { adId, userId, shownAt: now, clicked: true, clickAt: now });
    }
  },
});
