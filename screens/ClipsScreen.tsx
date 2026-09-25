import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  PanResponder,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  View,
  ViewToken,
} from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useEvent } from 'expo';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { useVideoPlayer, VideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  BookmarkIcon,
  Cancel01Icon,
  Comment01Icon,
  FavouriteIcon,
  MoreVerticalIcon,
  Share08Icon,
} from '@hugeicons/core-free-icons';
import AdOptionsSheet from '../components/AdOptionsSheet';
import { AdPost } from '../components/AdCard';
import AiLabel from '../components/AiLabel';
import AnimatedPressable from '../components/AnimatedPressable';
import CommentsPanel from '../components/CommentsPanel';
import CommentsSheet from '../components/CommentsSheet';
import ExpiryLabel from '../components/ExpiryLabel';
import PostOptionsSheet from '../components/PostOptionsSheet';
import PostTextOverlay from '../components/PostTextOverlay';
import RemixFrame from '../components/RemixFrame';
import { FriendLikersInline } from '../components/FriendLikers';
import CircleLabel from '../components/CircleLabel';
import HeaderDropdown from '../components/HeaderDropdown';
import { HugeiconsIcon as ChevronIcon } from '@hugeicons/react-native';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import SharePostSheet from '../components/SharePostSheet';
import SoundAudioLayer from '../components/SoundAudioLayer';
import SoundLabel from '../components/SoundLabel';
import VerifiedBadge from '../components/VerifiedBadge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { getAppSessionId } from '../appSession';
import { interleaveAds } from '../interleaveAds';
// Deliberately not theme-reactive — full-screen video always renders on a
// black stage regardless of the app's own light/dark setting.
import { mediaColors as colors, radius, space } from '../theme';
import type { ClipPost } from '../components/ClipTile';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CLIP_COMMENTS_HEIGHT = SCREEN_HEIGHT * 0.52;
const CLIP_COMMENTS_EXPANDED_HEIGHT = SCREEN_HEIGHT - (RNStatusBar.currentHeight ?? 44) - 8;
const CLIP_COMMENTS_SNAP_MIDPOINT = (CLIP_COMMENTS_HEIGHT + CLIP_COMMENTS_EXPANDED_HEIGHT) / 2;

// The heart icon reads better on the dark video stage a couple shades
// brighter than the app's own accent red, which is tuned for text/borders.
const LIKE_RED = '#ff4d5e';

type ClipItem =
  | (ClipPost & { _key: string; _kind: 'clip' })
  | (AdPost & { _key: string; _kind: 'ad' });

