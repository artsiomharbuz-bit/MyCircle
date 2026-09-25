import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    avatarGradient: v.optional(v.array(v.string())),
    avatarStorageId: v.optional(v.id('_storage')),
    // ---- Public profile details (edited in Edit profile) ----
    bio: v.optional(v.string()),
    pronouns: v.optional(v.string()),
    link: v.optional(v.string()),
    onboardingComplete: v.boolean(),

    // ---- Moderation ----
    // Only 'mod' is ever stored. The single Main Admin is identified by
    // username (see MAIN_ADMIN_USERNAME in moderation.ts) rather than by a
    // row value, so the account can never be demoted by a bad write.
    role: v.optional(v.literal('mod')),
    isVerified: v.optional(v.boolean()),
    // 0-3. At 3 the account is banned forever automatically.
    strikeCount: v.optional(v.number()),
    // Epoch ms the sanction expires. FOREVER (-1) never expires.
    // Restricted = can't comment or post; banned = can't use the app at all.
    restrictedUntil: v.optional(v.number()),
    bannedUntil: v.optional(v.number()),
    // Captured client-side (see deviceInfo.ts) — Convex mutations don't see
    // the requesting socket, so the client reports its own network details.
    registrationIp: v.optional(v.string()),
    lastSeenIp: v.optional(v.string()),
    lastSeenAt: v.optional(v.number()),
    location: v.optional(v.string()),

    // ---- Preferences ----
    // Hides posts/clips labeled "Contains AI" from feeds, except this user's
    // own content and content from their friends (mutual follows).
    hideAiContent: v.optional(v.boolean()),

    // ---- Language (see convex/lib/language.ts) ----
    // ISO-639-1. Seeded from the device locale at signup (see
    // deviceInfo.ts/getDeviceLanguage), changeable in Settings. Every ranking
    // surface falls back to a neutral default when this is unset.
    language: v.optional(v.string()),
    // Optional extra languages for bilingual/multilingual users. When empty,
    // `language` alone is the user's spoken-language set.
    spokenLanguages: v.optional(v.array(v.string())),

    // ---- Coarse geolocation (see convex/lib/geo.ts) ----
    // Best-effort, IP-derived (see deviceInfo.ts) — never GPS-precise, and
    // never returned from a public-facing query (see users.getUser).
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),

    // ---- Ranking bookkeeping ----
    // Bumped on likes/comments/shares/saves/watch-completions this user makes
    // (see bumpMeaningfulInteraction in users.ts) — drives the cold-start
    // personalization ramp in convex/lib/rankingConfig.ts.
    meaningfulInteractionCount: v.optional(v.number()),
    // Opt-out of appearing in suggested-users / friend-discovery surfaces.
    // Defaults to true (discoverable) when unset.
    discoverable: v.optional(v.boolean()),
  })
    .index('by_email', ['email'])
    .index('by_username', ['username'])
    .index('by_role', ['role']),

  // One row per submitted report — this *is* the mod inbox. 'open' rows show
  // untouched, 'investigating' shows the yellow label in every mod's inbox
  // (claimedByModId says who opened it), and resolving deletes nothing but
  // flips status to 'resolved', which drops it out of every inbox at once.
  reports: defineTable({
    kind: v.union(v.literal('post'), v.literal('profile'), v.literal('sound')),
    // Set for kind === 'post' only.
    postId: v.optional(v.id('posts')),
    // Set for kind === 'sound' only.
    soundId: v.optional(v.id('sounds')),
    // The post's author, the reported profile, or the sound's owner.
    targetUserId: v.id('users'),
    reporterId: v.id('users'),
    reason: v.string(),
    // Profile reports may attach a screenshot as evidence.
    evidenceStorageId: v.optional(v.id('_storage')),
    status: v.union(
      v.literal('open'),
      v.literal('investigating'),
      v.literal('resolved')
    ),
    claimedByModId: v.optional(v.id('users')),
    claimedAt: v.optional(v.number()),
    resolution: v.optional(v.union(v.literal('deleted'), v.literal('dismissed'))),
    resolvedByModId: v.optional(v.id('users')),
    resolvedAt: v.optional(v.number()),
  })
    .index('by_status', ['status'])
    .index('by_target', ['targetUserId'])
    .index('by_post', ['postId'])
    .index('by_sound', ['soundId']),

  // Append-only audit trail of every moderator action taken against an
  // account or its media — what the "Logs" page on a profile reads.
  modLogs: defineTable({
    targetUserId: v.id('users'),
    actorId: v.id('users'),
    action: v.union(
      v.literal('restrict'),
      v.literal('unrestrict'),
      v.literal('warn'),
      v.literal('ban'),
      v.literal('unban'),
      v.literal('verify'),
      v.literal('unverify'),
      v.literal('strike'),
      v.literal('delete_media'),
      v.literal('delete_sound'),
      v.literal('dismiss_report'),
      v.literal('promote_mod'),
      v.literal('revoke_mod'),
      v.literal('label_ai')
    ),
    // Free text the moderator typed (strike/warn reasons, report reasons).
    detail: v.optional(v.string()),
    // "7 days", "Forever" — only for timed sanctions.
    durationLabel: v.optional(v.string()),
    postId: v.optional(v.id('posts')),
    soundId: v.optional(v.id('sounds')),
  }).index('by_target', ['targetUserId']),

  // A moderator's unlock token, minted by moderation.unlock after they
  // re-enter their account password. The client holds it in memory only, so
  // closing the app loses it and the password is required again — and every
  // moderation mutation validates it server-side, so the gate is real rather
  // than a client-side pretence.
  modSessions: defineTable({
    userId: v.id('users'),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index('by_token', ['token'])
    .index('by_user', ['userId']),

  // Warnings and strikes the user hasn't acknowledged yet — these pop up the
  // next time they open the app, and also render in their notifications.
  userAlerts: defineTable({
    userId: v.id('users'),
    actorId: v.id('users'),
    type: v.union(v.literal('warning'), v.literal('strike')),
    message: v.string(),
    acknowledged: v.boolean(),
  }).index('by_user', ['userId']),

  posts: defineTable({
    authorId: v.id('users'),
    title: v.optional(v.string()),
    caption: v.optional(v.string()),
    mediaStorageId: v.id('_storage'),
    mediaType: v.union(v.literal('photo'), v.literal('video')),
    // Extra pictures after the first, for a swipeable multi-photo post.
    // Photos only, and never on a clip.
    extraMediaStorageIds: v.optional(v.array(v.id('_storage'))),
    // Width / height of the media, so the feed can show a post in the shape it
    // was taken. Missing on older posts (shown square).
    mediaAspect: v.optional(v.number()),
    audience: v.union(v.literal('circles'), v.literal('global')),
    circleIds: v.optional(v.array(v.string())),
    kind: v.optional(v.union(v.literal('post'), v.literal('clip'))),
    // Set from the Options menu in PostDetailsScreen — surfaces a "Contains
    // AI" label wherever this post/clip is shown.
    containsAi: v.optional(v.boolean()),
    // Only set for video posts/clips — a photo's text is burned straight
    // into the uploaded image instead, so it needs no separate overlay data.
    // translate/scale/rotation are normalized to the edited media's own
    // width/height so playback can reproduce the same placement at any size.
    textOverlay: v.optional(
      v.object({
        text: v.string(),
        color: v.string(),
        fontFamily: v.optional(v.string()),
        translateX: v.number(),
        translateY: v.number(),
        scale: v.number(),
        rotation: v.number(),
      })
    ),

    // ---- Sound ----
    soundId: v.optional(v.id('sounds')),
    // 0-1. Only meaningful when soundId is set and mediaType is 'video' —
    // a photo has no audio of its own to weigh against the sound.
    soundVolume: v.optional(v.number()),
    originalVolume: v.optional(v.number()),
    // 'sound-only' mutes this post's own video audio entirely; 'both' plays
    // both tracks at their respective volumes. Undefined means this post's
    // sound *is* its own video audio (the common case — no separate sound
    // was picked, so there's nothing to mix), and it just plays normally.
    audioMode: v.optional(v.union(v.literal('sound-only'), v.literal('both'))),

    // True only for the underlying post/clip behind a row in `ads` — lets it
    // reuse every existing engagement system (likes, comments, bookmarks)
    // while every organic feed/profile/search query filters it out, so it
    // only ever shows up through the ad-injection path once approved & paid.
    isAd: v.optional(v.boolean()),

    // ---- Remix (see convex/posts.ts createRemix) ----
    // A remix always reuses the original clip's own media (never re-uploaded)
    // and is always circle-only — never global — enforced in createRemix.
    remixOfPostId: v.optional(v.id('posts')),
    // The remixed clip's own dominant color (see dominantColor.ts), sampled
    // client-side at remix time and stored so every future render of this
    // remix reuses the same border instead of resampling it.
    remixColor: v.optional(v.string()),

    // ---- Hashtags (see convex/lib/textSearch.ts) ----
    // Extracted + normalized from caption/title at write time (posts.ts).
    hashtags: v.optional(v.array(v.string())),

    // ---- Content language & subtitles (see convex/lib/language.ts) ----
    // Primary spoken/content language, ISO-639-1, or undefined when no
    // reliable signal exists (language-neutral content — music, no speech).
    language: v.optional(v.string()),
    // 0-1 confidence in `language`.
    languageConfidence: v.optional(v.number()),
    // What produced `language`. 'none' means no reliable signal was found —
    // distinct from undefined, which means detection hasn't run at all yet.
    languageSource: v.optional(
      v.union(
        v.literal('speech'),
        v.literal('subtitle'),
        v.literal('caption'),
        v.literal('title'),
        v.literal('ocr'),
        v.literal('creator'),
        v.literal('none')
      )
    ),
    // Separate from `language` — never overwrites it. A clip can be spoken in
    // Polish with English subtitles; both are tracked independently.
    subtitleLanguages: v.optional(v.array(v.string())),

    // ---- Auto-delete (see postExpiry.ts, convex/posts.ts expirePost) ----
    // Only ever set on a circles-audience post/clip — a scheduled function
    // (ctx.scheduler.runAt, fired from createPost) deletes the post at this
    // timestamp. Undefined means "never expires", same as today.
    expiresAt: v.optional(v.number()),

    // ---- Poll (see convex/polls.ts) ----
    // Votes live in the separate `pollVotes` table (one row per voter, so a
    // vote can be changed) rather than as counters here — the question/
    // options themselves are immutable once posted, same as caption/title.
    poll: v.optional(
      v.object({
        question: v.string(),
        options: v.array(v.string()),
      })
    ),
    // Spoken-word transcript, when speech-to-text has run (see
    // convex/languageDetection.ts). Searchable, weighted separately from
    // subtitle text.
    transcript: v.optional(v.string()),
    // Text pulled from an actual subtitle/caption track or OCR'd from
    // burned-in subtitles. Searchable, weighted separately from transcript.
    subtitleText: v.optional(v.string()),
  })
    .index('by_author', ['authorId'])
    .index('by_sound', ['soundId'])
    .index('by_kind_language', ['kind', 'language']),

  // A sound is either "born" from someone's own video (audioStorageId is
  // literally that post's own mediaStorageId, played audio-only wherever the
  // sound is needed — no separate extraction) or uploaded directly from
  // Settings > Sounds (its own independent file). Either way, once attached
  // it can outlive the post it came from.
  sounds: defineTable({
    ownerId: v.id('users'),
    name: v.string(),
    pictureStorageId: v.optional(v.id('_storage')),
    audioStorageId: v.id('_storage'),
    // Whether audioStorageId is a video file (rendered audio-only) or a
    // plain audio file (mp3, etc.) — both play through the same video
    // player either way, this just controls how it's uploaded/labeled.
    audioIsVideo: v.boolean(),
    // The post this sound was auto-created from, if any. Kept even after
    // that post is deleted, purely for "which storage blob is this" bookkeeping
    // (see sharesStorageWithLivePost in posts.ts).
    originPostId: v.optional(v.id('posts')),
    // Private (usable only by its owner) until the origin post/clip is
    // shared globally, or the sound was uploaded directly as global from
    // Settings > Sounds.
    isGlobal: v.boolean(),
    // How many posts/clips currently use this sound — what Trending sorts by.
    useCount: v.number(),
    status: v.union(v.literal('active'), v.literal('deleted')),
  })
    .index('by_owner', ['ownerId'])
    .index('by_status_global_useCount', ['status', 'isGlobal', 'useCount'])
    .index('by_origin_post', ['originPostId']),

  savedSounds: defineTable({
    userId: v.id('users'),
    soundId: v.id('sounds'),
  })
    .index('by_user_sound', ['userId', 'soundId'])
    .index('by_user', ['userId']),

  follows: defineTable({
    followerId: v.id('users'),
    followingId: v.id('users'),
  })
    .index('by_follower_following', ['followerId', 'followingId'])
    .index('by_following', ['followingId']),

  // One row per direction — blockerId never sees blockedId (or vice versa,
  // since every read-side check treats a block as mutual) anywhere in the
  // app: profile, posts, clips, stories, comments. Blocking also tears down
  // any existing follow between the two (see blocks.ts).
  blocks: defineTable({
    blockerId: v.id('users'),
    blockedId: v.id('users'),
  })
    .index('by_blocker_blocked', ['blockerId', 'blockedId'])
    .index('by_blocker', ['blockerId'])
    .index('by_blocked', ['blockedId']),

  likes: defineTable({
    postId: v.id('posts'),
    userId: v.id('users'),
  })
    .index('by_post', ['postId'])
    .index('by_post_user', ['postId', 'userId'])
    .index('by_user', ['userId']),

  comments: defineTable({
    postId: v.id('posts'),
    authorId: v.id('users'),
    text: v.string(),
    stickerId: v.optional(v.id('stickers')),
    // Set on every reply, pointing at the top-level comment its thread
    // belongs to (never another reply) — that's what "View replies" groups
    // by. Only two levels deep: replying to a reply still attaches to the
    // same top-level parentCommentId, just with a different replyToUserId.
    parentCommentId: v.optional(v.id('comments')),
    // Who this reply is addressed to — rendered as "YourName -> RepliedToName".
    replyToUserId: v.optional(v.id('users')),
  }).index('by_post', ['postId']),

  commentLikes: defineTable({
    commentId: v.id('comments'),
    userId: v.id('users'),
  })
    .index('by_comment', ['commentId'])
    .index('by_comment_user', ['commentId', 'userId']),

  storyLikes: defineTable({
    storyId: v.id('stories'),
    userId: v.id('users'),
  })
    .index('by_story', ['storyId'])
    .index('by_story_user', ['storyId', 'userId']),

  bookmarks: defineTable({
    postId: v.id('posts'),
    userId: v.id('users'),
  })
    .index('by_post_user', ['postId', 'userId'])
    .index('by_user', ['userId']),

  // One row per (post, voter) — lets a vote be changed (patched) rather than
  // only ever added, and keeps counting cheap (one indexed query per post)
  // instead of a counter that has to stay in sync by hand.
  pollVotes: defineTable({
    postId: v.id('posts'),
    userId: v.id('users'),
    optionIndex: v.number(),
    votedAt: v.number(),
  })
    .index('by_post_user', ['postId', 'userId'])
    .index('by_post', ['postId']),

  // One row per share — written by messages.sendMessage whenever a message
  // carries a sharedPostId (see SharePostSheet), regardless of how many
  // recipients it's sent to at once. This is the real signal behind pShare
  // in feed/clips ranking (see convex/engagement.ts getRecentEngagementCounts)
  // — previously a hardcoded 0 since nothing tracked shares distinctly from
  // "sent a DM".
  postShares: defineTable({
    postId: v.id('posts'),
    sharerId: v.id('users'),
    sharedAt: v.number(),
  }).index('by_post', ['postId']),

  messages: defineTable({
    // The two participant ids, sorted, joined with ':' — a stable id for the
    // conversation regardless of who sent which message, so the whole thread
    // can be fetched with one indexed query instead of an OR across two.
    conversationId: v.string(),
    senderId: v.id('users'),
    recipientId: v.id('users'),
    // Plain text messages always set this; a shared post/clip or a circle
    // invite sets a placeholder ("Shared a post" / "Circle invite") so
    // conversation previews still read sensibly, alongside sharedPostId /
    // circleInviteId which drive the actual card.
    text: v.string(),
    sharedPostId: v.optional(v.id('posts')),
    circleInviteId: v.optional(v.id('userCircles')),
    // Sent by createGroup for every invitee — renders as a "Join <group>"
    // card in their existing 1:1 thread with whoever created the group,
    // the same way circleInviteId does for circle invites.
    groupInviteId: v.optional(v.id('groupChats')),
    stickerId: v.optional(v.id('stickers')),
    // A directly-attached photo/video (picked from the phone's library, not
    // a shared post) — text carries a placeholder ("Sent a photo") the same
    // way it does for stickers, so previews still read sensibly.
    mediaStorageId: v.optional(v.id('_storage')),
    mediaType: v.optional(v.union(v.literal('photo'), v.literal('video'))),
  })
    .index('by_conversation', ['conversationId'])
    .index('by_sender', ['senderId'])
    .index('by_recipient', ['recipientId']),

  // A per-viewer "Clear chat" cutoff — mirrors notificationClears: nothing
  // is actually deleted, listMessages/listConversations for that viewer
  // just filter out anything at or before clearedAt. The other participant
  // keeps their own full history, matching how "clear chat" behaves in most
  // messaging apps (a per-device reset, not a delete for both sides).
  messageClears: defineTable({
    conversationId: v.string(),
    userId: v.id('users'),
    clearedAt: v.number(),
  }).index('by_conversation_user', ['conversationId', 'userId']),

  // A group chat. Membership (groupMemberships) follows the same
  // invited/joined shape as circleMemberships — the creator joins
  // immediately, everyone else starts 'invited' via a chat invite card
  // (see messages.groupInviteId) and flips to 'joined' when they tap Join.
  // No group photo: the avatar shown everywhere is always the stacked
  // profile pictures of its joined members (see GroupAvatarStack).
  groupChats: defineTable({
    creatorId: v.id('users'),
    name: v.string(),
  }).index('by_creator', ['creatorId']),

  groupMemberships: defineTable({
    groupId: v.id('groupChats'),
    userId: v.id('users'),
    status: v.union(v.literal('invited'), v.literal('joined')),
  })
    .index('by_group', ['groupId'])
    .index('by_user', ['userId'])
    .index('by_group_user', ['groupId', 'userId']),

  groupMessages: defineTable({
    groupId: v.id('groupChats'),
    senderId: v.id('users'),
    text: v.string(),
    stickerId: v.optional(v.id('stickers')),
    mediaStorageId: v.optional(v.id('_storage')),
    mediaType: v.optional(v.union(v.literal('photo'), v.literal('video'))),
  })
    .index('by_group', ['groupId'])
    .index('by_sender', ['senderId']),

  stickers: defineTable({
    ownerId: v.id('users'),
    name: v.string(),
    imageStorageId: v.id('_storage'),
  }).index('by_owner', ['ownerId']).index('by_name', ['name']),

  savedStickers: defineTable({
    userId: v.id('users'),
    stickerId: v.id('stickers'),
  }).index('by_user_sticker', ['userId', 'stickerId']).index('by_user', ['userId']),

  // One row per (senderId, recipientId) direction, upserted as the sender
  // types — cleared (isTyping: false) by the client after a pause or on
  // send, so reactivity comes from real mutations rather than a time-based
  // staleness check.
  typing: defineTable({
    senderId: v.id('users'),
    recipientId: v.id('users'),
    isTyping: v.boolean(),
  })
    .index('by_sender_recipient', ['senderId', 'recipientId'])
    .index('by_recipient', ['recipientId']),

  // A logged-in session. Minted once at login/register (see auth.ts) and
  // verified on every call that claims to act as a given user (see
  // convex/lib/session.ts's requireUser) — this is what makes "userId" in
  // every other mutation/query's args an actual, checked identity instead
  // of a value the caller can just assert. Same shape and reasoning as the
  // moderator-only modSessions table below, generalized to every account.
  userSessions: defineTable({
    userId: v.id('users'),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index('by_token', ['token'])
    .index('by_user', ['userId']),

  // One row per (conversationId, userId) — how recently that user last had
  // the thread open. Compared against a message's _creationTime to decide
  // whether the other person has seen it yet.
  reads: defineTable({
    conversationId: v.string(),
    userId: v.id('users'),
    lastReadAt: v.number(),
  }).index('by_conversation_user', ['conversationId', 'userId']),

  // One row per user — notifications are derived live from follows/likes/
  // comments (no separate notifications table to keep in sync), so "Clear"
  // just remembers a cutoff timestamp instead of deleting anything.
  notificationClears: defineTable({
    userId: v.id('users'),
    clearedAt: v.number(),
  }).index('by_user', ['userId']),

  // Separate from notificationClears — this tracks "have you *seen* the bell
  // badge" (updated the moment the Notifications screen opens) rather than
  // "have you dismissed the list" (only updated by the explicit Clear
  // button), so opening the screen resets the badge without also emptying
  // the list you're there to read.
  notificationReads: defineTable({
    userId: v.id('users'),
    lastSeenAt: v.number(),
  }).index('by_user', ['userId']),

  // Per (user, circle) — when that user last viewed that circle's tab on
  // Home, so a new post in a circle they haven't reopened yet can show a dot.
  // circleId here can be the built-in "best-friends" string or a userCircles
  // document id (both are just strings on the wire).
  circleReads: defineTable({
    userId: v.id('users'),
    circleId: v.string(),
    lastViewedAt: v.number(),
  }).index('by_user_circle', ['userId', 'circleId']),

  // A user-created circle, alongside the built-in "All"/"Best Friends" pair.
  // Visibility for these is membership-based (circleMemberships), not the
  // mutual-follow check "Best Friends" uses.
  userCircles: defineTable({
    ownerId: v.id('users'),
    name: v.string(),
    color: v.string(),
    sortOrder: v.optional(v.number()),
  }).index('by_owner', ['ownerId']),

  // The owner gets a 'joined' row the moment the circle is created; everyone
  // else starts 'invited' (via a chat invite card) and flips to 'joined'
  // when they tap Join. Only 'joined' rows grant visibility into the
  // circle's posts/clips/stories.
  circleMemberships: defineTable({
    circleId: v.id('userCircles'),
    userId: v.id('users'),
    status: v.union(v.literal('invited'), v.literal('joined')),
  })
    .index('by_circle', ['circleId'])
    .index('by_user', ['userId'])
    .index('by_circle_user', ['circleId', 'userId']),

  stories: defineTable({
    authorId: v.id('users'),
    mediaStorageId: v.id('_storage'),
    mediaType: v.union(v.literal('photo'), v.literal('video')),
    // Undefined circleIds = visible to all mutual friends (the default
    // "Friends" story audience). Otherwise, visibility is granted to members
    // of any selected circle. circleId is retained for older stories.
    circleId: v.optional(v.id('userCircles')),
    circleIds: v.optional(v.array(v.id('userCircles'))),
    textOverlay: v.optional(
      v.object({
        text: v.string(),
        color: v.string(),
        fontFamily: v.optional(v.string()),
        translateX: v.number(),
        translateY: v.number(),
        scale: v.number(),
        rotation: v.number(),
      })
    ),
    // ---- Remix (see convex/posts.ts createRemix) — same meaning as on
    // `posts`, mirrored here since a remix can target a story too.
    remixOfPostId: v.optional(v.id('posts')),
    remixColor: v.optional(v.string()),
  }).index('by_author', ['authorId']),

  // The business/review/billing side of an ad. Its actual content (media,
  // title, caption) lives on the `posts` row pointed to by postId — see
  // posts.isAd — so ads get likes/comments/bookmarks for free.
  ads: defineTable({
    postId: v.id('posts'),
    creatorId: v.id('users'),
    kind: v.union(v.literal('post'), v.literal('clip')),
    link: v.string(),
    buttonText: v.string(),
    buttonColor: v.string(),
    // The identity shown on the card instead of the creator's real profile.
    // The real account is still revealed to anyone via the ad's options menu.
    displayName: v.string(),
    displayAvatarStorageId: v.optional(v.id('_storage')),
    displayAvatarGradient: v.optional(v.array(v.string())),
    status: v.union(
      // Submitted, waiting on a moderator.
      v.literal('pending_review'),
      // A moderator rejected it — rejectionReason is set; the creator can
      // edit and resubmit, which flips this back to 'pending_review'.
      v.literal('rejected'),
      // A moderator approved it, but it isn't live until paid for.
      v.literal('approved'),
      // Paid and currently running — visible in feeds until activeUntil.
      v.literal('active'),
      // Was active; the paid period ran out. Paying again reactivates it.
      v.literal('expired')
    ),
    rejectionReason: v.optional(v.string()),
    reviewedByModId: v.optional(v.id('users')),
    reviewedAt: v.optional(v.number()),
    billingPlan: v.optional(v.union(v.literal('daily'), v.literal('monthly'))),
    // Epoch ms the current paid period runs out. Only meaningful once the ad
    // has been paid for at least once.
    activeUntil: v.optional(v.number()),
    // Simple running counters the creator sees in Settings > Ads — one bump
    // per card activation (view) and per CTA-button tap (click).
    views: v.optional(v.number()),
    clicks: v.optional(v.number()),

    // ---- Targeting (see convex/lib/locations.ts, convex/ads.ts eligibility) ----
    // Normalized city names (normalizeLocationName) — "Warsaw"/"Warszawa"
    // both resolve to the same entry. Empty/undefined = no location
    // restriction (falls back to the product's default: everyone eligible).
    targetLocations: v.optional(v.array(v.string())),
    // Optional radius targeting around a point, evaluated with haversine
    // distance against the viewer's coarse (IP-derived) coordinates.
    targetGeo: v.optional(
      v.object({ lat: v.number(), lng: v.number(), radiusKm: v.number() })
    ),
    // ISO-639-1 codes. Empty/undefined = no language restriction.
    targetLanguages: v.optional(v.array(v.string())),
  })
    .index('by_creator', ['creatorId'])
    .index('by_status', ['status'])
    .index('by_post', ['postId']),

  // One row per ad delivery — the real signal behind pCTR smoothing, pacing,
  // and frequency capping. `views`/`clicks` on `ads` stay as cheap running
  // counters for the creator's own dashboard; this table is what ranking and
  // fatigue control actually read.
  adImpressions: defineTable({
    adId: v.id('ads'),
    userId: v.id('users'),
    shownAt: v.number(),
    clicked: v.boolean(),
    clickAt: v.optional(v.number()),
  })
    .index('by_ad', ['adId'])
    .index('by_user', ['userId'])
    .index('by_ad_user', ['adId', 'userId']),

  // One row per delivered impression of a post or clip — the behavioral
  // signal aggregate engagement counts alone can't provide (watch time,
  // completion, rewatch, session grouping). Never written for content that
  // wasn't actually rendered to the viewer.
  contentImpressions: defineTable({
    userId: v.id('users'),
    postId: v.id('posts'),
    kind: v.union(v.literal('post'), v.literal('clip')),
    shownAt: v.number(),
    watchMs: v.optional(v.number()),
    duration: v.optional(v.number()),
    completed: v.optional(v.boolean()),
    // Groups impressions within one app open — drives session-level
    // exploration/exploitation on the Clips feed (see convex/lib/ucb.ts).
    sessionId: v.optional(v.string()),
    // Topic/sound cluster this content belonged to when shown, so the UCB
    // bandit can attribute reward without re-deriving it later.
    cluster: v.optional(v.string()),
    // Which ranking pipeline produced this impression (e.g. "clips_v1") —
    // for offline comparison between ranking versions.
    rankingVersion: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_post', ['postId'])
    .index('by_user_post', ['userId', 'postId'])
    .index('by_user_session', ['userId', 'sessionId']),

  // Timestamped sound-usage events (posts.ts inserts one per post/clip
  // created with a sound) — what soundVelocity (convex/lib/sound.ts) reads
  // instead of the lifetime `sounds.useCount` counter, so trend detection
  // reflects recent momentum rather than all-time popularity.
  soundUsageEvents: defineTable({
    soundId: v.id('sounds'),
    userId: v.id('users'),
    postId: v.optional(v.id('posts')),
    usedAt: v.number(),
  }).index('by_sound', ['soundId']),

  // A user's own search history — used for personalized recent-search
  // suggestions and (aggregated, never per-user) trending search terms.
  // Never exposed for any user other than its own.
  searchQueries: defineTable({
    userId: v.id('users'),
    normalizedTerm: v.string(),
    timestamp: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_term', ['normalizedTerm']),

  // A quiet, separate trail from userAlerts (which drives the hard "read and
  // acknowledge" popup for warnings/strikes) — an ad being approved is good
  // news and a rejection already shows its reason right in Settings > Ads,
  // so these only ever surface in the regular Notifications list.
  adNotifications: defineTable({
    userId: v.id('users'),
    adId: v.id('ads'),
    status: v.union(v.literal('approved'), v.literal('rejected')),
    message: v.optional(v.string()),
  }).index('by_user', ['userId']),
});
