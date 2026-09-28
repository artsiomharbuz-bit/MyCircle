import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View, ViewToken } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowRight01Icon, Image02Icon, Search01Icon, UserAdd01Icon } from '@hugeicons/core-free-icons';
import AdCard, { AdPost } from '../components/AdCard';
import { NAV_BAR_HEIGHT } from '../components/BottomNavBar';
import ClipTile from '../components/ClipTile';
import ClipTileSkeleton from '../components/ClipTileSkeleton';
import HeaderDropdown from '../components/HeaderDropdown';
import CollapsibleHeader, { HEADER_HEIGHT } from '../components/CollapsibleHeader';
import EmptyState from '../components/EmptyState';
import FadeInView from '../components/FadeInView';
import PostCard, { Post } from '../components/PostCard';
import PostCardSkeleton from '../components/PostCardSkeleton';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { IMPRESSIONS } from '../convex/lib/rankingConfig';
import { interleaveAds, FeedEntry } from '../interleaveAds';
import { useAppTheme } from '../ThemeContext';
import { Colors, space } from '../theme';

function entryKey(entry: FeedEntry<Post, AdPost>): string {
  return entry.kind === 'ad' ? `ad-${entry.item._id}` : entry.item._id;
}

export default function ExploreScreen({
  userId,
  scrollY,
  onOpenCamera,
  onOpenSearch,
  onOpenDiscoverFriends,
  onOpenClip,
  onOpenUser,
  onOpenStory,
  onOpenSound,
}: {
  userId: Id<'users'>;
  // Shared with the persistent BottomNavBar mounted in App.tsx, so it can
  // hide/show off this same scroll position.
  scrollY: Animated.Value;
  onOpenCamera: () => void;
  onOpenSearch: () => void;
  onOpenDiscoverFriends: () => void;
  onOpenClip: (postId: Id<'posts'>) => void;
  onOpenUser: (userId: Id<'users'>) => void;
  onOpenStory: (userId: Id<'users'>) => void;
  onOpenSound: (soundId: Id<'sounds'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const { t } = useTranslation(['explore', 'common']);
  const styles = createStyles(colors);
  const posts = useQuery(api.posts.listExploreFeed, { viewerId: userId });
  const clips = useQuery(api.posts.listClips, { viewerId: userId });
  const postAds = useQuery(api.ads.listActiveAdsForSurface, { viewerId: userId, kind: 'post' });
  // Same reasoning as Home: only the post actually on screen gets to load
  // video, everything else stays unloaded — a feed of video posts shouldn't
  // silently download every single one the moment it mounts.
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const followingIds = useQuery(api.follows.getFollowingIds, { followerId: userId });
  const [feedFilter, setFeedFilter] = useState<'for-you' | 'friends'>('for-you');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const listRef = useRef<any>(null);
  // A feed picked from the header dropdown while scrolled down: scroll back to
  // the top first, then switch once it has arrived.
  const pendingFilter = useRef<'for-you' | 'friends' | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyPendingFilter = () => {
    const next = pendingFilter.current;
    if (!next) return;
    pendingFilter.current = null;
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    setFeedFilter(next);
  };

  const pickFilter = (id: string) => {
    pendingFilter.current = id as 'for-you' | 'friends';
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(applyPendingFilter, 700);
  };

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      if (pendingFilter.current && value <= 2) applyPendingFilter();
    });
    return () => {
      scrollY.removeListener(id);
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, [scrollY]);

  const visiblePosts = useMemo(() => {
    if (!posts) return undefined;
    if (feedFilter === 'for-you') return posts;
    const following = new Set(followingIds ?? []);
    return posts.filter((post) => post.author && following.has(post.author._id as Id<'users'>));
  }, [posts, feedFilter, followingIds]);

  const feed = useMemo(
    () =>
      visiblePosts
        ? interleaveAds(visiblePosts, feedFilter === 'for-you' ? postAds ?? [] : [])
        : undefined,
    [visiblePosts, postAds, feedFilter]
  );

  // Same dwell-time impression logging as HomeScreen (see there for why the
  // duration is a normalization constant rather than an intrinsic value).
  // Ads are excluded — their own delivery is tracked via adImpressions
  // (see AdCard's recordAdView).
  const logImpressions = useMutation(api.impressions.logContentImpressions);
  const dwellRef = useRef<{ postId: string; startedAt: number } | null>(null);
  const flushDwell = () => {
    const current = dwellRef.current;
    if (!current) return;
    dwellRef.current = null;
    const watchMs = Date.now() - current.startedAt;
    if (watchMs < 300) return;
    logImpressions({
      userId,
      impressions: [
        {
          postId: current.postId as Id<'posts'>,
          kind: 'post',
          watchMs,
          duration: IMPRESSIONS.expectedPostDwellMs,
          completed: watchMs >= IMPRESSIONS.expectedPostDwellMs,
          rankingVersion: 'feed_v1',
        },
      ],
    });
  };
  useEffect(() => () => flushDwell(), []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      const entry = first ? (first.item as FeedEntry<Post, AdPost>) : null;
      const nextId = entry && entry.kind === 'post' ? entry.item._id : null;
      if (dwellRef.current?.postId !== nextId) {
        flushDwell();
        if (nextId) dwellRef.current = { postId: nextId, startedAt: Date.now() };
      }
      setActiveKey(entry ? entryKey(entry) : null);
    }
  ).current;

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={listRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={!posts || posts.length > 0 || (!!clips && clips.length > 0)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        data={feed}
        keyExtractor={entryKey}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        ListHeaderComponent={
          clips === undefined ? (
            <FadeInView style={styles.clipsSection}>
              <Text variant="h3" style={styles.clipsHeading}>{t('common:tabClips')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.clipsRow}
              >
                <ClipTileSkeleton />
                <ClipTileSkeleton />
                <ClipTileSkeleton />
              </ScrollView>
            </FadeInView>
          ) : clips.length > 0 ? (
            <FadeInView style={styles.clipsSection}>
              <Pressable
                style={styles.clipsHeadingRow}
                onPress={() => onOpenClip(clips[0]._id as Id<'posts'>)}
                accessibilityRole="button"
                accessibilityLabel={t('openClipsLabel')}
              >
                <Text variant="h3" style={styles.clipsHeadingText}>{t('common:tabClips')}</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.white} />
              </Pressable>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={styles.clipsRow}
              >
                {clips.map((clip) => (
                  <ClipTile
                    key={clip._id}
                    post={clip}
                    onPress={() => onOpenClip(clip._id as Id<'posts'>)}
                  />
                ))}
              </ScrollView>
            </FadeInView>
          ) : (
            <View style={styles.noClipsSpacer} />
          )
        }
        ListEmptyComponent={
          posts === undefined ? (
            <>
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </>
          ) : feedFilter === 'friends' ? (
            <EmptyState
              icon={Image02Icon}
              message={t('friendsEmptyMessage')}
              style={styles.emptyState}
            />
          ) : !clips || clips.length === 0 ? (
            <EmptyState
              icon={Image02Icon}
              message={t('nothingHereMessage')}
              buttonLabel={t('createPostButton')}
              onPressButton={onOpenCamera}
              style={styles.emptyState}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <FadeInView>
            {item.kind === 'ad' ? (
              <AdCard ad={item.item} viewerId={userId} isActive={entryKey(item) === activeKey} />
            ) : (
              <PostCard
                post={item.item}
                viewerId={userId}
                isActive={entryKey(item) === activeKey}
                onOpenUser={onOpenUser}
                onOpenStory={onOpenStory}
                onOpenSound={onOpenSound}
                onOpenClip={onOpenClip}
              />
            )}
          </FadeInView>
        )}
      />

      <CollapsibleHeader
        title={t('common:tabExplore')}
        brand
        altTitle={feedFilter === 'for-you' ? t('forYouLabel') : t('friendsLabel')}
        altSwitchAt={34}
        onPressAlt={() => setDropdownOpen(true)}
        scrollY={scrollY}
        leftIcon={Search01Icon}
        onPressLeft={onOpenSearch}
        rightIcons={[{ icon: UserAdd01Icon, onPress: onOpenDiscoverFriends }]}
      />

      <HeaderDropdown
        visible={dropdownOpen}
        options={[
          { id: 'for-you', label: t('forYouLabel') },
          { id: 'friends', label: t('friendsLabel') },
        ]}
        selectedId={feedFilter}
        onSelect={pickFilter}
        onClose={() => setDropdownOpen(false)}
      />

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
    paddingTop: HEADER_HEIGHT,
    paddingBottom: NAV_BAR_HEIGHT + space.xl,
  },
  emptyState: {
    marginTop: space.xxl,
  },
  noClipsSpacer: {
    height: space.xl,
  },
  clipsSection: {
    marginBottom: space.lg,
  },
  clipsHeading: {
    color: colors.white,
    marginBottom: space.sm,
    paddingHorizontal: space.xl,
  },
  clipsHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    marginBottom: space.sm,
    paddingHorizontal: space.xl,
  },
  clipsHeadingText: {
    color: colors.white,
  },
  clipsRow: {
    gap: space.xs,
    paddingHorizontal: space.xl,
  },
});
