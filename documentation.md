# MyCircle

## Overview

MyCircle is an Expo (React Native) app.

## Colors

The app is monochrome — black, white, and shades of gray, no hue anywhere: buttons, the active Circle tab and its underline, the like heart, the Circles/Global switch, avatar fallback gradients, and the color picker in the post text tool. theme.ts's `red` and `coral` keys stick around under those names since so much of the app already references them, but they just point at a neutral white/gray pair instead of an actual red/coral.

There's a real light mode now, not just a dark one — Settings → Appearance (gear icon on your own profile) lets you pick Dark, Light, or "Use phone default." ThemeContext.tsx holds the current pick (persisted to AsyncStorage) and resolves it against the device's own light/dark setting when it's set to "system" (`useColorScheme()`). theme.ts exports two full palettes now, `darkColors` and `lightColors`, instead of one fixed `colors` export.

Making this actually work meant touching every screen and component that reads colors — React Native bakes `StyleSheet.create()`'s values in at the moment that code runs, so a plain module-level `colors` object can't react to a theme switch no matter how you mutate it. Every file's styles got wrapped in a `createStyles(colors)` function called inside the component (with the current theme's colors from `useAppTheme()`), instead of a static object built once at import time. A couple of key names still don't literally match their color — `white` means "the primary foreground color" (real white on dark mode, near-black on light mode) and `black` means "whatever contrasts with `white`" (they're always each other's opposite) — kept that way rather than renaming everything again, since it was already the established pattern from the red/coral rename.

Not everything follows the theme, on purpose: the camera (screens/CameraScreen.tsx), the media editor (screens/EditMediaScreen.tsx, components/TextToolEditor.tsx), the full-screen Clips viewer (screens/ClipsScreen.tsx), and clip thumbnails (components/ClipTile.tsx) always render dark, like a native camera app — those import `darkColors` directly instead of going through `useAppTheme()`. Same reasoning as before: they're either a live camera/video canvas or an overlay sitting on top of arbitrary media, where a light theme wouldn't make sense.

Accounts created before this all existed keep whatever colorful avatar gradient got randomly assigned to them at signup, since that value is saved once to the user's row and isn't regenerated from the theme afterward — only new signups (or anyone who redoes onboarding) get the new grayscale gradients.

Fixed along the way: the Welcome and Login screens' primary buttons used to pair a white background with white text (invisible) after the earlier black & white rename — now black text; and a couple of list rows (Search results, the follow list) had their avatar/name/button silently stacking vertically instead of sitting in a row, a recurring `AnimatedPressable`-wraps-children-in-an-unstyled-View bug now fixed at each of those call sites by moving the layout style onto an inner `View` instead of the pressable itself.

## Backend

Using Convex for now.

## Icons

We use HugeIcons for all icons in the app.

## Typography

App-wide base font is now Inter — the standard free stand-in for iOS's SF Pro (which is Apple-proprietary and can't be bundled into the app). Every screen renders text through components/AppText.tsx, a thin wrapper around RN's Text that merges in Inter_400Regular as the base so it applies everywhere, since React's `defaultProps` trick doesn't actually work when a component always passes its own `style` prop (which ours all do). Headings/buttons layer Inter_600SemiBold or Inter_700Bold on top where they need real bold weight — custom fonts don't get synthetic bolding from `fontWeight` alone on Android, so those need the actual bold font file specified.

