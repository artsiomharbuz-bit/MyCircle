-- Generated from convex/schema.ts for the Supabase migration.
-- RLS is enabled; add least-privilege policies and RPC functions before granting client access.
create extension if not exists pgcrypto;

create table if not exists public."users" (
  "id" text primary key default 'users:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "email" text not null,
  "passwordHash" text not null,
  "name" text,
  "username" text,
  "dateOfBirth" text,
  "avatarGradient" jsonb,
  "avatarStorageId" text,
  "bannerStorageId" text,
  "bio" text,
  "pronouns" text,
  "link" text,
  "onboardingComplete" boolean not null,
  "role" text,
  "isVerified" boolean,
  "strikeCount" double precision,
  "restrictedUntil" double precision,
  "bannedUntil" double precision,
  "registrationIp" text,
  "lastSeenIp" text,
  "lastSeenAt" double precision,
  "location" text,
  "hideAiContent" boolean,
  "language" text,
  "spokenLanguages" jsonb,
  "lat" double precision,
  "lng" double precision,
  "meaningfulInteractionCount" double precision,
  "discoverable" boolean
);
alter table public."users" enable row level security;
create index if not exists "users_by_role" on public."users" ("role");
create index if not exists "users_by_username" on public."users" ("username");
create index if not exists "users_by_email" on public."users" ("email");
create unique index if not exists "users_email_unique" on public."users" ("email");
create unique index if not exists "users_username_unique"
  on public."users" ("username") where "username" is not null;

create table if not exists public."reports" (
  "id" text primary key default 'reports:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "kind" text not null,
  "postId" text,
  "soundId" text,
  "targetUserId" text not null,
  "reporterId" text not null,
  "reason" text not null,
  "evidenceStorageId" text,
  "status" text not null,
  "claimedByModId" text,
  "claimedAt" double precision,
  "resolution" text,
  "resolvedByModId" text,
  "resolvedAt" double precision
);
alter table public."reports" enable row level security;
create index if not exists "reports_by_reporter" on public."reports" ("reporterId");
create index if not exists "reports_by_sound" on public."reports" ("soundId");
create index if not exists "reports_by_post" on public."reports" ("postId");
create index if not exists "reports_by_target" on public."reports" ("targetUserId");
create index if not exists "reports_by_status" on public."reports" ("status");

create table if not exists public."modLogs" (
  "id" text primary key default 'modLogs:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "targetUserId" text not null,
  "actorId" text not null,
  "action" text not null,
  "detail" text,
  "durationLabel" text,
  "postId" text,
  "soundId" text
);
alter table public."modLogs" enable row level security;
create index if not exists "modLogs_by_target" on public."modLogs" ("targetUserId");

create table if not exists public."modSessions" (
  "id" text primary key default 'modSessions:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "userId" text not null,
  "token" text not null,
  "expiresAt" double precision not null
);
alter table public."modSessions" enable row level security;
create index if not exists "modSessions_by_user" on public."modSessions" ("userId");
create index if not exists "modSessions_by_token" on public."modSessions" ("token");

create table if not exists public."userAlerts" (
  "id" text primary key default 'userAlerts:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "userId" text not null,
  "actorId" text not null,
  "type" text not null,
  "message" text not null,
  "acknowledged" boolean not null
);
alter table public."userAlerts" enable row level security;
create index if not exists "userAlerts_by_user" on public."userAlerts" ("userId");

create table if not exists public."posts" (
  "id" text primary key default 'posts:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "authorId" text not null,
  "title" text,
  "caption" text,
  "mediaStorageId" text not null,
  "mediaType" text not null,
  "extraMediaStorageIds" jsonb,
  "mediaAspect" double precision,
  "audience" text not null,
  "circleIds" jsonb,
  "kind" text,
  "containsAi" boolean,
  "textOverlay" jsonb,
  "soundId" text,
  "soundVolume" double precision,
  "originalVolume" double precision,
  "audioMode" text,
  "isAd" boolean,
  "remixOfPostId" text,
  "remixColor" text,
  "hashtags" jsonb,
  "language" text,
  "languageConfidence" double precision,
  "languageSource" text,
  "subtitleLanguages" jsonb,
  "expiresAt" double precision,
  "poll" jsonb,
  "transcript" text,
  "subtitleText" text
);
alter table public."posts" enable row level security;
create index if not exists "posts_by_kind_language" on public."posts" ("kind", "language");
create index if not exists "posts_by_sound" on public."posts" ("soundId");
create index if not exists "posts_by_author" on public."posts" ("authorId");

