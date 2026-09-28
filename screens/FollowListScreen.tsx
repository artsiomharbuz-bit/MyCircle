import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import AnimatedPressable from '../components/AnimatedPressable';
import { HEADER_HEIGHT } from '../components/CollapsibleHeader';
import EmptyState from '../components/EmptyState';
import FadeInView from '../components/FadeInView';
import FollowButton from '../components/FollowButton';
import VerifiedBadge from '../components/VerifiedBadge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';
import { UserGroupIcon } from '@hugeicons/core-free-icons';

export default function FollowListScreen({
  userId,
  type,
  currentUserId,
  onBack,
  onOpenUser,
}: {
  userId: Id<'users'>;
  type: 'followers' | 'following';
  currentUserId: Id<'users'>;
  onBack: () => void;
  onOpenUser: (userId: Id<'users'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation(['followList', 'common']);
  const users = useQuery(
    type === 'followers' ? api.follows.getFollowers : api.follows.getFollowingUsers,
    { userId }
  );
  const followingIds = useQuery(api.follows.getFollowingIds, { followerId: currentUserId });
  const follow = useMutation(api.follows.follow);
  const unfollow = useMutation(api.follows.unfollow);

  const toggleFollow = (targetId: Id<'users'>, isFollowing: boolean) => {
    if (isFollowing) {
      unfollow({ followerId: currentUserId, followingId: targetId });
    } else {
      follow({ followerId: currentUserId, followingId: targetId });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {users?.map((user) => {
          const letter = (user.username ?? '?').charAt(0).toUpperCase();
          const gradient = (user.avatarGradient as [string, string]) ?? [colors.red, colors.coral];
          const isFollowing = followingIds?.includes(user._id as Id<'users'>) ?? false;
          const isSelf = user._id === currentUserId;

          return (
            <FadeInView key={user._id}>
              <AnimatedPressable onPress={() => onOpenUser(user._id as Id<'users'>)}>
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
                    <View style={styles.userNameLine}>
                      <Text style={styles.userName}>{user.name}</Text>
                      <VerifiedBadge verified={user.isVerified} size={15} />
                    </View>
                    <Text style={styles.userUsername}>@{user.username}</Text>
                  </View>
                  {!isSelf && (
                    <FollowButton
                      following={isFollowing}
                      onPress={() => toggleFollow(user._id as Id<'users'>, isFollowing)}
                    />
                  )}
                </View>
              </AnimatedPressable>
            </FadeInView>
          );
        })}

        {users && users.length === 0 && (
          <EmptyState
            icon={UserGroupIcon}
            message={type === 'followers' ? t('noFollowersMessage') : t('noFollowingMessage')}
            style={styles.emptyState}
          />
        )}
      </ScrollView>

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>{type === 'followers' ? t('followersTitle') : t('followingTitle')}</Text>
      </View>

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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    gap: space.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    zIndex: 10,
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
  list: {
    paddingHorizontal: space.xl,
    paddingTop: HEADER_HEIGHT + space.md,
    paddingBottom: space.xl,
    gap: space.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
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
    ...typography.bodyBold,
    color: '#ffffff',
  },
  userInfo: {
    flex: 1,
  },
  userNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    ...typography.bodyBold,
    color: colors.white,
  },
  userUsername: {
    marginTop: 2,
    ...typography.footnote,
    color: colors.textMuted,
  },
  emptyState: {
    marginTop: space.xxl,
  },
});