export default function ClipsScreen({
  userId,
  initialPostId,
  onClose,
  onOpenUser,
  onOpenStory,
  onOpenSound,
  onOpenOriginal,
}: {
  userId: Id<'users'>;
  initialPostId: Id<'posts'>;
  onClose: () => void;
  onOpenUser: (userId: Id<'users'>) => void;
  onOpenStory: (userId: Id<'users'>) => void;
  onOpenSound: (soundId: Id<'sounds'>) => void;
  // Tapping a remixed clip jumps to the clip it was remixed from, rather
  // than toggling play/pause like a normal clip's tap does.
  onOpenOriginal: (postId: Id<'posts'>) => void;
}) {
  const sessionId = useMemo(() => getAppSessionId(), []);
  // Each clip is exactly as tall as the space this screen really has (measured),
  // not the window height — on phones where the two differ (system bars), using
  // the window height left a strip of the next clip showing under the first.
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const clips = useQuery(api.posts.listClips, { viewerId: userId, sessionId });
  const clipAds = useQuery(api.ads.listActiveAdsForSurface, { viewerId: userId, kind: 'clip' });
  const followingIds = useQuery(api.follows.getFollowingIds, { followerId: userId });
  const myCircles = useQuery(api.userCircles.listMyCircles, { userId });
  // What to show: everything ranked for you, only people you follow, clips shared
  // to any circle, or one specific circle.
  const [filter, setFilter] = useState('for-you');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterOptions = [
    { id: 'for-you', label: 'For You' },
    { id: 'following', label: 'Following' },
    { id: 'all-circles', label: 'All Circles' },
    { id: 'best-friends', label: 'Best Friends', color: '#f5c542' },
    ...(myCircles ?? []).map((c) => ({ id: c._id as string, label: c.name, color: c.color })),
  ];
  const filterLabel = filterOptions.find((o) => o.id === filter)?.label ?? 'For You';
  const filteredClips = useMemo(() => {
    if (!clips) return clips;
    if (filter === 'for-you') return clips;
    if (filter === 'following') {
      const following = new Set(followingIds ?? []);
      return clips.filter((c) => c.author && following.has(c.author._id as Id<'users'>));
    }
    if (filter === 'all-circles') return clips.filter((c) => (c.circleLabels?.length ?? 0) > 0);
    return clips.filter((c) => c.circleLabels?.some((l) => l.id === filter));
  }, [clips, filter, followingIds]);
  const [loopCount, setLoopCount] = useState(1);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const listRef = useRef<FlatList<ClipItem>>(null);

  const items = useMemo<ClipItem[]>(() => {
    if (!filteredClips || filteredClips.length === 0) return [];
    const merged = interleaveAds(filteredClips, filter === 'for-you' ? clipAds ?? [] : []);
    const all: ClipItem[] = [];
    // With a single clip there is nothing to scroll to, so don't repeat it.
    const loops = merged.length > 1 ? loopCount : 1;
    for (let loop = 0; loop < loops; loop++) {
      merged.forEach((entry) => {
        if (entry.kind === 'ad') {
          all.push({ ...entry.item, _key: `ad-${entry.item._id}__${loop}`, _kind: 'ad' });
        } else {
          all.push({ ...entry.item, _key: `${entry.item._id}__${loop}`, _kind: 'clip' });
        }
      });
    }
    return all;
  }, [filteredClips, clipAds, loopCount, filter]);

  const initialIndex = useMemo(() => {
    if (filter !== 'for-you') return 0;
    const index = items.findIndex((item) => item._kind === 'clip' && item._id === initialPostId);
    return index >= 0 ? index : 0;
  }, [items, initialPostId, filter]);

  // Switching what's shown starts again from the first clip.
  useEffect(() => {
    setActiveKey(null);
    setLoopCount(1);
  }, [filter]);

  useEffect(() => {
    if (items.length > 0 && !activeKey) {
      setActiveKey(items[initialIndex]?._key ?? items[0]._key);
    }
  }, [items, initialIndex, activeKey]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.item) {
        setActiveKey((first.item as ClipItem)._key);
      }
    }
  ).current;

  // clips === undefined is Convex's loading signal; once it resolves to an
  // array (even an empty one) we know there's genuinely nothing to show.
  if (clips === undefined) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.white} />
        </Pressable>
        <View style={styles.stateWrap}>
          <ActivityIndicator color={colors.white} />
        </View>
        <StatusBar style="light" />
      </View>
    );
  }

  if (items.length === 0 && filter === 'for-you') {
    return (
      <View style={styles.container}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.white} />
        </Pressable>
        <View style={styles.stateWrap}>
          <Text variant="body" style={styles.stateText}>
            No clips to show right now.
          </Text>
        </View>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        if (h > 0 && h !== pageHeight) setPageHeight(h);
      }}
    >
      {pageHeight !== null && (
      <FlatList
        key={filter}
        ref={listRef}
        data={items}
        keyExtractor={(item) => item._key}
        renderItem={({ item }) =>
          item._kind === 'ad' ? (
            <AdClipPage
              item={item}
              isActive={item._key === activeKey}
              userId={userId}
              pageHeight={pageHeight}
            />
          ) : (
            <ClipPage
              item={item}
              isActive={item._key === activeKey}
              pageHeight={pageHeight}
              userId={userId}
              sessionId={sessionId}
              onOpenUser={onOpenUser}
              onOpenStory={onOpenStory}
              onOpenSound={onOpenSound}
              onOpenOriginal={onOpenOriginal}
            />
          )
        }
        pagingEnabled
        showsVerticalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: pageHeight,
          offset: pageHeight * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        onEndReachedThreshold={1.5}
        onEndReached={() => setLoopCount((count) => count + 1)}
      />
      )}

      {items.length === 0 && (
        <View style={styles.stateWrap} pointerEvents="none">
          <Text variant="body" style={styles.stateText}>
            {filter === 'for-you' ? 'No clips to show right now.' : 'No clips here yet.'}
          </Text>
        </View>
      )}

      <Pressable style={styles.closeButton} onPress={onClose}>
        <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.white} />
      </Pressable>

      <Pressable
        style={styles.filterButton}
        onPress={() => setFilterOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choose which clips to show"
      >
        <Text variant="h3" style={styles.filterText}>{filterLabel}</Text>
        <ChevronIcon icon={ArrowDown01Icon} size={16} color="#ffffff" />
      </Pressable>

      <HeaderDropdown
        visible={filterOpen}
        options={filterOptions}
        selectedId={filter}
        onSelect={setFilter}
        onClose={() => setFilterOpen(false)}
      />

      <StatusBar style="light" />
    </View>
  );
}