Oswald (the industrial condensed look we used for titles for a while) is still loaded, but now only shows up as the "Industrial" option in the post text tool (theme.ts's textToolFonts) — it's no longer the app's default.

## Animations

Two reusable pieces cover most of the app now: components/FadeInView.tsx (wraps useEntranceAnimation — fade + rise, already used on the auth/onboarding screens — into a drop-in component) and components/AnimatedPressable.tsx (a Pressable that springs to 0.92 scale on press, back to 1 on release). Applied to: the bottom nav bar icons, the Follow button, the Circles tabs, every list row in Search/FollowList/Home feed/Profile posts, and the form screens in the post-creation flow (Post Details, Audience Selection) that had no animation at all before. Explore and the camera/edit screens are left alone — Explore has no real content yet to animate, and a fading camera preview or edit canvas would look wrong (those aren't meant to "arrive," they're just live).

## Screens

Welcome, Login and Register, then an onboarding flow after registering: name, birthday, username, then an optional profile photo. Skipping the photo just uses a big letter on a random gradient instead. No router yet, App.tsx just swaps between screens with local state.

Birthday uses a custom wheel picker (month/day/year columns) instead of the native date picker — the native Android spinner looks nothing like iOS's, so we built our own with FlatLists to get the same look on both platforms. Component's at components/WheelPicker.tsx if we need it elsewhere.

After finishing onboarding (or logging into an account that already has), you land on Home — a collapsible "MyCircle" header up top (components/CollapsibleHeader.tsx, hides on scroll down, comes back on scroll up), a "Circles" selector below it (components/CircleSelector.tsx — All / Best Friends for now, each with its own color, underline morphs from the old tab to the new one), then the actual post feed, and a bottom nav bar with home / compass / paper-plane (messages) / profile icons (components/BottomNavBar.tsx). Whichever tab you're on renders filled solid instead of just tinted a different color — white on dark mode, black on light mode (`useColorScheme()`), everyone else stays a dim outline.

Home and Explore both get two extra icons directly in their header now instead of relying on the nav bar for everything: a search icon on the left (opens Search) and a + on the right (opens the camera) — CollapsibleHeader supports this via `leftIcon`/`onPressLeft` and a `rightIcons` array (so it can hold more than one button, unlike the old single `rightIcon` prop). Search and the camera no longer have icons of their own in the bottom nav bar at all — they're only reachable from Home/Explore's header now, or from wherever else in the app already links to them.

The Circles tabs filter the feed, and the feed itself is friends-only now: Home only ever shows circle-audience posts from people you're mutual friends with (you follow each other) plus your own — never Global posts, and never posts from people who aren't your friends (convex/posts.ts's `listHomeFeed`, gated server-side, not just client-side filtering). "All" shows every one of those; "Best Friends" narrows to posts shared specifically to that circle.

Compass opens Explore (screens/ExploreScreen.tsx) — now the public feed: every Global-audience post from anyone, no friendship gate (convex/posts.ts's `listExploreFeed`). Same shell as Home (collapsible header, scrollable, nav bar, empty state when there's nothing), just no Circles row since Explore isn't circle-scoped.

Profile (screens/ProfileScreen.tsx) shows your own avatar (photo or letter+gradient), name and @username, centered — reuses the same avatar rendering as PostCard. Below that, everything that user has posted, newest first (convex/posts.ts's listPostsByAuthor), rendered with the exact same PostCard component the Home feed uses — full-width media, title, caption, author row — not a thumbnail grid. We tried a 3-column grid with tap-to-expand first; scrapped it because the ask was for posts to look like they do in the feed, full stop, not a compact grid that opens into the feed look on tap.

Own profile also gets a collapsible header now, same behavior as Home/Explore (components/CollapsibleHeader.tsx) — shows your @username centered and a settings gear top-right. The header component supports a `leftIcon`/`rightIcons` set of optional icon slots for this (Home/Explore use it for search and the camera; Profile uses it for the settings gear). The gear opens screens/SettingsScreen.tsx — right now its only setting is Appearance (Dark/Light/Use phone default, see the Colors section above). This header only shows on your own profile; viewing someone else's still uses the plain back-button layout, since a settings gear wouldn't make sense there.

Rewrote how the collapsible header decides to hide/show: it used to be pure scroll-distance-based (Animated.diffClamp), which meant a small scroll-up wouldn't necessarily bring it all the way back. Now it listens to scroll direction — any real upward scroll (or being back near the top) snaps it fully visible immediately; sustained downward scroll past the header's own height hides it. Same component, so this applies everywhere it's used (Home, Explore, Profile).

Every scrollable list in the app (Home feed, Profile, Explore, Search results, follower/following lists) now hides its scrollbar (`showsVerticalScrollIndicator={false}`) — was default-visible before.

Profile posts now have a Circles/Global switch (components/PostAudienceSwitch.tsx) above the post list. Global shows that user's globally-visible posts to anyone. Circles shows their circle-only posts, but only if you're "friends" — meaning mutual follow, you follow them and they follow you back (convex/follows.ts's new `areFriends` query, checked both directions). If you're not mutual friends, Circles shows an explanatory message instead of just looking empty. Viewing your own profile always shows your own circle posts, no friendship check needed.

The switch itself (components/PostAudienceSwitch.tsx) is a single pill with a white thumb that slides between the two halves on a spring animation when you tap. Got a real polish pass: the thumb has a soft drop shadow so it reads as sitting above the pill instead of flat, the active icon fills solid black (same "filled means active" language as the bottom nav bar) instead of just changing color, and the active label goes bold. Since it's its own component, the exact same switch is reused in screens/AudienceSelectionScreen.tsx (the "who's this for" step right after editing a post) — that screen used to have its own separate two-card picker; replaced it with this switch plus a one-line description underneath that changes based on the selection, so there's one consistent-looking audience picker across the app instead of two different ones.

Avatar fallback letters (the "H"/"A" shown when someone hasn't set a profile photo) are always literal white now, not the theme-flipped `colors.white` — they sit on a colorful gradient regardless of whether the app itself is in light or dark mode, so they shouldn't flip to black in light mode the way regular foreground text does.

The bottom nav bar's inactive icons were reading as too faint (they were reusing `textMuted`, a 45%-opacity tone meant for small captions, not something as prominent as primary navigation) — bumped to their own less-transparent tone. The Explore tab's compass icon also doesn't get the solid "filled" treatment other active tabs get, since filling it solid made its needle (the detail that makes it look like a compass rather than a blob) disappear into the rest of the icon — it just changes to the active color and stays outline-only instead.

Search (screens/SearchScreen.tsx) is real, not a placeholder: convex/search.ts does a case-insensitive substring match on username/name for people and title/caption for posts (plain filter over the table, not a Convex search index — fine at this scale, would want a real search index if this ever gets big). Debounced same as the username-availability check during onboarding. Shows a People section and a Posts section, whichever have matches. Each result is its own rounded card now (subtle background + border) instead of a bare row — that also fixed a real layout bug: the row's avatar/name/Follow button were quietly stacking vertically instead of sitting in a line, the same `AnimatedPressable`-wraps-its-child-in-an-unstyled-View quirk we'd already hit a couple of times elsewhere, just not noticed here until someone actually looked at it.

Every "button-shaped" surface in the app used to be a translucent white overlay (`rgba(255,255,255,0.08–0.14)`) — back buttons, the Follow/Following pill, input fields, icon circles, the Circles/Global switch track, and so on. They're solid flat grays now (theme.ts's `inputBackground`/`buttonSecondary`/`backButtonBackground`) instead, since translucency read inconsistently depending on what was behind it (media, gradients, other UI) and just looked washed out. Borders are still a soft translucent line on purpose — that's a hairline divider, not a button fill.

People in search results, on Profile, and in follower/following lists all have a Follow/Following button (components/FollowButton.tsx, coral when you can follow, muted outline once you do). Backed by the `follows` table (convex/follows.ts — follow, unfollow, getFollowingIds, getFollowCounts, getFollowers, getFollowingUsers) storing follower/following id pairs. Not on post authors in the feed yet, though — that'd be the next natural spot.

Profile (screens/ProfileScreen.tsx) now shows Followers/Following counts (components/FollowCounts.tsx) under the name — tapping either opens screens/FollowListScreen.tsx, a list of that user's followers or who they follow, each row itself tappable to jump to that person's profile. ProfileScreen now works for anyone, not just yourself: pass a different `viewedUserId` than `currentUserId` and it swaps the nav bar for a back button plus a Follow button. You get there by tapping a person in Search results or in a follow list.

Since there's no real navigation stack in this app (App.tsx is just a flat screen switch), profile/follower drill-down needed one: App.tsx keeps a small `profileStack` so back retraces exactly how you got there (Search → someone's profile → their followers → another profile → back → back → back lands you where you started, home/search/wherever). Your own profile (opened from the nav bar) resets that stack — it's the root, not part of anyone else's chain.

Tapping your own @username opens an account switcher — both copies of it, the one under your avatar and the pinned one in the collapsible header bar once you've scrolled (CollapsibleHeader's `onPressTitle`), since "the username at the top" turned out to mean the sticky header one, not just the one in the scrolling content — components/AccountSwitcherSheet.tsx, a bottom sheet listing every account that's ever been logged into on this device, with a checkmark on whichever one is active and an "Add Account" row at the bottom. The device remembers accounts locally (session.ts's `savedAccountIds`, a plain array in AsyncStorage — separate from `mycircle.userId`, which is just "whichever one is active right now") — every successful login/register gets appended to it, so once you've signed into an account here it just shows up in the switcher from then on, no re-entering its password to switch back to it. Tapping a different account in the list is instant (just swaps which userId is "active" and drops you on Home — no re-auth, since we already have that account's session). "Add Account" sends you through the normal Login/Register screens for a brand new one; back from there returns you to your profile instead of the Welcome screen, since you're not actually logged out. convex/users.ts's `getUsersByIds` is what resolves the whole list's avatars/names/usernames in one query instead of one per row.

