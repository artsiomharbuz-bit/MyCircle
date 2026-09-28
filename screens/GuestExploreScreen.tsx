import { useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'convex/react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Comment01Icon, FavouriteIcon, Image02Icon } from '@hugeicons/core-free-icons';
import { api } from '../convex/_generated/api';
import ClipTile from '../components/ClipTile';
import ClipTileSkeleton from '../components/ClipTileSkeleton';
import PostCardSkeleton from '../components/PostCardSkeleton';
import EmptyState from '../components/EmptyState';
import { NAV_BAR_HEIGHT } from '../components/BottomNavBar';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

type GuestPost = {
  _id: string;
  title?: string;
  caption?: string;
  mediaType: 'photo' | 'video';
  mediaUrl: string | null;
  likeCount: number;
  commentCount: number;
  author: {
    _id: string;
    name?: string;
    username?: string;
    avatarUrl: string | null;
    avatarGradient?: string[];
  } | null;
};

// A guest never has an account to have liked/bookmarked anything with, so
// ClipTile (which types those as required) just gets a fixed `false` here.
function toClipTilePost(post: GuestPost) {
  return { ...post, isLiked: false, isBookmarked: false };
}

function GuestPostCard({ post }: { post: GuestPost }) {
  const { colors } = useAppTheme();
  const { t } = useTranslation(['guestExplore', 'common']);
  const styles = createStyles(colors);
  const isVideo = post.mediaType === 'video' && !!post.mediaUrl;
  const player = useVideoPlayer(isVideo ? { uri: post.mediaUrl! } : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const displayName = post.author?.name ?? post.author?.username ?? t('someoneFallback');

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {post.author?.avatarUrl ? (
          <Image source={{ uri: post.author.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text variant="calloutBold" style={styles.authorName}>
          {displayName}
        </Text>
      </View>

      <View style={styles.media}>
        {isVideo ? (
          <VideoView
            style={StyleSheet.absoluteFill}
            player={player}
            nativeControls={false}
            contentFit="cover"
            surfaceType="textureView"
            pointerEvents="none"
          />
        ) : post.mediaUrl ? (
          <Image source={{ uri: post.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
      </View>

      {!!post.caption && (
        <Text variant="body" style={styles.caption} numberOfLines={3}>
          {post.caption}
        </Text>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <HugeiconsIcon icon={FavouriteIcon} size={18} color={colors.textMuted} />
          <Text variant="footnote" style={styles.statText}>{post.likeCount}</Text>
        </View>
        <View style={styles.statItem}>
          <HugeiconsIcon icon={Comment01Icon} size={18} color={colors.textMuted} />
          <Text variant="footnote" style={styles.statText}>{post.commentCount}</Text>
        </View>
      </View>
    </View>
  );
}

// The signed-out landing point for "Try as guest" (see WelcomeScreen /
// LoginScreen / RegisterScreen). Deliberately a separate, self-contained
// screen rather than a guest branch inside ExploreScreen — that screen's
// PostCard/AdCard rendering, engagement mutations and impression logging
// all assume a real signed-in viewerId throughout, and threading a "no
// viewer" case through all of that is a lot of risk for what a guest
// actually needs here: something to look at, read-only, with a clear path
// to creating an account. See convex/posts.ts's listExplorePublic /
// listClipsPublic for the matching unauthenticated queries.
export default function GuestExploreScreen({
  onRequireAuth,
}: {
  onRequireAuth: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const { t } = useTranslation(['guestExplore', 'common']);
  const styles = createStyles(colors);
  const posts = useQuery(api.posts.listExplorePublic, {}) as GuestPost[] | undefined;
  const clips = useQuery(api.posts.listClipsPublic, {}) as GuestPost[] | undefined;
  const [dismissedBanner, setDismissedBanner] = useState(false);

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        data={posts}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={
          <>
            <View style={styles.topBar}>
              <Text variant="h3" style={styles.brand}>{t('common:appName')}</Text>
              <Pressable style={styles.loginPill} onPress={onRequireAuth}>
                <Text variant="calloutBold" style={styles.loginPillText}>{t('loginButton')}</Text>
              </Pressable>
            </View>

            {clips === undefined ? (
              <View style={styles.clipsSection}>
                <Text variant="h3" style={styles.clipsHeading}>{t('common:tabClips')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clipsRow}>
                  <ClipTileSkeleton />
                  <ClipTileSkeleton />
                  <ClipTileSkeleton />
                </ScrollView>
              </View>
            ) : clips.length > 0 ? (
              <View style={styles.clipsSection}>
                <Text variant="h3" style={styles.clipsHeading}>{t('common:tabClips')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clipsRow}>
                  {clips.map((clip) => (
                    <ClipTile key={clip._id} post={toClipTilePost(clip)} onPress={onRequireAuth} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          posts === undefined ? (
            <>
              <PostCardSkeleton />
              <PostCardSkeleton />
            </>
          ) : (
            <EmptyState icon={Image02Icon} message={t('nothingHereMessage')} style={styles.emptyState} />
          )
        }
        renderItem={({ item }) => <GuestPostCard post={item} />}
      />

      {!dismissedBanner && (
        <View style={styles.banner}>
          <Text variant="calloutBold" style={styles.bannerText}>
            {t('bannerMessage')}
          </Text>
          <View style={styles.bannerActions}>
            <Pressable style={styles.bannerButton} onPress={onRequireAuth}>
              <Text variant="calloutBold" style={styles.bannerButtonText}>{t('joinButton')}</Text>
            </Pressable>
            <Pressable
              style={styles.bannerDismiss}
              onPress={() => setDismissedBanner(true)}
              hitSlop={8}
            >
              <Text variant="callout" style={styles.bannerDismissText}>{t('notNowButton')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: space.xl,
      paddingBottom: NAV_BAR_HEIGHT + space.xxl * 2,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.xl,
      marginBottom: space.lg,
    },
    brand: {
      color: colors.white,
    },
    loginPill: {
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      borderRadius: radius.button,
      backgroundColor: colors.buttonBackground,
    },
    loginPillText: {
      color: colors.buttonText,
    },
    emptyState: {
      marginTop: space.xxl,
    },
    clipsSection: {
      marginBottom: space.lg,
    },
    clipsHeading: {
      color: colors.white,
      marginBottom: space.sm,
      paddingHorizontal: space.xl,
    },
    clipsRow: {
      gap: space.sm,
      paddingHorizontal: space.xl,
    },
    card: {
      marginHorizontal: space.xl,
      marginBottom: space.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      marginBottom: space.sm,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    avatarFallback: {
      backgroundColor: colors.buttonBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetter: {
      ...typography.calloutBold,
      color: colors.white,
    },
    authorName: {
      color: colors.white,
    },
    media: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: '#111',
    },
    caption: {
      marginTop: space.sm,
      color: colors.white,
    },
    statsRow: {
      flexDirection: 'row',
      gap: space.md,
      marginTop: space.sm,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      color: colors.textMuted,
    },
    banner: {
      position: 'absolute',
      left: space.md,
      right: space.md,
      bottom: NAV_BAR_HEIGHT + space.sm,
      padding: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.buttonBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bannerText: {
      color: colors.white,
    },
    bannerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: space.sm,
    },
    bannerButton: {
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      borderRadius: radius.button,
      backgroundColor: colors.red,
    },
    bannerButtonText: {
      color: colors.accentText,
    },
    bannerDismiss: {
      paddingHorizontal: space.xs,
      paddingVertical: space.xs,
    },
    bannerDismissText: {
      color: colors.textMuted,
    },
  });