create table if not exists public."sounds" (
  "id" text primary key default 'sounds:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "ownerId" text not null,
  "name" text not null,
  "pictureStorageId" text,
  "audioStorageId" text not null,
  "audioIsVideo" boolean not null,
  "originPostId" text,
  "isGlobal" boolean not null,
  "useCount" double precision not null,
  "status" text not null
);
alter table public."sounds" enable row level security;
create index if not exists "sounds_by_origin_post" on public."sounds" ("originPostId");
create index if not exists "sounds_by_status_global_useCount" on public."sounds" ("status", "isGlobal", "useCount");
create index if not exists "sounds_by_owner" on public."sounds" ("ownerId");

create table if not exists public."savedSounds" (
  "id" text primary key default 'savedSounds:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "userId" text not null,
  "soundId" text not null
);
alter table public."savedSounds" enable row level security;
create index if not exists "savedSounds_by_user" on public."savedSounds" ("userId");
create index if not exists "savedSounds_by_user_sound" on public."savedSounds" ("userId", "soundId");

create table if not exists public."follows" (
  "id" text primary key default 'follows:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "followerId" text not null,
  "followingId" text not null
);
alter table public."follows" enable row level security;
create index if not exists "follows_by_following" on public."follows" ("followingId");
create index if not exists "follows_by_follower_following" on public."follows" ("followerId", "followingId");

create table if not exists public."blocks" (
  "id" text primary key default 'blocks:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "blockerId" text not null,
  "blockedId" text not null
);
alter table public."blocks" enable row level security;
create index if not exists "blocks_by_blocked" on public."blocks" ("blockedId");
create index if not exists "blocks_by_blocker" on public."blocks" ("blockerId");
create index if not exists "blocks_by_blocker_blocked" on public."blocks" ("blockerId", "blockedId");

create table if not exists public."likes" (
  "id" text primary key default 'likes:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "postId" text not null,
  "userId" text not null
);
alter table public."likes" enable row level security;
create index if not exists "likes_by_user" on public."likes" ("userId");
create index if not exists "likes_by_post_user" on public."likes" ("postId", "userId");
create index if not exists "likes_by_post" on public."likes" ("postId");

create table if not exists public."comments" (
  "id" text primary key default 'comments:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "postId" text not null,
  "authorId" text not null,
  "text" text not null,
  "stickerId" text,
  "parentCommentId" text,
  "replyToUserId" text
);
alter table public."comments" enable row level security;
create index if not exists "comments_by_reply_to_user" on public."comments" ("replyToUserId");
create index if not exists "comments_by_post" on public."comments" ("postId");

create table if not exists public."commentLikes" (
  "id" text primary key default 'commentLikes:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "commentId" text not null,
  "userId" text not null
);
alter table public."commentLikes" enable row level security;
create index if not exists "commentLikes_by_comment_user" on public."commentLikes" ("commentId", "userId");
create index if not exists "commentLikes_by_comment" on public."commentLikes" ("commentId");

create table if not exists public."storyLikes" (
  "id" text primary key default 'storyLikes:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "storyId" text not null,
  "userId" text not null
);
alter table public."storyLikes" enable row level security;
create index if not exists "storyLikes_by_story_user" on public."storyLikes" ("storyId", "userId");
create index if not exists "storyLikes_by_story" on public."storyLikes" ("storyId");

create table if not exists public."bookmarks" (
  "id" text primary key default 'bookmarks:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "postId" text not null,
  "userId" text not null
);
alter table public."bookmarks" enable row level security;
create index if not exists "bookmarks_by_user" on public."bookmarks" ("userId");
create index if not exists "bookmarks_by_post_user" on public."bookmarks" ("postId", "userId");

create table if not exists public."pollVotes" (
  "id" text primary key default 'pollVotes:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "postId" text not null,
  "userId" text not null,
  "optionIndex" double precision not null,
  "votedAt" double precision not null
);
alter table public."pollVotes" enable row level security;
create index if not exists "pollVotes_by_post" on public."pollVotes" ("postId");
create index if not exists "pollVotes_by_post_user" on public."pollVotes" ("postId", "userId");

