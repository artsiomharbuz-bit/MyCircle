import { useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  AddTeamIcon,
  ArrowRight01Icon,
  Edit02Icon,
  SentIcon,
  ShieldUserIcon,
  UserAdd01Icon,
} from '@hugeicons/core-free-icons';
import AnimatedPressable from '../components/AnimatedPressable';
import GroupAvatarStack from '../components/GroupAvatarStack';
import VerifiedBadge from '../components/VerifiedBadge';
import { NAV_BAR_HEIGHT } from '../components/BottomNavBar';
import { HEADER_HEIGHT } from '../components/CollapsibleHeader';
import EmptyState from '../components/EmptyState';
import FadeInView from '../components/FadeInView';
import NewMessageSheet from '../components/NewMessageSheet';
import Skeleton from '../components/Skeleton';
import Badge from '../components/Badge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space } from '../theme';

export default function DMsScreen({
  userId,
  scrollY,
  onOpenDiscoverFriends,
  onOpenChat,
  onOpenGroupChat,
  onOpenCreateGroup,
  onOpenModInbox,
}: {
  userId: Id<'users'>;
  // Shared with the persistent BottomNavBar mounted in App.tsx, so it can
  // hide/show off this same scroll position.
  scrollY: Animated.Value;
  onOpenDiscoverFriends: () => void;
  onOpenChat: (otherUserId: Id<'users'>) => void;
  onOpenGroupChat: (groupId: Id<'groupChats'>) => void;
  onOpenCreateGroup: () => void;
  onOpenModInbox: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const [composeVisible, setComposeVisible] = useState(false);

  const conversations = useQuery(api.messages.listConversations, { userId });
  const groups = useQuery(api.groups.listMyGroups, { userId });
  const typingSenderIds = useQuery(api.typing.listTypingSenders, { userId });
  const typingSet = new Set(typingSenderIds);
  const followingIds = useQuery(api.follows.getFollowingIds, { followerId: userId });
  const hasFriends = (followingIds?.length ?? 0) > 0;

  // 1:1 conversations and group chats interleaved into one list, newest
  // activity first — each row renders differently, but they share one
  // timeline the same way a real messaging app would show them.
  type DmRow =
    | { kind: 'conversation'; key: string; lastMessageAt: number; conversation: NonNullable<typeof conversations>[number] }
    | { kind: 'group'; key: string; lastMessageAt: number; group: NonNullable<typeof groups>[number] };

  const loadingList = conversations === undefined || groups === undefined;
  const rows: DmRow[] = loadingList
    ? []
    : [
        ...conversations.map(
          (conversation): DmRow => ({
            kind: 'conversation',
            key: `c-${conversation.otherUser._id}`,
            lastMessageAt: conversation.lastMessageAt,
            conversation,
          })
        ),
        ...groups.map(
          (group): DmRow => ({
            kind: 'group',
            key: `g-${group._id}`,
            lastMessageAt: group.lastMessageAt,
            group,
          })
        ),
      ].sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  // Reports arrive in a moderator's inbox alongside their conversations —
  // pinned above them, since a queued report matters more than a DM.
  const modStatus = useQuery(api.moderation.getModStatus, { userId });
  const openReportCount = useQuery(api.moderation.getModInboxCount, { userId });

  const modInboxRow = modStatus?.isMod ? (
    <AnimatedPressable onPress={onOpenModInbox}>
      <View style={styles.modRow}>
        <View style={styles.modAvatar}>
          <HugeiconsIcon icon={ShieldUserIcon} size={24} color={colors.accentText} />
          <Badge count={openReportCount} />
        </View>
        <View style={styles.conversationText}>
          <Text variant="bodyBold" style={styles.conversationName}>Reports</Text>
          <Text variant="footnote" style={styles.conversationPreview} numberOfLines={1}>
            {openReportCount && openReportCount > 0
              ? `${openReportCount} report${openReportCount === 1 ? '' : 's'} waiting for review`
              : 'Nothing waiting for review'}
          </Text>
        </View>
        <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={colors.textMuted} />
      </View>
    </AnimatedPressable>
  ) : null;

  return (
    <View style={styles.container}>
      {loadingList ? (
        <View style={styles.loadingList}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.conversationRow}>
              <Skeleton style={styles.avatar} />
              <View style={styles.conversationText}>
                <Skeleton style={styles.nameSkeleton} />
                <Skeleton style={styles.previewSkeleton} />
              </View>
            </View>
          ))}
        </View>
      ) : rows.length > 0 ? (
        <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
        >
          {modInboxRow}
          {rows.map((row) => {
            if (row.kind === 'group') {
              const { group } = row;
              return (
                <AnimatedPressable key={row.key} onPress={() => onOpenGroupChat(group._id)}>
                  <View style={styles.conversationRow}>
                    <GroupAvatarStack members={group.members} size={AVATAR_SIZE} />

                    <View style={styles.conversationText}>
                      <Text variant="bodyBold" style={styles.conversationName}>{group.name}</Text>
                      <Text variant="footnote" style={styles.conversationPreview} numberOfLines={1}>
                        {group.lastMessage
                          ? `${group.lastMessageIsMine ? 'You: ' : ''}${group.lastMessage}`
                          : 'No messages yet.'}
                      </Text>
                    </View>
                    <View style={styles.unreadBadge}>
                      <Badge count={group.unreadCount} />
                    </View>
                  </View>
                </AnimatedPressable>
              );
            }

            const { conversation } = row;
            const displayName =
              conversation.otherUser.name ?? conversation.otherUser.username ?? 'Someone';
            const letter = (conversation.otherUser.username ?? displayName)
              .charAt(0)
              .toUpperCase();
            const gradient = (conversation.otherUser.avatarGradient as [string, string]) ?? [
              colors.red,
              colors.coral,
            ];

            return (
              <AnimatedPressable
                key={row.key}
                onPress={() => onOpenChat(conversation.otherUser._id as Id<'users'>)}
              >
                <View style={styles.conversationRow}>
                  <View style={styles.avatar}>
                    {conversation.otherUser.avatarUrl ? (
                      <Image
                        source={{ uri: conversation.otherUser.avatarUrl }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <LinearGradient colors={gradient} style={styles.avatarGradient}>
                        <Text variant="h3" style={styles.avatarLetter}>{letter}</Text>
                      </LinearGradient>
                    )}
                  </View>

                  <View style={styles.conversationText}>
                    <View style={styles.nameLine}>
                      <Text variant="bodyBold" style={styles.conversationName}>{displayName}</Text>
                      <VerifiedBadge verified={conversation.otherUser.isVerified} size={14} />
                    </View>
                    {typingSet.has(conversation.otherUser._id) ? (
                      <Text variant="calloutBold" style={styles.typingPreview}>Typing…</Text>
                    ) : (
                      <Text variant="footnote" style={styles.conversationPreview} numberOfLines={1}>
                        {conversation.lastMessageIsMine ? 'You: ' : ''}
                        {conversation.lastMessage}
                      </Text>
                    )}
                  </View>
                  <View style={styles.unreadBadge}>
                    <Badge count={conversation.unreadCount} />
                  </View>
                </View>
              </AnimatedPressable>
            );
          })}
        </Animated.ScrollView>
      ) : (
        <FadeInView style={styles.emptyState}>
          {modInboxRow && <View style={styles.emptyModRow}>{modInboxRow}</View>}
          {hasFriends ? (
            <EmptyState
              icon={SentIcon}
              message="No messages yet."
              buttonLabel="Message Someone"
              onPressButton={() => setComposeVisible(true)}
            />
          ) : (
            <EmptyState
              icon={UserAdd01Icon}
              message="You're not following anyone yet."
              buttonLabel="Find Friends"
              onPressButton={onOpenDiscoverFriends}
            />
          )}
        </FadeInView>
      )}

      <View style={styles.header}>
        <Text variant="h3" style={styles.title}>Messages</Text>

        <AnimatedPressable
          style={styles.groupButton}
          onPress={onOpenCreateGroup}
          accessibilityLabel="Create group"
        >
          <HugeiconsIcon icon={AddTeamIcon} size={19} color={colors.white} />
        </AnimatedPressable>

        <AnimatedPressable style={styles.editButton} onPress={() => setComposeVisible(true)}>
          <HugeiconsIcon icon={Edit02Icon} size={20} color={colors.white} />
        </AnimatedPressable>
      </View>

      <NewMessageSheet
        visible={composeVisible}
        userId={userId}
        onClose={() => setComposeVisible(false)}
        onSelectUser={(otherUserId) => {
          setComposeVisible(false);
          onOpenChat(otherUserId);
        }}
      />

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const AVATAR_SIZE = 52;

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
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 10,
      overflow: 'hidden',
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      zIndex: 10,
    },
    title: {
      letterSpacing: 0.2,
      color: colors.white,
    },
    editButton: {
      position: 'absolute',
      right: 24,
      bottom: 6,
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    groupButton: {
      position: 'absolute',
      right: 70,
      bottom: 6,
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    list: {
      paddingHorizontal: space.xl,
      paddingTop: HEADER_HEIGHT + space.md,
      paddingBottom: NAV_BAR_HEIGHT + space.xl,
      gap: space.xxs,
    },
    loadingList: {
      flex: 1,
      paddingHorizontal: space.xl,
      paddingTop: HEADER_HEIGHT + space.md,
      paddingBottom: NAV_BAR_HEIGHT + space.xl,
      gap: space.xxs,
    },
    scroll: {
      flex: 1,
    },
    conversationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingVertical: space.xs,
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
      color: '#ffffff',
    },
    conversationText: {
      flex: 1,
    },
    nameLine: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    modRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingVertical: space.sm,
      paddingHorizontal: space.sm,
      marginBottom: space.xs,
      borderRadius: radius.md,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modAvatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.red,
    },
    emptyModRow: {
      alignSelf: 'stretch',
      paddingHorizontal: space.xl,
      marginBottom: space.sm,
    },
    unreadBadge: {
      width: 20,
      height: 20,
      position: 'relative',
    },
    conversationName: {
      color: colors.white,
    },
    conversationPreview: {
      marginTop: 2,
      color: colors.textMuted,
    },
    nameSkeleton: {
      width: 120,
      height: 15,
      borderRadius: radius.xs,
    },
    previewSkeleton: {
      marginTop: space.xxs,
      width: 180,
      height: 13,
      borderRadius: radius.xs,
    },
    typingPreview: {
      marginTop: 2,
      color: colors.white,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.md,
      paddingBottom: 80,
    },
  });
