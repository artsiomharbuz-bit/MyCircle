/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ads from "../ads.js";
import type * as affinity from "../affinity.js";
import type * as auth from "../auth.js";
import type * as blocks from "../blocks.js";
import type * as bookmarks from "../bookmarks.js";
import type * as circles from "../circles.js";
import type * as comments from "../comments.js";
import type * as engagement from "../engagement.js";
import type * as follows from "../follows.js";
import type * as groups from "../groups.js";
import type * as impressions from "../impressions.js";
import type * as languageDetection from "../languageDetection.js";
import type * as lib___tests___extResolve from "../lib/__tests__/extResolve.js";
import type * as lib_affinity from "../lib/affinity.js";
import type * as lib_coldStart from "../lib/coldStart.js";
import type * as lib_diversity from "../lib/diversity.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_language from "../lib/language.js";
import type * as lib_locations from "../lib/locations.js";
import type * as lib_quality from "../lib/quality.js";
import type * as lib_rankingConfig from "../lib/rankingConfig.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_session from "../lib/session.js";
import type * as lib_social from "../lib/social.js";
import type * as lib_sound from "../lib/sound.js";
import type * as lib_textSearch from "../lib/textSearch.js";
import type * as lib_timeDecay from "../lib/timeDecay.js";
import type * as lib_ucb from "../lib/ucb.js";
import type * as likes from "../likes.js";
import type * as messages from "../messages.js";
import type * as moderation from "../moderation.js";
import type * as moderationAuth from "../moderationAuth.js";
import type * as notifications from "../notifications.js";
import type * as polls from "../polls.js";
import type * as posts from "../posts.js";
import type * as search from "../search.js";
import type * as sounds from "../sounds.js";
import type * as stickers from "../stickers.js";
import type * as stories from "../stories.js";
import type * as typing from "../typing.js";
import type * as userCircles from "../userCircles.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ads: typeof ads;
  affinity: typeof affinity;
  auth: typeof auth;
  blocks: typeof blocks;
  bookmarks: typeof bookmarks;
  circles: typeof circles;
  comments: typeof comments;
  engagement: typeof engagement;
  follows: typeof follows;
  groups: typeof groups;
  impressions: typeof impressions;
  languageDetection: typeof languageDetection;
  "lib/__tests__/extResolve": typeof lib___tests___extResolve;
  "lib/affinity": typeof lib_affinity;
  "lib/coldStart": typeof lib_coldStart;
  "lib/diversity": typeof lib_diversity;
  "lib/geo": typeof lib_geo;
  "lib/language": typeof lib_language;
  "lib/locations": typeof lib_locations;
  "lib/quality": typeof lib_quality;
  "lib/rankingConfig": typeof lib_rankingConfig;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/session": typeof lib_session;
  "lib/social": typeof lib_social;
  "lib/sound": typeof lib_sound;
  "lib/textSearch": typeof lib_textSearch;
  "lib/timeDecay": typeof lib_timeDecay;
  "lib/ucb": typeof lib_ucb;
  likes: typeof likes;
  messages: typeof messages;
  moderation: typeof moderation;
  moderationAuth: typeof moderationAuth;
  notifications: typeof notifications;
  polls: typeof polls;
  posts: typeof posts;
  search: typeof search;
  sounds: typeof sounds;
  stickers: typeof stickers;
  stories: typeof stories;
  typing: typeof typing;
  userCircles: typeof userCircles;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