create table if not exists public."postShares" (
  "id" text primary key default 'postShares:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "postId" text not null,
  "sharerId" text not null,
  "sharedAt" double precision not null
);
alter table public."postShares" enable row level security;
create index if not exists "postShares_by_post" on public."postShares" ("postId");

create table if not exists public."messages" (
  "id" text primary key default 'messages:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "conversationId" text not null,
  "senderId" text not null,
  "recipientId" text not null,
  "text" text not null,
  "sharedPostId" text,
  "circleInviteId" text,
  "groupInviteId" text,
  "stickerId" text,
  "mediaStorageId" text,
  "mediaType" text
);
alter table public."messages" enable row level security;
create index if not exists "messages_by_recipient" on public."messages" ("recipientId");
create index if not exists "messages_by_sender" on public."messages" ("senderId");
create index if not exists "messages_by_conversation" on public."messages" ("conversationId");

create table if not exists public."messageClears" (
  "id" text primary key default 'messageClears:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "conversationId" text not null,
  "userId" text not null,
  "clearedAt" double precision not null
);
alter table public."messageClears" enable row level security;
create index if not exists "messageClears_by_conversation_user" on public."messageClears" ("conversationId", "userId");

create table if not exists public."groupChats" (
  "id" text primary key default 'groupChats:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "creatorId" text not null,
  "name" text not null
);
alter table public."groupChats" enable row level security;
create index if not exists "groupChats_by_creator" on public."groupChats" ("creatorId");

create table if not exists public."groupMemberships" (
  "id" text primary key default 'groupMemberships:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "groupId" text not null,
  "userId" text not null,
  "status" text not null
);
alter table public."groupMemberships" enable row level security;
create index if not exists "groupMemberships_by_group_user" on public."groupMemberships" ("groupId", "userId");
create index if not exists "groupMemberships_by_user" on public."groupMemberships" ("userId");
create index if not exists "groupMemberships_by_group" on public."groupMemberships" ("groupId");

create table if not exists public."groupMessages" (
  "id" text primary key default 'groupMessages:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "groupId" text not null,
  "senderId" text not null,
  "text" text not null,
  "stickerId" text,
  "mediaStorageId" text,
  "mediaType" text
);
alter table public."groupMessages" enable row level security;
create index if not exists "groupMessages_by_sender" on public."groupMessages" ("senderId");
create index if not exists "groupMessages_by_group" on public."groupMessages" ("groupId");

create table if not exists public."stickers" (
  "id" text primary key default 'stickers:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "ownerId" text not null,
  "name" text not null,
  "imageStorageId" text not null
);
alter table public."stickers" enable row level security;
create index if not exists "stickers_by_name" on public."stickers" ("name");
create index if not exists "stickers_by_owner" on public."stickers" ("ownerId");

create table if not exists public."savedStickers" (
  "id" text primary key default 'savedStickers:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "userId" text not null,
  "stickerId" text not null
);
alter table public."savedStickers" enable row level security;
create index if not exists "savedStickers_by_user" on public."savedStickers" ("userId");
create index if not exists "savedStickers_by_user_sticker" on public."savedStickers" ("userId", "stickerId");

create table if not exists public."typing" (
  "id" text primary key default 'typing:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "senderId" text not null,
  "recipientId" text not null,
  "isTyping" boolean not null
);
alter table public."typing" enable row level security;
create index if not exists "typing_by_recipient" on public."typing" ("recipientId");
create index if not exists "typing_by_sender_recipient" on public."typing" ("senderId", "recipientId");

create table if not exists public."userSessions" (
  "id" text primary key default 'userSessions:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "userId" text not null,
  "token" text not null,
  "createdAt" double precision not null,
  "expiresAt" double precision not null
);
alter table public."userSessions" enable row level security;
create index if not exists "userSessions_by_user" on public."userSessions" ("userId");
create index if not exists "userSessions_by_token" on public."userSessions" ("token");

create table if not exists public."reads" (
  "id" text primary key default 'reads:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "conversationId" text not null,
  "userId" text not null,
  "lastReadAt" double precision not null
);
alter table public."reads" enable row level security;
create index if not exists "reads_by_conversation_user" on public."reads" ("conversationId", "userId");