// A thin gray-to-white progress line along the bottom of a clip, in place
// of a plain time label — fills left-to-right in step with actual playback
// (so it fills slower for a longer clip, since that's just what
// currentTime/duration looks like), and doubles as a scrubber: press and
// drag anywhere on it to seek, with the video paused for the duration of
// the drag and resumed on release if it was already playing.
function PlaybackScrubber({ player, isActive }: { player: VideoPlayer; isActive: boolean }) {
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    // A slightly coarser interval than the default is plenty smooth for a
    // progress line and cuts down on needless re-renders.
    player.timeUpdateEventInterval = 0.2;
  }, [player]);

  const seekToLocationX = (locationX: number) => {
    if (trackWidth <= 0 || player.duration <= 0) return;
    const fraction = Math.min(1, Math.max(0, locationX / trackWidth));
    setDragFraction(fraction);
    player.currentTime = fraction * player.duration;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        wasPlayingRef.current = player.playing;
        player.pause();
        seekToLocationX(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => seekToLocationX(evt.nativeEvent.locationX),
      onPanResponderRelease: () => {
        setDragFraction(null);
        if (wasPlayingRef.current) player.play();
      },
      onPanResponderTerminate: () => {
        setDragFraction(null);
        if (wasPlayingRef.current) player.play();
      },
    })
  ).current;

  if (!isActive) return null;

  const progress =
    dragFraction ?? (player.duration > 0 ? Math.min(1, currentTime / player.duration) : 0);

  return (
    <View style={styles.playbackScrubber} {...panResponder.panHandlers}>
      <View
        style={styles.playbackTrack}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        hitSlop={{ top: 14, bottom: 14 }}
      >
        <View style={[styles.playbackFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={[styles.playbackThumb, { left: `${progress * 100}%` }]} />
    </View>
  );
}

function ClipPage({
  item,
  isActive,
  pageHeight,
  userId,
  sessionId,
  onOpenUser,
  onOpenStory,
  onOpenSound,
  onOpenOriginal,
}: {
  item: Extract<ClipItem, { _kind: 'clip' }>;
  isActive: boolean;
  pageHeight: number;
  userId: Id<'users'>;
  sessionId: string;
  onOpenUser: (userId: Id<'users'>) => void;
  onOpenStory: (userId: Id<'users'>) => void;
  onOpenSound: (soundId: Id<'sounds'>) => void;
  onOpenOriginal: (postId: Id<'posts'>) => void;
}) {
  const player = useVideoPlayer(item.mediaUrl ? { uri: item.mediaUrl } : null, (p) => {
    p.loop = true;
    p.muted = false;
  });

  // A picked sound in 'sound-only' mode mutes the clip's own audio entirely;
  // 'both' keeps it at whatever volume was chosen while editing. No sound at
  // all (the common case — every video's own audio already *is* its sound)
  // just plays normally, same as before this feature existed.
  const hasMixedSound = !!item.sound && !!item.audioMode;
  useEffect(() => {
    player.volume = hasMixedSound && item.audioMode === 'sound-only' ? 0 : item.originalVolume ?? 1;
  }, [player, hasMixedSound, item.audioMode, item.originalVolume]);

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  // Watch-time impression logging — the primary ranking signal for Clips
  // (see convex/posts.ts scoreClipCandidate). One impression per viewing
  // occurrence: the clock starts when this page becomes the active one and
  // is flushed the moment it stops being active (scrolled away, or the
  // screen closes), not accumulated across separate viewings.
  const logImpressions = useMutation(api.impressions.logContentImpressions);
  const watchStartRef = useRef<number | null>(null);
  const cluster = (item.sound?._id as string | undefined) ?? item.hashtags?.[0] ?? 'general';

  useEffect(() => {
    if (isActive) {
      watchStartRef.current = Date.now();
      return;
    }
    const startedAt = watchStartRef.current;
    watchStartRef.current = null;
    if (!startedAt) return;

    const watchMs = Date.now() - startedAt;
    const durationMs = player.duration > 0 ? player.duration * 1000 : undefined;
    logImpressions({
      userId,
      impressions: [
        {
          postId: item._id as Id<'posts'>,
          kind: 'clip',
          watchMs,
          duration: durationMs,
          completed: durationMs ? watchMs >= durationMs : undefined,
          sessionId,
          cluster,
          rankingVersion: 'clips_v1',
        },
      ],
    });
  }, [isActive]);

  const toggleLike = useMutation(api.likes.toggleLike);
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);
  const toggleSaveSound = useMutation(api.sounds.toggleSaveSound);

  // Likes/saves show instantly and are then confirmed by the server — waiting
  // for the re-ranked clips list to come back took a few seconds.
  const [liked, setLiked] = useState(item.isLiked);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [saved, setSaved] = useState(item.isBookmarked);
  useEffect(() => setLiked(item.isLiked), [item.isLiked]);
  useEffect(() => setLikeCount(item.likeCount), [item.likeCount]);
  useEffect(() => setSaved(item.isBookmarked), [item.isBookmarked]);

  const onToggleLike = () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
    toggleLike({ postId: item._id as Id<'posts'>, userId }).catch(() => {
      setLiked(!nextLiked);
      setLikeCount((c) => Math.max(0, c + (nextLiked ? -1 : 1)));
    });
  };
  const onToggleSave = () => {
    const next = !saved;
    setSaved(next);
    toggleBookmark({ postId: item._id as Id<'posts'>, userId }).catch(() => setSaved(!next));
  };

  const [commentsVisible, setCommentsVisible] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const panelHeight = useRef(new Animated.Value(0)).current;
  const panelHeightRef = useRef(0);
  const dragStart = useRef(0);

  useEffect(() => {
    const id = panelHeight.addListener(({ value }) => {
      panelHeightRef.current = value;
    });
    return () => panelHeight.removeListener(id);
  }, [panelHeight]);

  const openComments = () => {
    setCommentsVisible(true);
    Animated.spring(panelHeight, {
      toValue: CLIP_COMMENTS_HEIGHT,
      useNativeDriver: false,
      speed: 16,
      bounciness: 4,
    }).start();
  };

  const closeComments = () => {
    Animated.timing(panelHeight, { toValue: 0, duration: 220, useNativeDriver: false }).start(
      () => setCommentsVisible(false)
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        dragStart.current = panelHeightRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(
          CLIP_COMMENTS_EXPANDED_HEIGHT,
          Math.max(CLIP_COMMENTS_HEIGHT * 0.5, dragStart.current - gesture.dy)
        );
        panelHeight.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.vy > 1.2 && panelHeightRef.current < CLIP_COMMENTS_HEIGHT) {
          closeComments();
          return;
        }
        const target =
          panelHeightRef.current > CLIP_COMMENTS_SNAP_MIDPOINT
            ? CLIP_COMMENTS_EXPANDED_HEIGHT
            : CLIP_COMMENTS_HEIGHT;
        Animated.spring(panelHeight, {
          toValue: target,
          useNativeDriver: false,
          speed: 16,
          bounciness: 4,
        }).start();
      },
    })
  ).current;

  const mediaScale = panelHeight.interpolate({
    inputRange: [0, CLIP_COMMENTS_HEIGHT, CLIP_COMMENTS_EXPANDED_HEIGHT],
    outputRange: [1, 0.48, 0.08],
  });
  const infoOpacity = panelHeight.interpolate({
    inputRange: [0, CLIP_COMMENTS_HEIGHT * 0.3, CLIP_COMMENTS_EXPANDED_HEIGHT],
    outputRange: [1, 0, 0],
  });

  const displayName = item.author?.name ?? item.author?.username ?? 'Someone';
  const letter = (item.author?.username ?? displayName).charAt(0).toUpperCase();
  const gradient = (item.author?.avatarGradient as [string, string]) ?? [colors.red, colors.coral];

  const togglePlayback = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <View style={[styles.page, { height: pageHeight }]}>
      <Animated.View
        style={[
          styles.mediaShrinkWrap,
          { transform: [{ scale: mediaScale }] },
        ]}
      >
        {item.mediaUrl && item.remixOf ? (
          <RemixFrame
            color={item.remixColor ?? '#3a3a3a'}
            username={item.remixOf.authorUsername}
            avatarUrl={item.remixOf.authorAvatarUrl}
            avatarGradient={item.remixOf.authorAvatarGradient as [string, string] | undefined}
            style={styles.media}
          >
            <Pressable
              style={styles.remixedMedia}
              onPress={() => onOpenOriginal(item.remixOf!.postId as Id<'posts'>)}
            >
              <VideoView
                style={styles.remixedMedia}
                player={player}
                nativeControls={false}
                onFirstFrameRender={() => setFrameReady(true)}
                contentFit="cover"
                surfaceType="textureView"
                pointerEvents="none"
              />
            </Pressable>
            {item.textOverlay && <PostTextOverlay overlay={item.textOverlay} ready={frameReady} />}
          </RemixFrame>
        ) : (
          <>
            {item.mediaUrl && (
              <Pressable style={styles.media} onPress={togglePlayback}>
                <VideoView
                  style={styles.media}
                  player={player}
                  nativeControls={false}
                  onFirstFrameRender={() => setFrameReady(true)}
                  contentFit="contain"
                  surfaceType="textureView"
                />
              </Pressable>
            )}
            {item.textOverlay && <PostTextOverlay overlay={item.textOverlay} ready={frameReady} />}
          </>
        )}
      </Animated.View>

      {/* Only actually needed when a *different* sound was layered on top of
          this clip's own audio — the common case (a video's own audio just
          promoted to "be" its sound) has nothing extra to play. */}
      {hasMixedSound && (
        <SoundAudioLayer
          audioUrl={item.sound?.audioUrl ?? null}
          volume={item.soundVolume ?? 1}
          isActive={isActive}
          syncPlayer={player}
        />
      )}

      {commentsVisible && (
        <Pressable style={styles.commentsBackdrop} onPress={closeComments} />
      )}

      {item.mediaType === 'video' && !commentsVisible && (
        <PlaybackScrubber player={player} isActive={isActive} />
      )}

      <Animated.View style={[styles.overlay, { opacity: infoOpacity }]} pointerEvents={commentsVisible ? 'none' : 'auto'}>
        <View style={styles.info}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              {item.author?.avatarUrl ? (
                <Image source={{ uri: item.author.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={gradient} style={styles.avatarGradient}>
                  <Text variant="calloutBold" style={styles.avatarLetter}>{letter}</Text>
                </LinearGradient>
              )}
            </View>
            <Text variant="bodyBold" style={styles.author}>{displayName}</Text>
            <VerifiedBadge verified={item.author?.isVerified} size={16} />
          </View>

          {!!item.circleLabels?.length && <CircleLabel circles={item.circleLabels} onDark />}

          {(item.title || item.containsAi || item.expiresAt) && (
            <View style={styles.titleRow}>
              {item.title && <Text variant="h3" style={styles.title}>{item.title}</Text>}
              <AiLabel visible={item.containsAi} onDark />
              <ExpiryLabel expiresAt={item.expiresAt} onDark />
            </View>
          )}
          {item.caption && <Text variant="callout" style={styles.caption}>{item.caption}</Text>}
          {!!item.friendLikers?.length && (
            <FriendLikersInline
              friends={item.friendLikers}
              showLabel
              size={20}
              ringColor="#111111"
              labelColor="rgba(255,255,255,0.85)"
              onOpenUser={(id) => onOpenUser(id as Id<'users'>)}
            />
          )}
          {item.sound && (
            <SoundLabel
              sound={item.sound}
              onDark
              onPress={() => onOpenSound(item.sound!._id as Id<'sounds'>)}
              onToggleSave={() =>
                toggleSaveSound({ soundId: item.sound!._id as Id<'sounds'>, userId })
              }
            />
          )}
        </View>

        <View style={styles.actions}>
          <AnimatedPressable
            onPress={onToggleLike}
          >
            <HugeiconsIcon
              icon={FavouriteIcon}
              size={30}
              color={liked ? LIKE_RED : colors.white}
              fill={liked ? LIKE_RED : 'none'}
            />
            <Text variant="caption" style={styles.actionCount}>{likeCount}</Text>
          </AnimatedPressable>

          <AnimatedPressable style={styles.actionSpacing} onPress={openComments}>
            <HugeiconsIcon icon={Comment01Icon} size={30} color={colors.white} />
            <Text variant="caption" style={styles.actionCount}>{item.commentCount}</Text>
          </AnimatedPressable>

          <AnimatedPressable style={styles.actionSpacing} onPress={() => setShareVisible(true)}>
            <HugeiconsIcon icon={Share08Icon} size={30} color={colors.white} />
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.actionSpacing}
            onPress={onToggleSave}
          >
            <HugeiconsIcon
              icon={BookmarkIcon}
              size={30}
              color={colors.white}
              fill={saved ? colors.white : 'none'}
            />
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.actionSpacing}
            accessibilityLabel="More options"
            onPress={() => setOptionsVisible(true)}
          >
            <HugeiconsIcon icon={MoreVerticalIcon} size={30} color={colors.white} />
          </AnimatedPressable>
        </View>
      </Animated.View>

      <Animated.View style={[styles.commentsPanel, { height: panelHeight }]}>
        {commentsVisible && (
          <>
            <View style={styles.commentsHandleWrap} {...panResponder.panHandlers}>
              <View style={styles.commentsHandle} />
            </View>
            <CommentsPanel
              postId={item._id as Id<'posts'>}
              userId={userId}
              active={commentsVisible}
              poll={item.poll}
              onOpenUser={onOpenUser}
              onOpenStory={onOpenStory}
            />
          </>
        )}
      </Animated.View>

      <SharePostSheet
        visible={shareVisible}
        postId={item._id as Id<'posts'>}
        userId={userId}
        mediaUrl={item.mediaUrl}
        mediaType={item.mediaType}
        canRemix={item.audience === 'global' && !item.remixOf}
        onClose={() => setShareVisible(false)}
      />

      <PostOptionsSheet
        visible={optionsVisible}
        postId={item._id as Id<'posts'>}
        postKind="clip"
        authorId={item.author?._id as Id<'users'> | undefined}
        containsAi={item.containsAi}
        viewerId={userId}
        onClose={() => setOptionsVisible(false)}
      />
    </View>
  );
}

