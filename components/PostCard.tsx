import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  BookmarkIcon,
  Comment01Icon,
  FavouriteIcon,
  MoreHorizontalIcon,
  MusicNote02Icon,
  SentIcon,
  VolumeHighIcon,
  VolumeMute01Icon,
} from '@hugeicons/core-free-icons';
import AiLabel from './AiLabel';
import AnimatedPressable from './AnimatedPressable';
import CommentsSheet from './CommentsSheet';
import ExpiryLabel from './ExpiryLabel';
import PollCard, { PollData } from './PollCard';
import PostOptionsSheet from './PostOptionsSheet';
import PostTextOverlay, { PostTextOverlayData } from './PostTextOverlay';
import RemixFrame from './RemixFrame';
import { FriendLiker, FriendLikersInline } from './FriendLikers';
import SharePostSheet from './SharePostSheet';
import FollowButton from './FollowButton';
import { PostSound } from './SoundLabel';
import CircleLabel, { CircleLabelData } from './CircleLabel';
import { formatRelativeTime } from '../formatRelativeTime';
import VerifiedBadge from './VerifiedBadge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

function usePopOnChange(active: boolean) {
  const scale = useRef(new Animated.Value(1)).current;
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!active) return;
    scale.setValue(0.7);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 14,
    }).start();
  }, [active]);

  return scale;
}

const AVATAR_SIZE = 44;

export type Post = {
  _id: string;
  _creationTime?: number;
  title?: string;
  caption?: string;
  mediaType: 'photo' | 'video';
  mediaUrl: string | null;
  // More pictures after the first: rendered as a swipeable carousel.
  extraMediaUrls?: string[];
  // Width / height the post was taken in (null/absent on older posts: square).
  mediaAspect?: number | null;
  kind?: 'post' | 'clip';
  audience?: 'circles' | 'global';
  circleLabels?: CircleLabelData[];
  containsAi?: boolean;
  expiresAt?: number | null;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  friendLikers?: FriendLiker[];
  author: {
    _id: Id<'users'>;
    name?: string;
    username?: string;
    avatarUrl: string | null;
    avatarGradient?: string[];
    isVerified?: boolean;
  } | null;
  // Only ever set for video — a photo has its text burned into the image
  // itself instead, so it needs no separate overlay to render.
  textOverlay?: PostTextOverlayData;
  sound?: PostSound;
  poll?: PollData | null;
  remixColor?: string | null;
  remixOf?: {
    postId: string;
    authorUsername: string | null;
    authorAvatarUrl?: string | null;
    authorAvatarGradient?: string[] | null;
  } | null;
};

