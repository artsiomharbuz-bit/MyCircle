import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  BookmarkIcon,
  FavouriteIcon,
  MusicNote02Icon,
  PlayIcon,
} from '@hugeicons/core-free-icons';
import EmptyState from '../components/EmptyState';
import FadeInView from '../components/FadeInView';
import PostCard from '../components/PostCard';
import PostCardSkeleton from '../components/PostCardSkeleton';
import Skeleton from '../components/Skeleton';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export type ProfileActivityMode = 'liked' | 'saved';

type SubTab = 'posts' | 'clips' | 'sounds';

// The viewer's own private "Liked" / "Saved" history — never reachable for
// anyone else's profile (App.tsx only ever opens this from ProfileScreen's
// self-only quick-access buttons).
export default function ProfileActivityScreen({
  userId,
  mode,
  onBack,
  onOpenUser,
  onOpenStory,
  onOpenClip,
  onOpenSound,
}: {
  userId: Id<'users'>;
  mode: ProfileActivityMode;
  onBack: () => void;
  onOpenUser: (userId: Id<'users'>) => void;
  onOpenStory: (userId: Id<'users'>) => void;
  onOpenClip: (postId: Id<'posts'>) => void;
  onOpenSound: (soundId: Id<'sounds'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const { t } = useTranslation(['profileActivity', 'common']);
  const styles = createStyles(colors);
  const [subTab, setSubTab] = useState<SubTab>('posts');

  const posts = useQuery(
    mode === 'liked' ? api.posts.listLikedPosts : api.posts.listSavedPosts,
    { viewerId: userId }
  );
  const sounds = useQuery(
    api.sounds.browseSounds,
    mode === 'saved' && subTab === 'sounds' ? { viewerId: userId, tab: 'saved' } : 'skip'
  );

  const visiblePosts = posts?.filter((post) => post.kind !== 'clip');
  const visibleClips = posts?.filter((post) => post.kind === 'clip');

  const tabs: { id: SubTab; label: string }[] =
    mode === 'saved'
      ? [
          { id: 'posts', label: t('tabPosts') },
          { id: 'clips', label: t('tabClips') },
          { id: 'sounds', label: t('tabSounds') },
        ]
      : [
          { id: 'posts', label: t('tabPosts') },
          { id: 'clips', label: t('tabClips') },
        ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>{mode === 'liked' ? t('titleLiked') : t('titleSaved')}</Text>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, subTab === tab.id && styles.tabSelected]}
            onPress={() => setSubTab(tab.id)}
          >
            <Text style={[styles.tabLabel, subTab === tab.id && styles.tabLabelSelected]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {subTab === 'sounds' ? (
          sounds === undefined ? (
            [0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.soundRow}>
                <Skeleton style={styles.soundPictureSkeleton} />
                <View style={styles.soundText}>
                  <Skeleton style={styles.soundNameSkeleton} />
                  <Skeleton style={styles.soundMetaSkeleton} />
                </View>
              </View>
            ))
          ) : sounds.length > 0 ? (
            sounds.map((sound) => (
              <Pressable
                key={sound._id}
                style={styles.soundRow}
                onPress={() => onOpenSound(sound._id as Id<'sounds'>)}
              >
                {sound.pictureUrl ? (
                  <Image source={{ uri: sound.pictureUrl }} style={styles.soundPicture} />
                ) : (
                  <View style={styles.soundPictureFallback}>
                    <HugeiconsIcon icon={MusicNote02Icon} size={18} color={colors.white} />
                  </View>
                )}
                <View style={styles.soundText}>
                  <Text style={styles.soundName} numberOfLines={1}>
                    {sound.name}
                  </Text>
                  <Text style={styles.soundMeta} numberOfLines={1}>
                    {sound.owner?.username ? `@${sound.owner.username}` : t('unknownOwner')} ·{' '}
                    {sound.useCount === 1
                      ? t('useCountOne', { count: sound.useCount })
                      : t('useCountOther', { count: sound.useCount })}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <EmptyState icon={MusicNote02Icon} message={t('noSavedSoundsEmpty')} style={styles.empty} />
          )
        ) : posts === undefined ? (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        ) : subTab === 'posts' ? (
          visiblePosts && visiblePosts.length > 0 ? (
            visiblePosts.map((post) => (
              <FadeInView key={post._id}>
                <PostCard
                  post={post}
                  viewerId={userId}
                  onOpenUser={onOpenUser}
                  onOpenStory={onOpenStory}
                  onOpenSound={onOpenSound}
                  onOpenClip={onOpenClip}
                />
              </FadeInView>
            ))
          ) : (
            <EmptyState
              icon={mode === 'liked' ? FavouriteIcon : BookmarkIcon}
              message={mode === 'liked' ? t('noLikedPostsEmpty') : t('noSavedPostsEmpty')}
              style={styles.empty}
            />
          )
        ) : visibleClips && visibleClips.length > 0 ? (
          <View style={styles.grid}>
            {visibleClips.map((clip) => (
              <ActivityClipTile
                key={clip._id}
                mediaUrl={clip.mediaUrl}
                onPress={() => onOpenClip(clip._id as Id<'posts'>)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            icon={mode === 'liked' ? FavouriteIcon : BookmarkIcon}
            message={mode === 'liked' ? t('noLikedClipsEmpty') : t('noSavedClipsEmpty')}
            style={styles.empty}
          />
        )}
      </ScrollView>

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const GRID_GAP = 3;
const GRID_COLUMNS = 3;

function ActivityClipTile({ mediaUrl, onPress }: { mediaUrl: string | null; onPress: () => void }) {
  const player = useVideoPlayer(mediaUrl ? { uri: mediaUrl } : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <Pressable style={tileStyles.tile} onPress={onPress}>
      {mediaUrl && (
        // surfaceType="textureView" — see ClipTile.tsx: the default
        // SurfaceView composites above everything else on Android and can
        // swallow touches meant for this Pressable regardless of
        // pointerEvents/z-order.
        <VideoView
          style={tileStyles.media}
          player={player}
          nativeControls={false}
          contentFit="cover"
          surfaceType="textureView"
          pointerEvents="none"
        />
      )}
      <View style={tileStyles.playBadge}>
        <HugeiconsIcon icon={PlayIcon} size={11} color="#ffffff" />
      </View>
    </Pressable>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: `${100 / GRID_COLUMNS}%`,
    maxWidth: `${100 / GRID_COLUMNS}%`,
    aspectRatio: 0.72,
    borderRadius: radius.xs,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  media: {
    ...StyleSheet.absoluteFill,
  },
  playBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 40,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.xl,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...typography.h2,
      color: colors.white,
    },
    tabRow: {
      flexDirection: 'row',
      gap: space.xs,
      paddingHorizontal: space.lg,
      marginTop: space.md,
    },
    tab: {
      paddingHorizontal: space.md,
      height: 34,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabSelected: {
      backgroundColor: colors.white,
      borderColor: colors.white,
    },
    tabLabel: {
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.white,
    },
    tabLabelSelected: {
      color: colors.black,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: space.md,
      paddingBottom: space.xxl,
    },
    empty: {
      marginTop: space.xxl,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: space.lg,
      gap: GRID_GAP,
    },
    soundRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.lg,
      paddingVertical: space.xs,
    },
    soundPicture: {
      width: 46,
      height: 46,
      borderRadius: radius.sm,
      backgroundColor: colors.buttonSecondary,
    },
    soundPictureFallback: {
      width: 46,
      height: 46,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonSecondary,
    },
    soundText: {
      flex: 1,
      gap: 2,
    },
    soundName: {
      ...typography.bodyBold,
      color: colors.white,
    },
    soundMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    soundPictureSkeleton: {
      width: 46,
      height: 46,
      borderRadius: 14,
    },
    soundNameSkeleton: {
      width: 140,
      height: 15,
      borderRadius: 7,
    },
    soundMetaSkeleton: {
      marginTop: 6,
      width: 100,
      height: 12,
      borderRadius: 6,
    },
  });