// A clip ad's page — same full-bleed layout as a real clip, minus the
// drag-to-expand comments panel (a plain modal sheet is plenty here), the
// sound layer (ads never carry a picked sound) and text overlays.
function AdClipPage({
  item,
  isActive,
  pageHeight,
  userId,
}: {
  item: Extract<ClipItem, { _kind: 'ad' }>;
  isActive: boolean;
  pageHeight: number;
  userId: Id<'users'>;
}) {
  const player = useVideoPlayer(item.mediaUrl ? { uri: item.mediaUrl } : null, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (isActive) player.play();
    else player.pause();
  }, [isActive, player]);

  const toggleLike = useMutation(api.likes.toggleLike);
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);
  const recordAdView = useMutation(api.ads.recordAdView);
  const recordAdClick = useMutation(api.ads.recordAdClick);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const countedView = useRef(false);

  useEffect(() => {
    if (isActive && !countedView.current) {
      countedView.current = true;
      recordAdView({ adId: item._id as Id<'ads'>, userId });
    }
  }, [isActive, item._id]);

  const handleCtaPress = () => {
    recordAdClick({ adId: item._id as Id<'ads'>, userId });
    Linking.openURL(item.link).catch(() => {});
  };

  const letter = item.displayName.charAt(0).toUpperCase();
  const gradient = (item.displayAvatarGradient as [string, string]) ?? [colors.red, colors.coral];

  const togglePlayback = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <View style={[styles.page, { height: pageHeight }]}>
      {item.mediaUrl && (
        <Pressable style={styles.media} onPress={togglePlayback}>
          <VideoView
            style={styles.media}
            player={player}
            nativeControls={false}
            contentFit="contain"
            surfaceType="textureView"
          />
        </Pressable>
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.info}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              {item.displayAvatarUrl ? (
                <Image source={{ uri: item.displayAvatarUrl }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={gradient} style={styles.avatarGradient}>
                  <Text variant="calloutBold" style={styles.avatarLetter}>{letter}</Text>
                </LinearGradient>
              )}
            </View>
            <Text variant="bodyBold" style={styles.author}>{item.displayName}</Text>
            <Text variant="caption" style={styles.sponsoredTag}>Sponsored</Text>
          </View>

          {item.title && (
            <View style={styles.titleRow}>
              <Text variant="h3" style={styles.title}>{item.title}</Text>
            </View>
          )}
          {item.caption && <Text variant="callout" style={styles.caption}>{item.caption}</Text>}

          <AnimatedPressable onPress={handleCtaPress}>
            <View style={[styles.ctaButton, { backgroundColor: item.buttonColor }]}>
              <Text variant="calloutBold" style={styles.ctaButtonText}>{item.buttonText}</Text>
            </View>
          </AnimatedPressable>
        </View>

        <View style={styles.actions}>
          <AnimatedPressable
            onPress={() => toggleLike({ postId: item.postId as Id<'posts'>, userId })}
          >
            <HugeiconsIcon
              icon={FavouriteIcon}
              size={30}
              color={item.isLiked ? LIKE_RED : colors.white}
              fill={item.isLiked ? LIKE_RED : 'none'}
            />
            <Text variant="caption" style={styles.actionCount}>{item.likeCount}</Text>
          </AnimatedPressable>

          <AnimatedPressable style={styles.actionSpacing} onPress={() => setCommentsVisible(true)}>
            <HugeiconsIcon icon={Comment01Icon} size={30} color={colors.white} />
            <Text variant="caption" style={styles.actionCount}>{item.commentCount}</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.actionSpacing}
            onPress={() => toggleBookmark({ postId: item.postId as Id<'posts'>, userId })}
          >
            <HugeiconsIcon
              icon={BookmarkIcon}
              size={30}
              color={colors.white}
              fill={item.isBookmarked ? colors.white : 'none'}
            />
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.actionSpacing}
            accessibilityLabel="More options"
            onPress={() => setOptionsVisible(true)}
          >
            <HugeiconsIcon icon={MoreVerticalIcon} size={30} color={colors.white} />
          </AnimatedPressable>
        </View>
      </View>

      <CommentsSheet
        visible={commentsVisible}
        postId={item.postId as Id<'posts'>}
        userId={userId}
        onClose={() => setCommentsVisible(false)}
        onOpenUser={() => {}}
        onOpenStory={() => {}}
      />

      <AdOptionsSheet
        visible={optionsVisible}
        creator={item.creator}
        postId={item.postId as Id<'posts'>}
        reporterId={userId}
        postKind="clip"
        onClose={() => setOptionsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  page: {
    width: '100%',
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  media: {
    ...StyleSheet.absoluteFill,
  },
  remixedMedia: {
    flex: 1,
  },
  mediaShrinkWrap: {
    ...StyleSheet.absoluteFill,
    transformOrigin: 'top',
  },
  commentsBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  commentsPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  commentsHandleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  commentsHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.buttonBackground,
  },
  filterButton: {
    position: 'absolute',
    top: 44,
    alignSelf: 'center',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: space.sm,
  },
  filterText: {
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    left: space.xl,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playbackScrubber: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    height: 20,
    justifyContent: 'center',
  },
  playbackTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  playbackFill: {
    height: '100%',
    borderRadius: 1.5,
    backgroundColor: colors.white,
  },
  playbackThumb: {
    position: 'absolute',
    top: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
    marginLeft: -8,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.xxxl,
  },
  info: {
    flex: 1,
    gap: space.xs,
    paddingRight: space.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  avatarGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    flex: 1,
  },
  avatarLetter: {
    color: colors.white,
  },
  author: {
    color: colors.white,
  },
  sponsoredTag: {
    color: 'rgba(255,255,255,0.7)',
  },
  ctaButton: {
    marginTop: space.xxs,
    alignSelf: 'flex-start',
    height: 40,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: '#ffffff',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  title: {
    color: colors.white,
  },
  caption: {
    color: 'rgba(255,255,255,0.85)',
  },
  actions: {
    alignItems: 'center',
    gap: space.lg,
  },
  actionSpacing: {
    marginTop: space.xxs,
  },
  actionCount: {
    marginTop: space.xxs,
    fontFamily: 'Poppins_600SemiBold',
    color: colors.white,
    textAlign: 'center',
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  stateText: {
    color: colors.textMuted,
    textAlign: 'center',
  },
});