All five main screens (Home/Explore/Search/Messages/Profile, plus the camera) share the same nav bar so you can jump between them from anywhere.

Messages (screens/DMsScreen.tsx, the paper-plane icon in the nav bar) is real now — actual 1:1 DMs, not a placeholder. The pencil icon top-right opens components/NewMessageSheet.tsx, a bottom sheet listing everyone you follow, mutual friends first (convex/follows.ts's `listFollowingForNewMessage` — same follow rows as everywhere else, just flagged with whether they follow you back and sorted so friends surface before people who don't). Each row has a message button that opens screens/ChatScreen.tsx — a real thread with that person: bubbles (yours on the right in white/black text, theirs on the left), a text input pinned above the keyboard (`KeyboardStickyView` from react-native-keyboard-controller), and Convex's usual reactivity means messages show up on both ends without any manual refreshing — send one and it's just there for the other person, no polling.

Backend is convex/messages.ts + a new `messages` table (convex/schema.ts) — each row stores a `conversationId` (the two participants' ids, sorted and joined, so a single indexed query pulls the whole thread regardless of who sent what) alongside the normal sender/recipient/text fields. `listConversations` powers the Messages tab itself: every conversation you're part of, newest message first, with a preview ("You: ..." when you sent the last one).

Chat has real animation now, not just static bubbles — each message fades/rises in as it arrives (components/FadeInView.tsx, same entrance used elsewhere in the app), whether you sent it or the other person did.

Typing indicators are live, in two different places depending on whether you're actually in that chat: convex/typing.ts backs both, with a `typing` table storing one row per (sender, recipient) direction that the client flips to `true` while you're actively typing and back to `false` after ~1.5s of no keystrokes, on send, or on leaving the screen — deliberately client-driven (not a passive timestamp check) so Convex's reactivity actually fires when it changes. Inside an open thread (screens/ChatScreen.tsx) that shows as three little jumping dots in a bubble, same shape as an incoming message (components/TypingDots.tsx). From the Messages list, without that chat open, it's simpler — the conversation row's preview text swaps to "Typing…" instead.

Sent messages get a small gray status label underneath the last one you sent — "Sending…" while the mutation's in flight, "Sent" once it lands, "Seen" once the other person has actually had the thread open since you sent it. That last part needed real read-tracking: a `reads` table (convex/schema.ts) with one row per (conversation, user) holding when that person last had the thread open, updated by `markRead` every time ChatScreen is open and messages change. "Seen" just means the other person's last-read time is at or after your message's timestamp.

Headers across the app got a real pass — the shared components/CollapsibleHeader.tsx (Home/Explore/Profile) plus the Messages, Followers/Following, and Chat headers now blur whatever scrolls up underneath the status bar / header area (`BlurView` from expo-blur) instead of just a flat strip with nothing behind it. The tint on top of the blur sits high (88% opacity) on purpose — first pass left it too translucent and the header read as see-through rather than a proper frosted bar, especially since Android's blur support is hit-or-miss to begin with; this way it still reads as a solid, real header, with the blur only showing as a subtle texture where content passes underneath, not as visible transparency. Titles are bolder too, and the icon buttons switched from a background-matching (basically invisible) fill to a proper `buttonSecondary` circle so they read as actual buttons. Settings kept the plain-bar treatment since nothing ever scrolls behind it, so a blur would have nothing to blur.

The + opens the camera (screens/CameraScreen.tsx) — rounded live preview, tap the shutter for a photo, hold it down for video. There's also a gallery button next to the shutter to import an existing photo or video from the phone instead of shooting one — same edit flow either way. The live preview's video quality is capped at 1080p (`videoQuality` on CameraView) — left unset it defaults to the highest resolution the device supports, which on a lot of Android phones overloads the encoder the moment you start recording and shows up as sudden lag and dropped/blurry frames; capping it fixed that. Below the shutter row is a horizontally scrollable Post / Story / Clip switcher (Instagram-style), so you can flick between modes. Story is still just a visual placeholder — picking it behaves exactly like Post. Clip is functional though: switching to it swaps out the live shutter entirely for a single "Import a video" button, since clips can only come from your gallery, never shot live in-app — matches the TikTok-style clip you're posting rather than something you'd frame and shoot fresh. After capture (or import) you land on an edit screen (screens/EditMediaScreen.tsx) showing the photo/video full-screen, back arrow to discard and retake, and a "Next" button.

Next takes you to screens/PostDetailsScreen.tsx — small preview thumbnail up top, then Title and Caption fields (both optional), then Next again.

That leads to screens/AudienceSelectionScreen.tsx — pick Circles (only your circles see it) or Global (anyone on MyCircle), Circles selected by default. Picking Circles reveals the actual circle list (theme.ts now exports `circles` as the shared source of truth — same All/Best Friends used in the Home tab selector) as toggle chips, multi-select, so you can post to All, Best Friends, or both; Share is disabled if none are picked.

Share is now the real thing: uploads the photo/video to Convex storage, then writes a row to the new `posts` table (convex/posts.ts — author, title, caption, media, audience, circle ids) and drops you back on Home, where it now actually shows up in the feed via `posts.listHomeFeed`. Post cards (components/PostCard.tsx) are modeled on a reference screenshot the user shared from another app of theirs ("Yapper") — avatar circle (photo or letter+gradient fallback, same as the profile avatar), author name, bold title, then the media full-width in a rounded card, a like + bookmark row, caption below if there is one.

Every post card now has a like button (heart, fills red with the count next to it once you've liked it) and a bookmark button (fills white once saved) — convex/likes.ts and convex/bookmarks.ts each just toggle a row in their own table keyed by post + user, and the feed/profile queries resolve like count and whether the current viewer liked/bookmarked each post server-side. Both icons are HugeIcons' outline style by default, filled in with the active color once toggled on (a solid fill isn't in the free icon set, so we fill the outline's own path instead), and pop with a little spring bounce when you tap them. No dedicated "saved posts" screen yet — bookmarking just persists the state on the post for now.

Videos no longer get force-cropped to fill their container. In the regular post feed, components/PostCard.tsx reads the video's real width/height off its track once expo-video finishes loading it (via `useEvent(player, 'videoTrackChange', ...)`) and resizes the media box to that actual aspect ratio, so a landscape or square video shows uncropped instead of getting Instagram-style cropped down to fit 4:5 (photos are unaffected, still fixed 4:5). The full-screen Clips viewer (screens/ClipsScreen.tsx) plays videos with `contentFit="contain"` too, so a clip that isn't a perfect 9:16 vertical letterboxes instead of getting cropped to fill the screen.

Fixed the like/bookmark buttons not responding to taps on the Clips viewer — an Android-specific quirk with expo-video. By default its VideoView renders on a `SurfaceView`, which is its own hardware compositing layer that always draws on top of the regular view hierarchy no matter what order things are in the JSX, so the overlay buttons drawn "after" (visually on top of) the video were actually sitting underneath it as far as touch handling was concerned. Setting `surfaceType="textureView"` on that VideoView makes it composite normally with everything else, so the overlay's touches land where they should.

Posts now carry a `kind` (`post` or `clip`, convex/posts.ts / convex/schema.ts — defaults to `post` for anything created before this existed). Clips are short vertical videos, always public: Explore has its own horizontally scrollable "Clips" row up top (components/ClipTile.tsx — small looping muted preview per clip) separate from the regular post feed below it, so the same video never shows twice. Tapping a clip opens screens/ClipsScreen.tsx, a full-screen TikTok/Reels-style vertical feed — swipe up for the next clip, video autoplays (with sound) only on whichever one is actually on screen, like/bookmark buttons float on the right. It scrolls endlessly: once you're near the end of the clip list it quietly appends another lap of the same clips rather than stopping, so there's always more to swipe through. `posts.listClips` is the query behind both — same global, no-friendship-gate visibility as the rest of Explore.

Of the three edit tools, only Text is wired up so far (draw/sticker are still just placeholder icons). Tapping it opens a composer (components/TextToolEditor.tsx) to type the text and pick a color and font (Classic/Industrial/Rounded/Handwriting, using fonts we'd already loaded elsewhere in the app). Once placed, the text becomes draggable, pinch-to-resize, and rotatable on top of the photo/video (components/DraggableText.tsx), via react-native-gesture-handler + react-native-reanimated.

## Auth

Registration takes email + password. Password gets hashed with bcrypt in a Convex action before it's ever written to the db, so we never store it in plain text. Everything else (name, username, birthday, avatar) gets filled in during onboarding and saved to that same user record at the end.

Login checks the email/password against that hash and errors are readable (wrong password, no account with that email, email already taken, etc) instead of generic messages — Convex hides plain `Error` messages from the client by default, so we throw `ConvexError` everywhere we want the user to actually see the text.

Session persists across app restarts: the logged-in/registered user's id is saved to AsyncStorage. On launch we check for it and look the user up — if they never finished onboarding, they're dropped right back into it (starting over from the name step, since we don't save partial onboarding progress); if they did, they go straight to home. This also means someone who registers, closes the app before finishing onboarding, and later logs in again still gets sent through onboarding.

## Native modules

Added react-native-keyboard-controller (better keyboard handling for forms) and expo-notifications. Both have native code, so plain Expo Go won't pick them up — need a dev client rebuild (`npx expo prebuild` + `npx expo run:ios` / `run:android`, or an EAS dev build) before they'll actually work on device.

## Tech Stack

- Expo ~57.0.21
- React 19.2.3
- React Native 0.86.3
- TypeScript ~6.0.3

## Getting Started

```bash
npm install
npm start
```

Platform-specific:

```bash
npm run android
npm run ios
npm run web
```