create table if not exists public."notificationClears" (
  "id" text primary key default 'notificationClears:' || gen_random_uuid()::text,
  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "userId" text not null,
  "clearedAt" double precision not null
);
alter table public."notificationClears" enable row level security;
create index if not exists "notificationClears_by_user" on public."notificationClears" ("userId");

create table if not exists public."notificationReads" (
  "id" text primary key default gen_random_uuid()::text,
  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "userId" text not null,
  "lastSeenAt" double precision not null
);
alter table public."notificationReads" enable row level security;
create index if not exists "notificationReads_by_user" on public."notificationReads" ("userId");

create table if not exists public."circleReads" (
  "id" text primary key default 'circleReads:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "userId" text not null,
  "circleId" text not null,
  "lastViewedAt" double precision not null
);
alter table public."circleReads" enable row level security;
create index if not exists "circleReads_by_user_circle" on public."circleReads" ("userId", "circleId");

create table if not exists public."userCircles" (
  "id" text primary key default 'userCircles:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "ownerId" text not null,
  "name" text not null,
  "color" text not null,
  "sortOrder" double precision
);
alter table public."userCircles" enable row level security;
create index if not exists "userCircles_by_owner" on public."userCircles" ("ownerId");

create table if not exists public."circleMemberships" (
  "id" text primary key default 'circleMemberships:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "circleId" text not null,
  "userId" text not null,
  "status" text not null
);
alter table public."circleMemberships" enable row level security;
create index if not exists "circleMemberships_by_circle_user" on public."circleMemberships" ("circleId", "userId");
create index if not exists "circleMemberships_by_user" on public."circleMemberships" ("userId");
create index if not exists "circleMemberships_by_circle" on public."circleMemberships" ("circleId");

create table if not exists public."stories" (
  "id" text primary key default 'stories:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "authorId" text not null,
  "mediaStorageId" text not null,
  "mediaType" text not null,
  "circleId" text,
  "circleIds" jsonb,
  "textOverlay" jsonb,
  "remixOfPostId" text,
  "remixColor" text
);
alter table public."stories" enable row level security;
create index if not exists "stories_by_author" on public."stories" ("authorId");

create table if not exists public."highlights" (
  "id" text primary key default 'highlights:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "ownerId" text not null,
  "name" text not null,
  "coverStorageId" text not null,
  "sortOrder" double precision
);
alter table public."highlights" enable row level security;
create index if not exists "highlights_by_owner" on public."highlights" ("ownerId");

create table if not exists public."highlightItems" (
  "id" text primary key default 'highlightItems:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "highlightId" text not null,
  "mediaStorageId" text not null,
  "mediaType" text not null,
  "textOverlay" jsonb,
  "sourceStoryId" text,
  "sortOrder" double precision not null
);
alter table public."highlightItems" enable row level security;
create index if not exists "highlightItems_by_highlight" on public."highlightItems" ("highlightId");

create table if not exists public."ads" (
  "id" text primary key default 'ads:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "postId" text not null,
  "creatorId" text not null,
  "kind" text not null,
  "link" text not null,
  "buttonText" text not null,
  "buttonColor" text not null,
  "displayName" text not null,
  "displayAvatarStorageId" text,
  "displayAvatarGradient" jsonb,
  "status" text not null,
  "rejectionReason" text,
  "reviewedByModId" text,
  "reviewedAt" double precision,
  "billingPlan" text,
  "activeUntil" double precision,
  "views" double precision,
  "clicks" double precision,
  "targetLocations" jsonb,
  "targetGeo" jsonb,
  "targetLanguages" jsonb
);
alter table public."ads" enable row level security;
create index if not exists "ads_by_post" on public."ads" ("postId");
create index if not exists "ads_by_status" on public."ads" ("status");
create index if not exists "ads_by_creator" on public."ads" ("creatorId");

create table if not exists public."adImpressions" (
  "id" text primary key default 'adImpressions:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "adId" text not null,
  "userId" text not null,
  "shownAt" double precision not null,
  "clicked" boolean not null,
  "clickAt" double precision
);
alter table public."adImpressions" enable row level security;
create index if not exists "adImpressions_by_ad_user" on public."adImpressions" ("adId", "userId");
create index if not exists "adImpressions_by_user" on public."adImpressions" ("userId");
create index if not exists "adImpressions_by_ad" on public."adImpressions" ("adId");

