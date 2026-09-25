import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { UserAdd01Icon, UserGroup02Icon } from '@hugeicons/core-free-icons';
import Text from '../components/AppText';
import AnimatedPressable from '../components/AnimatedPressable';
import BackButton from '../components/BackButton';
import EmptyState from '../components/EmptyState';
import FollowButton from '../components/FollowButton';
import Skeleton from '../components/Skeleton';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export default function DiscoverFriendsScreen({
  userId,
  onBack,
  onOpenUser,
}: {
  userId: Id<'users'>;
  onBack: () => void;
  onOpenUser: (userId: Id<'users'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const suggestions = useQuery(api.follows.getFriendSuggestions, { userId });
  const randomUsers = useQuery(api.follows.getRandomUsers, { userId });
  const [visibleSuggestions, setVisibleSuggestions] = useState<typeof suggestions>(undefined);
  const [visibleRandomUsers, setVisibleRandomUsers] = useState<typeof randomUsers>(undefined);
  const followingIds = useQuery(api.follows.getFollowingIds, { followerId: userId });
  const follow = useMutation(api.follows.follow);
  const unfollow = useMutation(api.follows.unfollow);

  useEffect(() => {
    if (suggestions === undefined) return;
    setVisibleSuggestions((current) => {
      const merged = new Map((current ?? []).map((user) => [user._id, user]));
      suggestions.forEach((user) => merged.set(user._id, user));
      return [...merged.values()];
    });
  }, [suggestions]);

  useEffect(() => {
    if (randomUsers === undefined) return;
    setVisibleRandomUsers((current) => {
      const merged = new Map((current ?? []).map((user) => [user._id, user]));
      randomUsers.forEach((user) => merged.set(user._id, user));
      return [...merged.values()];
    });
  }, [randomUsers]);

  const toggleFollow = (targetId: Id<'users'>) => {
    const following = followingIds?.includes(targetId) ?? false;
    if (following) {
      unfollow({ followerId: userId, followingId: targetId });
    } else {
      follow({ followerId: userId, followingId: targetId });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Discover Friends</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>People you may know</Text>

        {visibleSuggestions === undefined ? (
          [0, 1, 2, 3].map((item) => (
            <View key={item} style={styles.userRow}>
              <Skeleton style={styles.avatar} />
              <View style={styles.userInfo}>
                <Skeleton style={styles.nameSkeleton} />
                <Skeleton style={styles.reasonSkeleton} />
              </View>
            </View>
          ))
        ) : visibleSuggestions.length === 0 ? (
          <EmptyState
            icon={UserAdd01Icon}
            message="No suggestions yet. Keep exploring."
            style={styles.emptyState}
          />
        ) : (
          visibleSuggestions.map((user) => {
            const displayName = user.name ?? user.username ?? 'Someone';
            const letter = (user.username ?? displayName).charAt(0).toUpperCase();
            const gradient = (user.avatarGradient as [string, string]) ?? [
              colors.red,
              colors.coral,
            ];
            const targetId = user._id as Id<'users'>;
            const isFollowing = followingIds?.includes(targetId) ?? false;

            return (
              <AnimatedPressable key={user._id} onPress={() => onOpenUser(targetId)}>
                <View style={styles.userRow}>
                  <View style={styles.avatar}>
                    {user.avatarUrl ? (
                      <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <LinearGradient colors={gradient} style={styles.avatarGradient}>
                        <Text style={styles.avatarLetter}>{letter}</Text>
                      </LinearGradient>
                    )}
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.name}>{displayName}</Text>
                    <Text style={styles.username}>@{user.username}</Text>
                    {user.mutualCount > 0 && (
                      <Text style={styles.reason}>
                        {user.mutualCount} mutual {user.mutualCount === 1 ? 'friend' : 'friends'}
                      </Text>
                    )}
                    {user.sharedCircleNames.map((circleName) => (
                      <Text key={circleName} style={styles.reason}>
                        Share the circle {circleName}
                      </Text>
                    ))}
                  </View>
                  <FollowButton coral following={isFollowing} onPress={() => toggleFollow(targetId)} />
                </View>
              </AnimatedPressable>
            );
          })
        )}

        <Text style={styles.sectionTitle}>Users</Text>
        {visibleRandomUsers === undefined ? (
          [0, 1, 2].map((item) => (
            <View key={`random-skeleton-${item}`} style={styles.userRow}>
              <Skeleton style={styles.avatar} />
              <View style={styles.userInfo}>
                <Skeleton style={styles.nameSkeleton} />
                <Skeleton style={styles.reasonSkeleton} />
              </View>
            </View>
          ))
        ) : visibleRandomUsers.length === 0 ? (
          <EmptyState
            icon={UserGroup02Icon}
            message="No other users to show yet."
            style={styles.emptyState}
          />
        ) : (
          visibleRandomUsers.map((user) => {
            const displayName = user.name ?? user.username ?? 'Someone';
            const letter = (user.username ?? displayName).charAt(0).toUpperCase();
            const gradient = (user.avatarGradient as [string, string]) ?? [
              colors.red,
              colors.coral,
            ];
            const targetId = user._id as Id<'users'>;
            const isFollowing = followingIds?.includes(targetId) ?? false;

            return (
              <AnimatedPressable key={user._id} onPress={() => onOpenUser(targetId)}>
                <View style={styles.userRow}>
                  <View style={styles.avatar}>
                    {user.avatarUrl ? (
                      <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <LinearGradient colors={gradient} style={styles.avatarGradient}>
                        <Text style={styles.avatarLetter}>{letter}</Text>
                      </LinearGradient>
                    )}
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.name}>{displayName}</Text>
                    <Text style={styles.username}>@{user.username}</Text>
                  </View>
                  <FollowButton coral following={isFollowing} onPress={() => toggleFollow(targetId)} />
                </View>
              </AnimatedPressable>
            );
          })
        )}
      </ScrollView>

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      height: 104,
      paddingHorizontal: space.xl,
      paddingTop: space.xxxl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerSpacer: { width: 40 },
    title: {
      fontSize: typography.h2.fontSize,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      color: colors.white,
    },
    content: { padding: space.xl, paddingBottom: 40 },
    subtitle: {
      marginBottom: space.md,
      fontSize: typography.bodyBold.fontSize,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '600',
      color: colors.textMuted,
    },
    sectionTitle: {
      marginTop: space.xl,
      marginBottom: space.xs,
      fontSize: typography.bodyBold.fontSize,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '600',
      color: colors.textMuted,
    },
    userRow: {
      minHeight: 78,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingVertical: space.sm,
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      overflow: 'hidden',
      backgroundColor: colors.buttonSecondary,
    },
    avatarImage: { flex: 1 },
    avatarGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    avatarLetter: { color: '#ffffff', fontSize: 20, fontFamily: 'Poppins_600SemiBold' },
    userInfo: { flex: 1, minWidth: 0 },
    name: { color: colors.white, fontSize: typography.bodyBold.fontSize, fontFamily: 'Poppins_600SemiBold' },
    username: { color: colors.textMuted, fontSize: typography.caption.fontSize, marginTop: 2 },
    reason: { color: colors.textLink, fontSize: typography.caption.fontSize, marginTop: space.xxs },
    nameSkeleton: { width: 120, height: 15, borderRadius: 7 },
    reasonSkeleton: { width: 150, height: 12, borderRadius: 6, marginTop: space.xxs },
    emptyState: { marginTop: space.xl },
  });
