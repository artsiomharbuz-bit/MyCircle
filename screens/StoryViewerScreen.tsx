import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, FavouriteIcon } from '@hugeicons/core-free-icons';
import { formatRelativeTime } from '../formatRelativeTime';
import PostTextOverlay from '../components/PostTextOverlay';
import RemixFrame from '../components/RemixFrame';
import VerifiedBadge from '../components/VerifiedBadge';
import CircleLabel from '../components/CircleLabel';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
// Deliberately not theme-reactive — full-screen story stage, always dark
// regardless of the app's own light/dark setting, same as Clips.
import { mediaColors as colors } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Photos hold for a fixed window; a video story runs exactly as long as the
// video itself (read from the player once it has loaded), so a clip is never
// cut off or left hanging.
const PHOTO_DURATION_MS = 6000;
const FALLBACK_VIDEO_DURATION_MS = 8000;
const MAX_VIDEO_DURATION_MS = 90000;
const MAX_FLOATING_LIKES = 20;

function FloatingHeart({ index }: { index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.delay(index * 70),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(index * 70),
        Animated.timing(translateY, {
          toValue: -(220 + index * 10),
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(index * 70),
        Animated.spring(scale, { toValue: 1, speed: 14, bounciness: 5, useNativeDriver: true }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [index, opacity, scale, translateY]);

  return (
    <Animated.View
      style={[
        { position: 'absolute', bottom: 76 },
        {
          left: `${18 + ((index * 29) % 64)}%`,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <HugeiconsIcon icon={FavouriteIcon} size={24} color="#ff3b30" fill="#ff3b30" />
    </Animated.View>
  );
}

export default function StoryViewerScreen({
  authorId,
  viewerId,
  onClose,
  onOpenClip,
}: {
  authorId: Id<'users'>;
  viewerId: Id<'users'>;
  onClose: () => void;
  // Only ever called for a remixed story — see RemixFrame.
  onOpenClip: (postId: Id<'posts'>) => void;
}) {
  const styles = createStyles();
  const { t } = useTranslation('storyViewer');
  const author = useQuery(api.users.getUser, { userId: authorId });
  const stories = useQuery(api.stories.getStoriesByAuthor, { authorId, viewerId });
  const toggleStoryLike = useMutation(api.stories.toggleStoryLike);
  const [index, setIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceScale = useRef(new Animated.Value(1.04)).current;

  const current = stories?.[index];

  const player = useVideoPlayer(
    current?.mediaType === 'video' && current.mediaUrl ? { uri: current.mediaUrl } : null,
    (p) => {
      p.loop = false;
      p.play();
    }
  );

  // null until known (video still loading).
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const pausedProgress = useRef(0);
  const holding = useRef(false);
  const [frameReady, setFrameReady] = useState(false);
  useEffect(() => {
    setFrameReady(false);
  }, [index, current?._id]);

  useEffect(() => {
    if (!current) return;
    if (current.mediaType !== 'video') {
      setDurationMs(PHOTO_DURATION_MS);
      return;
    }
    setDurationMs(null);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const seconds = player.duration;
      if (seconds > 0) {
        setDurationMs(Math.min(seconds * 1000, MAX_VIDEO_DURATION_MS));
        clearInterval(timer);
      } else if (Date.now() - startedAt > 5000) {
        setDurationMs(FALLBACK_VIDEO_DURATION_MS);
        clearInterval(timer);
      }
    }, 120);
    return () => clearInterval(timer);
  }, [index, current?._id, player]);

  const runProgress = (from: number) => {
    if (!durationMs) return null;
    progress.setValue(from);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: durationMs * (1 - from),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
    return anim;
  };

  // Press-and-hold anywhere on the story pauses it (and its video).
  const holdStart = () => {
    if (holding.current) return;
    holding.current = true;
    progress.stopAnimation((value) => {
      pausedProgress.current = value;
    });
    player.pause();
  };
  const holdEnd = () => {
    if (!holding.current) return;
    holding.current = false;
    player.play();
    runProgress(pausedProgress.current);
  };

  const goNext = () => {
    if (!stories || stories.length === 0) {
      onClose();
      return;
    }
    if (index < stories.length - 1) {
      setIndex((i) => i + 1);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    setIndex((i) => Math.max(0, i - 1));
  };

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(entranceScale, {
        toValue: 1,
        speed: 18,
        bounciness: 3,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [entranceOpacity, entranceScale]);

  useEffect(() => {
    progress.setValue(0);
    pausedProgress.current = 0;
    holding.current = false;
    if (!current || !durationMs) return;

    const anim = runProgress(0);
    return () => anim?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?._id, durationMs]);

  if (stories && stories.length === 0) {
    return (
      <Animated.View
        style={[
          styles.container,
          { opacity: entranceOpacity, transform: [{ scale: entranceScale }] },
        ]}
      >
        <Pressable style={styles.closeButton} onPress={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.white} />
        </Pressable>
        <StatusBar style="light" />
      </Animated.View>
    );
  }

  const displayName = author?.name ?? author?.username ?? t('someoneFallback');
  const letter = (author?.username ?? displayName).charAt(0).toUpperCase();
  const gradient = (author?.avatarGradient as [string, string]) ?? [colors.red, colors.coral];

  return (
    <Animated.View
      style={[styles.container, { opacity: entranceOpacity, transform: [{ scale: entranceScale }] }]}
    >
      {current?.mediaUrl && current.remixOf ? (
        <RemixFrame
          color={current.remixColor ?? '#3a3a3a'}
          username={current.remixOf.authorUsername}
          avatarUrl={current.remixOf.authorAvatarUrl}
          avatarGradient={current.remixOf.authorAvatarGradient as [string, string] | undefined}
          style={styles.media}
        >
          {current.mediaType === 'photo' ? (
            <Image source={{ uri: current.mediaUrl }} style={styles.remixedMedia} resizeMode="cover" />
          ) : (
            <VideoView
              style={styles.remixedMedia}
              player={player}
              nativeControls={false}
              onFirstFrameRender={() => setFrameReady(true)}
              contentFit="cover"
              surfaceType="textureView"
              pointerEvents="none"
            />
          )}
          {current?.textOverlay && <PostTextOverlay overlay={current.textOverlay} ready={current.mediaType !== 'video' || frameReady} />}
        </RemixFrame>
      ) : (
        <>
          {current?.mediaUrl && current.mediaType === 'photo' && (
            <Image source={{ uri: current.mediaUrl }} style={styles.media} resizeMode="cover" />
          )}
          {current?.mediaUrl && current.mediaType === 'video' && (
            <VideoView
              style={styles.media}
              player={player}
              nativeControls={false}
              onFirstFrameRender={() => setFrameReady(true)}
              contentFit="cover"
            />
          )}
          {current?.textOverlay && <PostTextOverlay overlay={current.textOverlay} ready={current.mediaType !== 'video' || frameReady} />}
        </>
      )}

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
        style={styles.topScrim}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
        style={styles.bottomScrim}
      />

      {current?.remixOf ? (
        // A remix's whole media area jumps to the original clip instead of
        // advancing the story — takes over the tap surface that prevZone/
        // nextZone normally own for this one story (auto-advance still
        // moves on when the clip finishes regardless).
        <Pressable
          style={styles.media}
          onPress={() => onOpenClip(current.remixOf!.postId as Id<'posts'>)}
          delayLongPress={200}
          onLongPress={holdStart}
          onPressOut={holdEnd}
        />
      ) : (
        <>
          <Pressable
            style={styles.prevZone}
            onPress={goPrev}
            delayLongPress={200}
            onLongPress={holdStart}
            onPressOut={holdEnd}
          />
          <Pressable
            style={styles.nextZone}
            onPress={goNext}
            delayLongPress={200}
            onLongPress={holdStart}
            onPressOut={holdEnd}
          />
        </>
      )}

      <View style={styles.progressRow}>
        {stories?.map((story, i) => (
          <View key={story._id} style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width:
                    i < index
                      ? '100%'
                      : i > index
                        ? '0%'
                        : progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.header}>
        <View style={styles.avatar}>
          {author?.avatarUrl ? (
            <Image source={{ uri: author.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <LinearGradient colors={gradient} style={styles.avatarGradient}>
              <Text style={styles.avatarLetter}>{letter}</Text>
            </LinearGradient>
          )}
        </View>
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text variant="calloutBold" style={styles.authorName} numberOfLines={1}>
              {displayName}
            </Text>
            <VerifiedBadge verified={author?.isVerified} size={14} />
          </View>
          {current && (
            <Text variant="caption" style={styles.timeLabel}>
              {formatRelativeTime(current._creationTime)}
            </Text>
          )}
          {!!current?.circleLabels?.length && (
            <View style={styles.circleLabelWrap}>
              <CircleLabel circles={current.circleLabels} onDark />
            </View>
          )}
        </View>

        <Pressable style={styles.closeButton} onPress={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.white} />
        </Pressable>
      </View>

      {current &&
        Array.from({ length: Math.min(current.likeCount, MAX_FLOATING_LIKES) }, (_, i) => (
          <FloatingHeart key={`${current._id}-${i}`} index={i} />
        ))}

      {current && (
        <Pressable
          style={styles.likeButton}
          onPress={() => toggleStoryLike({ storyId: current._id, userId: viewerId })}
        >
          <HugeiconsIcon
            icon={FavouriteIcon}
            size={28}
            color={current.isLiked ? '#ff3b30' : colors.white}
            fill={current.isLiked ? '#ff3b30' : 'none'}
          />
          {current.likeCount > 0 && (
            <Text variant="calloutBold" style={styles.likeCount}>{current.likeCount}</Text>
          )}
        </Pressable>
      )}

      <StatusBar style="light" />
    </Animated.View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    media: {
      ...StyleSheet.absoluteFill,
    },
    remixedMedia: {
      flex: 1,
    },
    prevZone: {
      position: 'absolute',
      top: 90,
      bottom: 0,
      left: 0,
      width: SCREEN_WIDTH * 0.3,
    },
    nextZone: {
      position: 'absolute',
      top: 90,
      bottom: 0,
      right: 0,
      width: SCREEN_WIDTH * 0.7,
    },
    progressRow: {
      position: 'absolute',
      top: 50,
      left: 12,
      right: 12,
      flexDirection: 'row',
      gap: 5,
    },
    progressTrack: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.28)',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.white,
    },
    header: {
      position: 'absolute',
      top: 66,
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    topScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 170,
    },
    bottomScrim: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 160,
    },
    headerText: {
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    circleLabelWrap: {
      marginTop: 4,
    },
    timeLabel: {
      color: 'rgba(255,255,255,0.7)',
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: '#ffffff',
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
      fontSize: 13,
      color: '#ffffff',
    },
    authorName: {
      flexShrink: 1,
      color: colors.white,
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowRadius: 4,
    },
    closeButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    likeButton: {
      position: 'absolute',
      right: 20,
      bottom: 32,
      minWidth: 52,
      height: 44,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    likeCount: {
      color: colors.white,
    },
  });
