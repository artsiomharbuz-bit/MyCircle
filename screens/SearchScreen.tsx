import AppTextInput from '../components/AppTextInput';
import { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Search01Icon } from '@hugeicons/core-free-icons';
import AnimatedPressable from '../components/AnimatedPressable';
import { NAV_BAR_HEIGHT } from '../components/BottomNavBar';
import EmptyState from '../components/EmptyState';
import FadeInView from '../components/FadeInView';
import FollowButton from '../components/FollowButton';
import Skeleton from '../components/Skeleton';
import StoryRing from '../components/StoryRing';
import VerifiedBadge from '../components/VerifiedBadge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

function normalize(text: string) {
  return text.trim().toLowerCase();
}

export default function SearchScreen({
  userId,
  scrollY,
  onOpenUser,
}: {
  userId: Id<'users'>;
  // Shared with the persistent BottomNavBar mounted in App.tsx, so it can
  // hide/show off this same scroll position.
  scrollY: Animated.Value;
  onOpenUser: (userId: Id<'users'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(normalize(query)), 300);
    return () => clearTimeout(handle);
  }, [query]);

  const results = useQuery(
    api.search.search,
    debounced.length > 0 ? { query: debounced, viewerId: userId } : 'skip'
  );
  const followingIds = useQuery(api.follows.getFollowingIds, { followerId: userId });
  const storyAuthorIds = useQuery(api.stories.getActiveStoryAuthorIds, { viewerId: userId });
  const follow = useMutation(api.follows.follow);
  const unfollow = useMutation(api.follows.unfollow);
  const logSearchQuery = useMutation(api.search.logSearchQuery);
  const recentSearches = useQuery(api.search.getRecentSearches, { userId });
  const trendingSearches = useQuery(api.search.getTrendingSearches, {});

  // Logged once per committed (debounced) search term — search history is
  // per-user and only ever shown back to that same user (see
  // SearchScreen's "recent searches" list and search.ts's getRecentSearches).
  useEffect(() => {
    if (debounced.length > 0) {
      logSearchQuery({ userId, term: debounced });
    }
  }, [debounced]);

  const toggleFollow = (targetId: Id<'users'>, isFollowing: boolean) => {
    if (isFollowing) {
      unfollow({ followerId: userId, followingId: targetId });
    } else {
      follow({ followerId: userId, followingId: targetId });
    }
  };

  return (
    <View style={styles.container}>
      <AppTextInput
        style={styles.input}
        placeholder="Search users and posts"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        value={query}
        onChangeText={setQuery}
        autoFocus
        cursorColor={colors.coral}
      />

      <Animated.ScrollView
        style={styles.results}
        contentContainerStyle={styles.resultsContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
      >
        {debounced.length === 0 && ((recentSearches?.length ?? 0) > 0 || (trendingSearches?.length ?? 0) > 0) && (
          <FadeInView style={styles.section}>
            {recentSearches && recentSearches.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Recent searches</Text>
                <View style={styles.chipWrap}>
                  {recentSearches.map((term) => (
                    <AnimatedPressable key={term} onPress={() => setQuery(term)}>
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{term}</Text>
                      </View>
                    </AnimatedPressable>
                  ))}
                </View>
              </>
            )}
            {trendingSearches && trendingSearches.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, styles.trendingTitle]}>Trending</Text>
                <View style={styles.chipWrap}>
                  {trendingSearches.map((term) => (
                    <AnimatedPressable key={term} onPress={() => setQuery(term)}>
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{term}</Text>
                      </View>
                    </AnimatedPressable>
                  ))}
                </View>
              </>
            )}
          </FadeInView>
        )}

        {debounced.length === 0 &&
          recentSearches !== undefined &&
          trendingSearches !== undefined &&
          recentSearches.length === 0 &&
          trendingSearches.length === 0 && (
            <EmptyState
              icon={Search01Icon}
              message="Search for people, posts, sounds, and more."
              style={styles.emptyState}
            />
          )}

        {debounced.length > 0 && results === undefined && (
          <View style={styles.section}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.userRow}>
                <Skeleton style={styles.avatar} />
                <View style={styles.userInfo}>
                  <Skeleton style={styles.userNameSkeleton} />
                  <Skeleton style={styles.userUsernameSkeleton} />
                </View>
              </View>
            ))}
          </View>
        )}

        {results && results.users.length > 0 && (
          <FadeInView style={styles.section}>
            <Text style={styles.sectionTitle}>People</Text>
            {results.users.map((user) => {
              const letter = (user.username ?? '?').charAt(0).toUpperCase();
              const gradient = (user.avatarGradient as [string, string]) ?? [
                colors.red,
                colors.coral,
              ];
              const isFollowing = followingIds?.includes(user._id as Id<'users'>) ?? false;
              const isSelf = user._id === userId;

              return (
                <AnimatedPressable
                  key={user._id}
                  onPress={() => onOpenUser(user._id as Id<'users'>)}
                >
                  <View style={styles.userRow}>
                    <StoryRing
                      hasStory={storyAuthorIds?.includes(user._id as Id<'users'>) ?? false}
                      size={44}
                    >
                      <View style={styles.avatar}>
                        {user.avatarUrl ? (
                          <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                        ) : (
                          <LinearGradient colors={gradient} style={styles.avatarGradient}>
                            <Text style={styles.avatarLetter}>{letter}</Text>
                          </LinearGradient>
                        )}
                      </View>
                    </StoryRing>
                    <View style={styles.userInfo}>
                      <View style={styles.userNameLine}>
                        <Text style={styles.userName}>{user.name}</Text>
                        <VerifiedBadge verified={user.isVerified} size={15} />
                      </View>
                      <Text style={styles.userUsername}>@{user.username}</Text>
                    </View>
                    {!isSelf && (
                      <FollowButton
                        following={isFollowing}
                        compact
                        onPress={() => toggleFollow(user._id as Id<'users'>, isFollowing)}
                      />
                    )}
                  </View>
                </AnimatedPressable>
              );
            })}
          </FadeInView>
        )}

        {results && results.posts.length > 0 && (
          <FadeInView style={styles.section}>
            <Text style={styles.sectionTitle}>Posts</Text>
            {results.posts.map((post) => (
              <AnimatedPressable key={post._id}>
                <View style={styles.postRow}>
                  {post.mediaUrl && (
                    <Image source={{ uri: post.mediaUrl }} style={styles.postThumb} />
                  )}
                  <View style={styles.postText}>
                    {post.title && <Text style={styles.postTitle}>{post.title}</Text>}
                    {post.caption && (
                      <Text style={styles.postCaption} numberOfLines={2}>
                        {post.caption}
                      </Text>
                    )}
                    {post.author?.username && (
                      <Text style={styles.postAuthor}>@{post.author.username}</Text>
                    )}
                  </View>
                </View>
              </AnimatedPressable>
            ))}
          </FadeInView>
        )}

        {results && results.clips.length > 0 && (
          <FadeInView style={styles.section}>
            <Text style={styles.sectionTitle}>Clips</Text>
            {results.clips.map((clip) => (
              <AnimatedPressable key={clip._id}>
                <View style={styles.postRow}>
                  {clip.mediaUrl && <Image source={{ uri: clip.mediaUrl }} style={styles.postThumb} />}
                  <View style={styles.postText}>
                    {clip.title && <Text style={styles.postTitle}>{clip.title}</Text>}
                    {clip.caption && (
                      <Text style={styles.postCaption} numberOfLines={2}>
                        {clip.caption}
                      </Text>
                    )}
                    {clip.author?.username && <Text style={styles.postAuthor}>@{clip.author.username}</Text>}
                  </View>
                </View>
              </AnimatedPressable>
            ))}
          </FadeInView>
        )}

        {results && results.sounds.length > 0 && (
          <FadeInView style={styles.section}>
            <Text style={styles.sectionTitle}>Sounds</Text>
            {results.sounds.map((sound) => (
              <View key={sound._id} style={styles.soundRow}>
                <View style={styles.soundThumb}>
                  {sound.pictureUrl && <Image source={{ uri: sound.pictureUrl }} style={styles.postThumb} />}
                </View>
                <View style={styles.postText}>
                  <Text style={styles.postTitle} numberOfLines={1}>
                    {sound.name}
                  </Text>
                  <Text style={styles.postAuthor}>{sound.useCount} uses</Text>
                </View>
              </View>
            ))}
          </FadeInView>
        )}

        {results && results.hashtags.length > 0 && (
          <FadeInView style={styles.section}>
            <Text style={styles.sectionTitle}>Hashtags</Text>
            <View style={styles.chipWrap}>
              {results.hashtags.map((tag) => (
                <AnimatedPressable key={tag} onPress={() => setQuery(`#${tag}`)}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>#{tag}</Text>
                  </View>
                </AnimatedPressable>
              ))}
            </View>
          </FadeInView>
        )}

        {debounced.length > 0 &&
          results &&
          results.users.length === 0 &&
          results.posts.length === 0 &&
          results.clips.length === 0 &&
          results.sounds.length === 0 &&
          results.hashtags.length === 0 && (
            <EmptyState
              icon={Search01Icon}
              message={`No results for "${debounced}"`}
              style={styles.emptyState}
            />
          )}
      </Animated.ScrollView>

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
  input: {
    fontFamily: 'Poppins_400Regular',
    marginHorizontal: space.xl,
    marginTop: 40,
    height: 52,
    borderRadius: radius.input,
    paddingHorizontal: space.lg,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.white,
    fontSize: typography.body.fontSize,
  },
  results: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: NAV_BAR_HEIGHT + space.xl,
    gap: space.xl,
  },
  section: {
    gap: space.sm,
  },
  sectionTitle: {
    fontSize: typography.footnote.fontSize,
    fontFamily: 'Poppins_600SemiBold',
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: space.xxs,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  userInfo: {
    flex: 1,
  },
  userNameSkeleton: {
    width: 120,
    height: 14,
    borderRadius: 7,
  },
  userUsernameSkeleton: {
    marginTop: 5,
    width: 90,
    height: 12,
    borderRadius: 6,
  },
  userNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: typography.bodyBold.fontSize,
    fontFamily: 'Poppins_600SemiBold',
    fontWeight: '700',
    color: colors.white,
  },
  userUsername: {
    marginTop: 2,
    fontSize: typography.footnote.fontSize,
    color: colors.textMuted,
  },
  postRow: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  postThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: '#111',
  },
  postText: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  postTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: typography.bodyBold.fontSize,
    color: colors.white,
  },
  postCaption: {
    fontSize: typography.footnote.fontSize,
    color: colors.textMuted,
  },
  postAuthor: {
    marginTop: 2,
    fontSize: typography.caption.fontSize,
    fontFamily: 'Poppins_600SemiBold',
    fontWeight: '600',
    color: colors.textMuted,
  },
  emptyState: {
    marginTop: space.xxxl,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  chip: {
    paddingHorizontal: space.sm,
    height: 34,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: typography.footnote.fontSize,
    fontFamily: 'Poppins_600SemiBold',
    fontWeight: '600',
    color: colors.white,
  },
  trendingTitle: {
    marginTop: space.lg,
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  soundThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
});
