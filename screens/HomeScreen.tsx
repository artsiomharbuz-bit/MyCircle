import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View, ViewToken } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { GridViewIcon, Notification01Icon, UserAdd01Icon } from '@hugeicons/core-free-icons';
import { NAV_BAR_HEIGHT } from '../components/BottomNavBar';
import CircleSelector from '../components/CircleSelector';
import HeaderDropdown from '../components/HeaderDropdown';
import CollapsibleHeader, { HEADER_HEIGHT } from '../components/CollapsibleHeader';
import EmptyState from '../components/EmptyState';
import FadeInView from '../components/FadeInView';
import PostCard, { Post } from '../components/PostCard';
import PostCardSkeleton from '../components/PostCardSkeleton';
import StoriesRow from '../components/StoriesRow';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { IMPRESSIONS } from '../convex/lib/rankingConfig';
import { useAppTheme } from '../ThemeContext';
import { circles, Colors, space } from '../theme';

export default function HomeScreen({
  userId,
  scrollY,
  onOpenCamera,
  onOpenDiscoverFriends,
  onOpenNotifications,
  onAddStory,
  onOpenStory,
  onOpenUser,
  onOpenSound,
  onOpenGroupChat,
  onOpenClip,
}: {
  userId: Id<'users'>;
  // Shared with the persistent BottomNavBar mounted in App.tsx, so it can
  // hide/show off this same scroll position.
  scrollY: Animated.Value;
  onOpenCamera: () => void;
  onOpenDiscoverFriends: () => void;
  onOpenNotifications: () => void;
  onAddStory: () => void;
  onOpenStory: (authorId: Id<'users'>) => void;
  onOpenUser: (userId: Id<'users'>) => void;
  onOpenSound: (soundId: Id<'sounds'>) => void;
  onOpenGroupChat: (groupId: Id<'groupChats'>) => void;
  // Only ever called for a remixed post — see PostCard.
  onOpenClip: (postId: Id<'posts'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const posts = useQuery(api.posts.listHomeFeed, { viewerId: userId });
  const followingIds = useQuery(api.follows.getFollowingIds, { followerId: userId });
  const hasFriends = (followingIds?.length ?? 0) > 0;
  const unseenNotificationCount = useQuery(api.notifications.getUnseenNotificationCount, {
    userId,
  });
  const circleLastViewed = useQuery(api.circles.getCircleLastViewed, { userId });
  const markCircleViewed = useMutation(api.circles.markCircleViewed);
  const [selectedCircle, setSelectedCircle] = useState(circles[0].id);
  const myCircles = useQuery(api.userCircles.listMyCircles, { userId });
  const listRef = useRef<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // A circle picked from the header dropdown while the feed is scrolled down:
  // the list scrolls back up first, and the circle only changes once it has
  // arrived at the top.
  const pendingCircle = useRef<string | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const circleOptions = [
    ...circles.map((c) => ({ id: c.id, label: c.label, color: colors[c.colorKey] })),
    ...(myCircles ?? []).map((c) => ({ id: c._id as string, label: c.name, color: c.color })),
  ];
  const selectedCircleLabel =
    circleOptions.find((c) => c.id === selectedCircle)?.label ?? circles[0].label;

  const applyPendingCircle = () => {
    const id = pendingCircle.current;
    if (!id) return;
    pendingCircle.current = null;
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    handleSelectCircle(id);
  };

  const pickCircleFromHeader = (id: string) => {
    pendingCircle.current = id;
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    // Safety net in case the list is already at the top or the scroll never
    // reports arriving.
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(applyPendingCircle, 700);
  };

  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      if (pendingCircle.current && value <= 2) applyPendingCircle();
    });
    return () => {
      scrollY.removeListener(listenerId);
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, [scrollY]);

  // A circle tab (other than "All") gets a dot when one of its posts is
  // newer than the last time this user opened that tab — computed generally
  // off whatever circleIds actually show up in the feed, so it covers both
  // the built-in "Best Friends" bucket and any user-created circle.
  const hasNewByCircle = useMemo(() => {
    if (!posts || !circleLastViewed) return undefined;
    const circleIds = new Set(posts.flatMap((post) => post.circleIds ?? []));
    const result: Record<string, boolean> = {};
    for (const circleId of circleIds) {
      const lastViewedAt = circleLastViewed[circleId] ?? 0;
      result[circleId] = posts.some(
        (post) => post.circleIds?.includes(circleId) && post._creationTime > lastViewedAt
      );
    }
    return result;
  }, [posts, circleLastViewed]);

  const handleSelectCircle = (id: string) => {
    setSelectedCircle(id);
    if (id !== circles[0].id) {
      markCircleViewed({ userId, circleId: id });
    }
  };
  // Only the post(s) actually on screen right now get to load/play video —
  // everything else stays paused with no source, so scrolling past a dozen
  // video posts doesn't quietly download all twelve of them.
  const [activePostId, setActivePostId] = useState<string | null>(null);

  // Lightweight dwell-time impression logging — the foundation-level signal
  // feed ranking's dwellWeight component reads (see convex/posts.ts
  // scorePostCandidate). Normalized against an assumed expected viewing
  // time since a post, unlike a clip, has no intrinsic duration.
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

  // The feed itself is already friends-only + circles-only (listHomeFeed).
  // "All" shows every one of those. Any other tab narrows to posts shared
  // to that specific circle. Global posts never appear here — see Explore.
  const visiblePosts = posts?.filter((post) => {
    if (selectedCircle === circles[0].id) return true;
    return post.circleIds?.includes(selectedCircle);
  });

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      const nextId = first ? (first.item as Post)._id : null;
      if (dwellRef.current?.postId !== nextId) {
        flushDwell();
        if (nextId) dwellRef.current = { postId: nextId, startedAt: Date.now() };
      }
      setActivePostId(nextId);
    }
  ).current;

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={listRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={!visiblePosts || visiblePosts.length > 0}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        data={visiblePosts}
        keyExtractor={(post) => post._id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        ListHeaderComponent={
          <>
            <CircleSelector
              userId={userId}
              selectedId={selectedCircle}
              onSelect={handleSelectCircle}
              hasNewByCircle={hasNewByCircle}
              onOpenGroupChat={onOpenGroupChat}
            />
            <StoriesRow userId={userId} onAddStory={onAddStory} onOpenStory={onOpenStory} />
          </>
        }
        ListEmptyComponent={
          posts === undefined ? (
            <>
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </>
          ) : hasFriends ? (
            <EmptyState
              icon={GridViewIcon}
              message="Nothing here yet."
              buttonLabel="Create a Post"
              onPressButton={onOpenCamera}
              style={styles.emptyState}
            />
          ) : (
            <EmptyState
              icon={UserAdd01Icon}
              message="You're not following anyone yet."
              buttonLabel="Find Friends"
              onPressButton={onOpenDiscoverFriends}
              style={styles.emptyState}
            />
          )
        }
        renderItem={({ item }) => (
          <FadeInView>
            <PostCard
              post={item}
              viewerId={userId}
              isActive={item._id === activePostId}
              onOpenUser={onOpenUser}
              onOpenStory={onOpenStory}
              onOpenSound={onOpenSound}
              onOpenClip={onOpenClip}
            />
          </FadeInView>
        )}
      />

      <CollapsibleHeader
        title="MyCircle"
        brand
        altTitle={selectedCircleLabel}
        altSwitchAt={64}
        onPressAlt={() => setDropdownOpen(true)}
        scrollY={scrollY}
        leftIcon={Notification01Icon}
        onPressLeft={onOpenNotifications}
        leftBadgeCount={unseenNotificationCount}
        rightIcons={[{ icon: UserAdd01Icon, onPress: onOpenDiscoverFriends }]}
      />

      <HeaderDropdown
        visible={dropdownOpen}
        options={circleOptions}
        selectedId={selectedCircle}
        onSelect={pickCircleFromHeader}
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
    paddingTop: HEADER_HEIGHT + space.xxs,
    paddingBottom: NAV_BAR_HEIGHT + space.xl,
  },
  emptyState: {
    marginTop: space.xxl,
  },
});
