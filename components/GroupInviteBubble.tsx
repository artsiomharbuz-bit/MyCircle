import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { UserGroupIcon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import GroupMembersSheet from './GroupMembersSheet';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export default function GroupInviteBubble({
  groupId,
  userId,
  isMine,
  groupInfo,
}: {
  groupId: Id<'groupChats'>;
  userId: Id<'users'>;
  isMine: boolean;
  groupInfo?: {
    _id: Id<'groupChats'>;
    name: string;
    status: string;
    memberCount?: number;
  };
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const queriedInfo = useQuery(api.groups.getGroupInviteInfo, { groupId, viewerId: userId });
  const info = groupInfo ?? queriedInfo;
  const joinGroup = useMutation(api.groups.joinGroup);
  const [membersVisible, setMembersVisible] = useState(false);

  if (info === undefined) {
    return <View style={[styles.card, isMine && styles.cardMine]} />;
  }
  if (info === null) {
    return (
      <View style={[styles.card, isMine && styles.cardMine]}>
        <Text style={[styles.unavailable, isMine && styles.textMine]}>Group unavailable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, isMine && styles.cardMine]}>
      <View style={styles.icon}>
        <HugeiconsIcon icon={UserGroupIcon} size={18} color={colors.white} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardLabel, isMine && styles.textMine]} numberOfLines={2}>
          {info.name}
        </Text>
        <AnimatedPressable onPress={() => setMembersVisible(true)}>
          <Text style={[styles.cardSubtext, isMine && styles.textMine]}>
            Group invite · View members
          </Text>
        </AnimatedPressable>
      </View>

      {info.status === 'joined' ? (
        <View style={styles.joinedBadge}>
          <Text style={styles.joinedBadgeText}>Joined</Text>
        </View>
      ) : (
        <AnimatedPressable
          style={styles.joinButton}
          onPress={() => joinGroup({ groupId, userId })}
        >
          <Text style={styles.joinButtonText}>Join</Text>
        </AnimatedPressable>
      )}

      <GroupMembersSheet
        visible={membersVisible}
        groupId={groupId}
        groupName={info.name}
        viewerId={userId}
        onClose={() => setMembersVisible(false)}
      />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      maxWidth: '82%',
      minWidth: 230,
      padding: space.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderBottomLeftRadius: 6,
    },
    cardMine: {
      backgroundColor: colors.white,
      alignSelf: 'flex-end',
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: 6,
    },
    icon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    cardText: {
      flexShrink: 1,
    },
    cardLabel: {
      ...typography.calloutBold,
      color: colors.white,
    },
    cardSubtext: {
      marginTop: 1,
      ...typography.caption,
      color: colors.textMuted,
    },
    joinButton: {
      paddingHorizontal: 14,
      height: 30,
      borderRadius: radius.xs,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonSecondary,
    },
    joinButtonText: {
      ...typography.calloutBold,
      color: colors.buttonText,
    },
    joinedBadge: {
      paddingHorizontal: 12,
      height: 26,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonSecondary,
    },
    joinedBadgeText: {
      ...typography.micro,
      color: colors.textMuted,
    },
    unavailable: {
      ...typography.footnote,
      color: colors.textMuted,
      padding: space.xxs,
    },
    textMine: {
      color: colors.black,
    },
  });
