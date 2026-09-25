import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Linking, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  BookmarkIcon,
  Comment01Icon,
  FavouriteIcon,
  MoreHorizontalIcon,
} from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import CommentsSheet from './CommentsSheet';
import AdOptionsSheet from './AdOptionsSheet';
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
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 14 }).start();
  }, [active]);
  return scale;
}

// A button color is picked freely from a swatch, so its own contrast against
// the color's usual white label needs checking rather than assumed.
function readableTextOn(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#ffffff';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111111' : '#ffffff';
}

export type AdPost = {
  _id: string;
  postId: string;
  title?: string;
  caption?: string;
  mediaType: 'photo' | 'video';
  mediaUrl: string | null;
  displayName: string;
  displayAvatarUrl: string | null;
  displayAvatarGradient?: string[] | null;
  buttonText: string;
  buttonColor: string;
  link: string;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  creator: {
    _id: Id<'users'>;
    name?: string;
    username?: string;
    avatarUrl: string | null;
    isVerified?: boolean;
  } | null;
};

const AVATAR_SIZE = 40;

export default function AdCard({
  ad,
  viewerId,
  isActive = true,
}: {
  ad: AdPost;
  viewerId: Id<'users'>;
  isActive?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const toggleLike = useMutation(api.likes.toggleLike);
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);
  const recordAdView = useMutation(api.ads.recordAdView);
  const recordAdClick = useMutation(api.ads.recordAdClick);
  const heartScale = usePopOnChange(ad.isLiked);
  const bookmarkScale = usePopOnChange(ad.isBookmarked);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const countedView = useRef(false);

  useEffect(() => {
    if (isActive && !countedView.current) {
      countedView.current = true;
      recordAdView({ adId: ad._id as Id<'ads'>, userId: viewerId });
    }
  }, [isActive, ad._id]);

  const handleCtaPress = () => {
    recordAdClick({ adId: ad._id as Id<'ads'>, userId: viewerId });
    Linking.openURL(ad.link).catch(() => {});
  };

  const player = useVideoPlayer(
    isActive && ad.mediaType === 'video' && ad.mediaUrl ? { uri: ad.mediaUrl } : null,
    (p) => {
      if (ad.mediaType === 'video') {
        p.loop = true;
        p.muted = true;
        p.play();
      }
    }
  );

  useEffect(() => {
    if (ad.mediaType !== 'video') return;
    if (isActive) player.play();
    else player.pause();
  }, [isActive, player, ad.mediaType]);

  const letter = ad.displayName.charAt(0).toUpperCase();
  const gradient = (ad.displayAvatarGradient as [string, string]) ?? [colors.red, colors.coral];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {ad.displayAvatarUrl ? (
            <Image source={{ uri: ad.displayAvatarUrl }} style={styles.avatarImage} />
          ) : (
            <LinearGradient colors={gradient} style={styles.avatarGradient}>
              <Text style={styles.avatarLetter}>{letter}</Text>
            </LinearGradient>
          )}
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.authorName}>{ad.displayName}</Text>
          <Text style={styles.sponsoredLabel}>Sponsored</Text>
        </View>

        <AnimatedPressable
          style={styles.moreButton}
          accessibilityLabel="More options"
          onPress={() => setOptionsVisible(true)}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={20} color={colors.textMuted} />
        </AnimatedPressable>
      </View>

      {ad.title && (
        <View style={styles.titleRow}>
          <Text style={styles.title}>{ad.title}</Text>
        </View>
      )}

      {ad.mediaUrl && (
        <View style={styles.mediaWrap}>
          {ad.mediaType === 'photo' ? (
            <Image source={{ uri: ad.mediaUrl }} style={styles.media} resizeMode="cover" />
          ) : (
            <VideoView style={styles.media} player={player} nativeControls={false} contentFit="contain" />
          )}
        </View>
      )}

      <View style={styles.actions}>
        <AnimatedPressable
          onPress={() => toggleLike({ postId: ad.postId as Id<'posts'>, userId: viewerId })}
        >
          <View style={styles.likeAction}>
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <HugeiconsIcon
                icon={FavouriteIcon}
                size={22}
                color={ad.isLiked ? colors.red : colors.textMuted}
                fill={ad.isLiked ? colors.red : 'none'}
              />
            </Animated.View>
            {ad.likeCount > 0 && (
              <Text style={[styles.likeCount, ad.isLiked && styles.likeCountActive]}>
                {ad.likeCount}
              </Text>
            )}
          </View>
        </AnimatedPressable>

        <AnimatedPressable onPress={() => setCommentsVisible(true)}>
          <View style={styles.likeAction}>
            <HugeiconsIcon icon={Comment01Icon} size={22} color={colors.textMuted} />
            {ad.commentCount > 0 && <Text style={styles.likeCount}>{ad.commentCount}</Text>}
          </View>
        </AnimatedPressable>

        <AnimatedPressable
          style={styles.bookmarkAction}
          onPress={() => toggleBookmark({ postId: ad.postId as Id<'posts'>, userId: viewerId })}
        >
          <Animated.View style={{ transform: [{ scale: bookmarkScale }] }}>
            <HugeiconsIcon
              icon={BookmarkIcon}
              size={22}
              color={ad.isBookmarked ? colors.white : colors.textMuted}
              fill={ad.isBookmarked ? colors.white : 'none'}
            />
          </Animated.View>
        </AnimatedPressable>
      </View>

      {ad.caption && <Text style={styles.caption}>{ad.caption}</Text>}

      <AnimatedPressable onPress={handleCtaPress}>
        <View style={[styles.ctaButton, { backgroundColor: ad.buttonColor }]}>
          <Text style={[styles.ctaButtonText, { color: readableTextOn(ad.buttonColor) }]}>
            {ad.buttonText}
          </Text>
        </View>
      </AnimatedPressable>

      <CommentsSheet
        visible={commentsVisible}
        postId={ad.postId as Id<'posts'>}
        userId={viewerId}
        onClose={() => setCommentsVisible(false)}
        onOpenUser={() => {}}
        onOpenStory={() => {}}
      />
      <AdOptionsSheet
        visible={optionsVisible}
        creator={ad.creator}
        postId={ad.postId as Id<'posts'>}
        reporterId={viewerId}
        postKind="post"
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
      borderWidth: 1.5,
      borderColor: colors.border,
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
    nameCol: {
      gap: 1,
    },
    authorName: {
      ...typography.bodyBold,
      color: colors.white,
    },
    sponsoredLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    moreButton: {
      marginLeft: 'auto',
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
    },
    title: {
      ...typography.h2,
      color: colors.white,
    },
    mediaWrap: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: '#111',
    },
    media: {
      flex: 1,
    },
    caption: {
      ...typography.callout,
      color: colors.textMuted,
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
      ...typography.calloutBold,
      color: colors.textMuted,
    },
    likeCountActive: {
      color: colors.red,
    },
    ctaButton: {
      height: 48,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaButtonText: {
      ...typography.bodyBold,
    },
  });
