import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, Delete02Icon } from '@hugeicons/core-free-icons';
import PostTextOverlay from '../components/PostTextOverlay';
import { readableError } from '../errorMessage';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
// Deliberately not theme-reactive — full-screen media stage, always dark
// regardless of the app's own light/dark setting, same as Stories/Clips.
import { mediaColors as colors } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_DURATION_MS = 6000;
const FALLBACK_VIDEO_DURATION_MS = 8000;
const MAX_VIDEO_DURATION_MS = 90000;

export default function HighlightViewerScreen({
  highlightId,
  viewerId,
  onClose,
  onDeleted,
}: {
  highlightId: Id<'highlights'>;
  viewerId: Id<'users'>;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const styles = createStyles();
  const { t } = useTranslation('highlights');
  const highlight = useQuery(api.highlights.getHighlightItems, { highlightId, viewerId });
  const deleteHighlight = useMutation(api.highlights.deleteHighlight);
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceScale = useRef(new Animated.Value(1.04)).current;

  const items = highlight?.items;
  const current = items?.[index];
  const isOwner = highlight?.ownerId === viewerId;

  const player = useVideoPlayer(
    current?.mediaType === 'video' && current.mediaUrl ? { uri: current.mediaUrl } : null,
    (p) => {
      p.loop = false;
      p.play();
    }
  );

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
    if (!items || items.length === 0) {
      onClose();
      return;
    }
    if (index < items.length - 1) {
      setIndex((i) => i + 1);
    } else {
      onClose();
    }
  };
  const goPrev = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(entranceOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(entranceScale, { toValue: 1, speed: 18, bounciness: 3, useNativeDriver: true }),
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

  const handleDelete = () => {
    holdStart();
    Alert.alert(t('deleteConfirmTitle'), t('deleteConfirmMessage'), [
      { text: t('common:cancel'), style: 'cancel', onPress: holdEnd },
      {
        text: t('common:delete'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteHighlight({ highlightId, ownerId: viewerId });
            onDeleted();
          } catch (err) {
            Alert.alert(t('common:error'), readableError(err));
            setDeleting(false);
            holdEnd();
          }
        },
      },
    ]);
  };

  if (highlight === null || (items && items.length === 0)) {
    return (
      <Animated.View style={[styles.container, { opacity: entranceOpacity }]}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.white} />
        </Pressable>
        <StatusBar style="light" />
      </Animated.View>
    );
  }

  const owner = highlight?.owner;
  const displayName = owner?.name ?? owner?.username ?? t('someoneFallback');
  const letter = (owner?.username ?? displayName).charAt(0).toUpperCase();
  const gradient = (owner?.avatarGradient as [string, string]) ?? [colors.red, colors.coral];

  return (
    <Animated.View
      style={[styles.container, { opacity: entranceOpacity, transform: [{ scale: entranceScale }] }]}
    >
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
      {current?.textOverlay && (
        <PostTextOverlay overlay={current.textOverlay} ready={current.mediaType !== 'video' || frameReady} />
      )}

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
        style={styles.topScrim}
      />

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

      <View style={styles.progressRow}>
        {items?.map((item, i) => (
          <View key={item._id} style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width:
                    i < index
                      ? '100%'
                      : i > index
                        ? '0%'
                        : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.header}>
        <View style={styles.avatar}>
          {owner?.avatarUrl ? (
            <Image source={{ uri: owner.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <LinearGradient colors={gradient} style={styles.avatarGradient}>
              <Text style={styles.avatarLetter}>{letter}</Text>
            </LinearGradient>
          )}
        </View>
        <View style={styles.headerText}>
          <Text variant="calloutBold" style={styles.highlightName} numberOfLines={1}>
            {highlight?.name}
          </Text>
          <Text variant="footnote" style={styles.ownerName} numberOfLines={1}>
            {displayName}
          </Text>
        </View>

        {isOwner && (
          <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleting}>
            <HugeiconsIcon icon={Delete02Icon} size={19} color={colors.white} />
          </Pressable>
        )}
        <Pressable style={styles.closeButton} onPress={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.white} />
        </Pressable>
      </View>

      <StatusBar style="light" />
    </Animated.View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    media: { ...StyleSheet.absoluteFill },
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
    progressFill: { height: '100%', backgroundColor: colors.white },
    topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 170 },
    header: {
      position: 'absolute',
      top: 66,
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerText: { flex: 1 },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: '#ffffff',
    },
    avatarGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    avatarImage: { flex: 1 },
    avatarLetter: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#ffffff' },
    highlightName: {
      color: colors.white,
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowRadius: 4,
    },
    ownerName: { color: 'rgba(255,255,255,0.7)' },
    closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    deleteButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  });