export default function PostCard({
  post,
  viewerId,
  isActive = true,
  onOpenUser,
  onOpenStory,
  onOpenSound,
  onOpenClip,
}: {
  post: Post;
  viewerId: Id<'users'>;
  // Whether this card is actually on screen right now. Video only loads a
  // source (and therefore only downloads anything) while this is true —
  // without it, every video post in a feed would buffer and loop forever
  // the instant it mounts, whether or not it's ever scrolled into view.
  isActive?: boolean;
  onOpenUser: (userId: Id<'users'>) => void;
  onOpenStory: (userId: Id<'users'>) => void;
  onOpenSound: (soundId: Id<'sounds'>) => void;
  // Only called for a remixed post — tapping its media jumps straight to
  // the original clip it was remixed from, not a lightbox of this post's
  // own media.
  onOpenClip: (postId: Id<'posts'>) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const toggleLike = useMutation(api.likes.toggleLike);
  const follow = useMutation(api.follows.follow);
  const unfollow = useMutation(api.follows.unfollow);
  const followingIds = useQuery(api.follows.getFollowingIds, { followerId: viewerId });
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);
  const toggleSaveSound = useMutation(api.sounds.toggleSaveSound);
  const heartScale = usePopOnChange(post.isLiked);
  const bookmarkScale = usePopOnChange(post.isBookmarked);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  // Older posts have no saved shape: read it from the media itself once it
  // loads so they too show in their original ratio.
  const [measuredAspect, setMeasuredAspect] = useState<number | null>(null);
  const measure = (width: number, height: number) => {
    if (width > 0 && height > 0) setMeasuredAspect(Math.min(2, Math.max(0.5, width / height)));
  };
  const [carouselWidth, setCarouselWidth] = useState(0);
  const photoUrls = post.mediaUrl ? [post.mediaUrl, ...(post.extraMediaUrls ?? [])] : [];
  const [frameReady, setFrameReady] = useState(false);
  useEffect(() => {
    if (!isActive) setFrameReady(false);
  }, [isActive]);
  const player = useVideoPlayer(
    isActive && post.mediaType === 'video' && post.mediaUrl ? { uri: post.mediaUrl } : null,
    (p) => {
      if (post.mediaType === 'video') {
        p.loop = true;
        p.muted = true;
        p.play();
      }
    }
  );

  useEffect(() => {
    if (post.mediaType !== 'video' || post.mediaAspect) return;
    const fromTrack = (track: { size: { width: number; height: number } } | null) => {
      if (track) measure(track.size.width, track.size.height);
    };
    fromTrack(player.videoTrack);
    const sub = player.addListener('videoTrackChange', ({ videoTrack }) => fromTrack(videoTrack));
    return () => sub.remove();
  }, [player, post.mediaType, post.mediaAspect]);

  useEffect(() => {
    if (post.mediaType === 'video') player.muted = muted;
  }, [muted, player, post.mediaType]);

  useEffect(() => {
    if (post.mediaType !== 'video') return;
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player, post.mediaType]);

  const displayName = post.author?.name ?? post.author?.username ?? 'Someone';
  const letter = (post.author?.username ?? displayName).charAt(0).toUpperCase();
  const gradient = (post.author?.avatarGradient as [string, string]) ?? [
    colors.red,
    colors.coral,
  ];
  const authorId = post.author?._id;
  const isFollowing = authorId ? followingIds?.includes(authorId) ?? false : false;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {post.author?.avatarUrl ? (
            <Image source={{ uri: post.author.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <LinearGradient colors={gradient} style={styles.avatarGradient}>
              <Text style={styles.avatarLetter}>{letter}</Text>
            </LinearGradient>
          )}
        </View>
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text style={styles.authorName} numberOfLines={1}>{displayName}</Text>
            <VerifiedBadge verified={post.author?.isVerified} />
            {!!post.circleLabels?.length && (
              <View style={styles.circleLabelInline}>
                <CircleLabel circles={post.circleLabels} />
              </View>
            )}
          </View>
          {post._creationTime !== undefined && (
            <Text style={styles.subline}>{formatRelativeTime(post._creationTime)}</Text>
          )}
        </View>
        {authorId && authorId !== viewerId && !isFollowing && (
          <FollowButton
            compact
            coral
            following={false}
            onPress={() => follow({ followerId: viewerId, followingId: authorId })}
          />
        )}

        <AnimatedPressable
          style={styles.moreButton}
          accessibilityLabel="More options"
          onPress={() => setOptionsVisible(true)}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={22} color={colors.white} />
        </AnimatedPressable>
      </View>

      {(post.title || post.containsAi || post.expiresAt) && (
        <View style={styles.titleRow}>
          {post.title && <Text style={styles.title}>{post.title}</Text>}
          <AiLabel visible={post.containsAi} />
          <ExpiryLabel expiresAt={post.expiresAt} />
        </View>
      )}

      {post.mediaUrl && (
        <View style={[styles.mediaWrap, { aspectRatio: post.mediaAspect ?? measuredAspect ?? 1 }]}>
          {post.remixOf ? (
            <Pressable
              style={styles.remixPressable}
              onPress={() => onOpenClip(post.remixOf!.postId as Id<'posts'>)}
            >
              <RemixFrame
                color={post.remixColor ?? '#3a3a3a'}
                username={post.remixOf.authorUsername}
                avatarUrl={post.remixOf.authorAvatarUrl}
                avatarGradient={post.remixOf.authorAvatarGradient as [string, string] | undefined}
              >
                {post.mediaType === 'photo' ? (
                  <Image
                    source={{ uri: post.mediaUrl }}
                    style={styles.media}
                    resizeMode="cover"
                    onLoad={(e) => measure(e.nativeEvent.source.width, e.nativeEvent.source.height)}
                  />
                ) : (
                  <VideoView
                    style={styles.media}
                    player={player}
                    nativeControls={false}
                    onFirstFrameRender={() => setFrameReady(true)}
                    contentFit="cover"
                    surfaceType="textureView"
                    pointerEvents="none"
                  />
                )}
                {post.mediaType === 'video' && post.textOverlay && (
                  <PostTextOverlay overlay={post.textOverlay} ready={frameReady} />
                )}
              </RemixFrame>
            </Pressable>
          ) : (
            <>
              {post.mediaType === 'photo' && photoUrls.length > 1 ? (
                <View
                  style={styles.media}
                  onLayout={(e) => setCarouselWidth(e.nativeEvent.layout.width)}
                >
                  {carouselWidth > 0 && (
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      nestedScrollEnabled
                      onMomentumScrollEnd={(e) =>
                        setPhotoIndex(
                          Math.round(e.nativeEvent.contentOffset.x / carouselWidth)
                        )
                      }
                    >
                      {photoUrls.map((url) => (
                        <Image
                          key={url}
                          source={{ uri: url }}
                          style={{ width: carouselWidth, height: '100%' }}
                          resizeMode="cover"
                        />
                      ))}
                    </ScrollView>
                  )}
                  <View style={styles.pageCounter} pointerEvents="none">
                    <Text style={styles.pageCounterText}>
                      {photoIndex + 1}/{photoUrls.length}
                    </Text>
                  </View>
                  <View style={styles.dots} pointerEvents="none">
                    {photoUrls.map((url, i) => (
                      <View key={url} style={[styles.dot, i === photoIndex && styles.dotActive]} />
                    ))}
                  </View>
                </View>
              ) : post.mediaType === 'photo' ? (
                <Image
                  source={{ uri: post.mediaUrl }}
                  style={styles.media}
                  resizeMode="cover"
                  onLoad={(e) => measure(e.nativeEvent.source.width, e.nativeEvent.source.height)}
                />
              ) : (
                <VideoView
                  style={styles.media}
                  player={player}
                  nativeControls={false}
                  onFirstFrameRender={() => setFrameReady(true)}
                  contentFit="cover"
                />
              )}
              {post.mediaType === 'video' && post.textOverlay && (
                <PostTextOverlay overlay={post.textOverlay} ready={frameReady} />
              )}
            </>
          )}

          {post.sound && (
            <Pressable
              style={styles.soundPill}
              onPress={() => onOpenSound(post.sound!._id as Id<'sounds'>)}
              hitSlop={6}
            >
              <HugeiconsIcon icon={MusicNote02Icon} size={18} color="#ffffff" />
              <View style={styles.soundText}>
                <Text style={styles.soundName} numberOfLines={1}>{post.sound.name}</Text>
                {!!post.sound.ownerUsername && (
                  <Text style={styles.soundOwner} numberOfLines={1}>{post.sound.ownerUsername}</Text>
                )}
              </View>
            </Pressable>
          )}

          {post.mediaType === 'video' && (
            <Pressable
              style={styles.muteButton}
              onPress={() => setMuted((m) => !m)}
              hitSlop={8}
              accessibilityLabel={muted ? 'Unmute' : 'Mute'}
            >
              <HugeiconsIcon
                icon={muted ? VolumeMute01Icon : VolumeHighIcon}
                size={18}
                color="#ffffff"
              />
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <AnimatedPressable
          onPress={() => toggleLike({ postId: post._id as Id<'posts'>, userId: viewerId })}
        >
          <View style={styles.likeAction}>
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <HugeiconsIcon
                icon={FavouriteIcon}
                size={22}
                color={post.isLiked ? colors.red : colors.white}
                fill={post.isLiked ? colors.red : 'none'}
              />
            </Animated.View>
            {post.likeCount > 0 && (
              <Text style={[styles.likeCount, post.isLiked && styles.likeCountActive]}>
                {post.likeCount}
              </Text>
            )}
          </View>
        </AnimatedPressable>

        <AnimatedPressable onPress={() => setCommentsVisible(true)}>
          <View style={styles.likeAction}>
            <HugeiconsIcon icon={Comment01Icon} size={22} color={colors.white} />
            {post.commentCount > 0 && (
              <Text style={styles.likeCount}>{post.commentCount}</Text>
            )}
          </View>
        </AnimatedPressable>

        <AnimatedPressable onPress={() => setShareVisible(true)}>
          <HugeiconsIcon icon={SentIcon} size={22} color={colors.white} />
        </AnimatedPressable>

        <AnimatedPressable
          style={styles.bookmarkAction}
          onPress={() => toggleBookmark({ postId: post._id as Id<'posts'>, userId: viewerId })}
        >
          <Animated.View style={{ transform: [{ scale: bookmarkScale }] }}>
            <HugeiconsIcon
              icon={BookmarkIcon}
              size={22}
              color={colors.white}
              fill={post.isBookmarked ? colors.white : 'none'}
            />
          </Animated.View>
        </AnimatedPressable>
      </View>

      {!!post.friendLikers?.length && (
        <FriendLikersInline
          friends={post.friendLikers}
          showLabel
          likedBy
          size={26}
          onOpenUser={(id) => onOpenUser(id as Id<'users'>)}
        />
      )}

      {post.caption && (
        <Text style={styles.caption}>
          {post.caption}
        </Text>
      )}

      {post.commentCount > 0 && (
        <Pressable onPress={() => setCommentsVisible(true)}>
          <Text style={styles.viewComments}>
            View all {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
          </Text>
        </Pressable>
      )}

      {post.poll && (
        <PollCard poll={post.poll} postId={post._id as Id<'posts'>} viewerId={viewerId} />
      )}

      <CommentsSheet
        visible={commentsVisible}
        postId={post._id as Id<'posts'>}
        userId={viewerId}
        onClose={() => setCommentsVisible(false)}
        onOpenUser={onOpenUser}
        onOpenStory={onOpenStory}
      />
      <SharePostSheet
        visible={shareVisible}
        postId={post._id as Id<'posts'>}
        userId={viewerId}
        mediaUrl={post.mediaUrl}
        mediaType={post.mediaType}
        canRemix={post.kind === 'clip' && post.audience === 'global'}
        onClose={() => setShareVisible(false)}
      />
      <PostOptionsSheet
        visible={optionsVisible}
        postId={post._id as Id<'posts'>}
        postKind={post.kind === 'clip' ? 'clip' : 'post'}
        authorId={authorId}
        containsAi={post.containsAi}
        viewerId={viewerId}
        onClose={() => setOptionsVisible(false)}
      />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
  card: {
    marginHorizontal: space.md,
    marginBottom: space.lg,
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.inputBackground,
    gap: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
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
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#ffffff',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  circleLabelInline: {
    marginLeft: space.xs,
    flexShrink: 1,
  },
  subline: {
    ...typography.footnote,
    color: colors.textMuted,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    flexShrink: 1,
    ...typography.bodyBold,
    color: colors.white,
  },
  moreButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundRow: {
    // Lines up under the name, not the avatar — the same indent as the
    // header row's avatar (40) plus its gap (10).
    marginLeft: AVATAR_SIZE + space.sm,
    marginTop: -6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  title: {
    ...typography.body,
    color: colors.white,
  },
  mediaWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  media: {
    flex: 1,
  },
  remixPressable: {
    flex: 1,
  },
  caption: {
    ...typography.body,
    color: colors.white,
  },
  captionAuthor: {
    fontFamily: 'Poppins_600SemiBold',
  },
  viewComments: {
    ...typography.body,
    color: colors.textMuted,
  },
  soundPill: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    maxWidth: '68%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: 6,
    paddingLeft: space.sm,
    paddingRight: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  soundText: {
    flexShrink: 1,
  },
  soundName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    lineHeight: 17,
    color: '#ffffff',
  },
  soundOwner: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },
  pageCounter: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pageCounterText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#ffffff',
  },
  dots: {
    position: 'absolute',
    top: space.sm + 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: '#ffffff',
  },
  muteButton: {
    position: 'absolute',
    right: space.sm,
    bottom: space.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  likeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs + 2,
  },
  bookmarkAction: {
    marginLeft: 'auto',
  },
  likeCount: {
    ...typography.bodyBold,
    color: colors.white,
  },
  likeCountActive: {
    color: colors.red,
  },
});