create table if not exists public."contentImpressions" (
  "id" text primary key default 'contentImpressions:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "userId" text not null,
  "postId" text not null,
  "kind" text not null,
  "shownAt" double precision not null,
  "watchMs" double precision,
  "duration" double precision,
  "completed" boolean,
  "sessionId" text,
  "cluster" text,
  "rankingVersion" text
);
alter table public."contentImpressions" enable row level security;
create index if not exists "contentImpressions_by_user_session" on public."contentImpressions" ("userId", "sessionId");
create index if not exists "contentImpressions_by_user_post" on public."contentImpressions" ("userId", "postId");
create index if not exists "contentImpressions_by_post" on public."contentImpressions" ("postId");
create index if not exists "contentImpressions_by_user" on public."contentImpressions" ("userId");

create table if not exists public."soundUsageEvents" (
  "id" text primary key default 'soundUsageEvents:' || gen_random_uuid()::text,
  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "soundId" text not null,
  "userId" text not null,
  "postId" text,
  "usedAt" double precision not null
);
alter table public."soundUsageEvents" enable row level security;
create index if not exists "soundUsageEvents_by_sound" on public."soundUsageEvents" ("soundId");

create table if not exists public."searchQueries" (
  "id" text primary key default gen_random_uuid()::text,
  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "userId" text not null,
  "normalizedTerm" text not null,
  "timestamp" double precision not null
);
alter table public."searchQueries" enable row level security;
create index if not exists "searchQueries_by_term" on public."searchQueries" ("normalizedTerm");
create index if not exists "searchQueries_by_user" on public."searchQueries" ("userId");

create table if not exists public."adNotifications" (
  "id" text primary key default 'adNotifications:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "userId" text not null,
  "adId" text not null,
  "status" text not null,
  "message" text
);
alter table public."adNotifications" enable row level security;
create index if not exists "adNotifications_by_user" on public."adNotifications" ("userId");

create table if not exists public."pushTokens" (
  "id" text primary key default 'pushTokens:' || gen_random_uuid()::text,  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "userId" text not null,
  "token" text not null,
  "platform" text,
  "updatedAt" double precision not null
);
alter table public."pushTokens" enable row level security;
create index if not exists "pushTokens_by_token" on public."pushTokens" ("token");
create index if not exists "pushTokens_by_user" on public."pushTokens" ("userId");


-- The app still uses its existing password and session flow, stored server-side.
-- These tables are only accessed by the Edge Function service role; RLS stays on.
create table if not exists public."rateLimits" (
  "id" text primary key default 'rateLimits:' || gen_random_uuid()::text,
  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "bucketKey" text not null,
  "windowStart" double precision not null,
  "count" integer not null default 0
);
alter table public."rateLimits" enable row level security;
create unique index if not exists "rateLimits_by_bucketKey" on public."rateLimits" ("bucketKey");

create table if not exists public."scheduledTasks" (
  "id" text primary key default 'scheduledTasks:' || gen_random_uuid()::text,
  "_creationTime" double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  "functionName" text not null,
  "args" jsonb not null,
  "runAt" double precision not null
);
alter table public."scheduledTasks" enable row level security;
create index if not exists "scheduledTasks_by_runAt" on public."scheduledTasks" ("runAt");

create or replace function public.consume_rate_limit(
  p_bucket_key text, p_limit integer, p_window_ms double precision
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  current_window double precision;
  current_count integer;
begin
  current_window := floor((extract(epoch from clock_timestamp()) * 1000) / p_window_ms) * p_window_ms;
  insert into public."rateLimits" ("bucketKey", "windowStart", "count")
  values (p_bucket_key, current_window, 1)
  on conflict ("bucketKey") do update
    set "windowStart" = excluded."windowStart",
        "count" = case when public."rateLimits"."windowStart" = excluded."windowStart"
          then public."rateLimits"."count" + 1 else 1 end
  returning "count" into current_count;
  return current_count <= p_limit;
end;
$$;
revoke all on function public.consume_rate_limit(text, integer, double precision) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, double precision) to service_role;

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;
