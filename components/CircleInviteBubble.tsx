import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import AnimatedPressable from './AnimatedPressable';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export default function CircleInviteBubble({
  circleId,
  userId,
  isMine,
  circleInfo,
}: {
  circleId: Id<'userCircles'>;
  userId: Id<'users'>;
  isMine: boolean;
  circleInfo?: {
    _id: Id<'userCircles'>;
    name: string;
    color: string;
    status: string;
  };
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const queriedInfo = useQuery(api.userCircles.getCircleInviteInfo, { circleId, userId });
  const info = circleInfo ?? queriedInfo;
  const joinCircle = useMutation(api.userCircles.joinCircle);

  if (info === undefined) {
    return <View style={[styles.card, isMine && styles.cardMine]} />;
  }
  if (info === null) {
    return (
      <View style={[styles.card, isMine && styles.cardMine]}>
        <Text style={[styles.unavailable, isMine && styles.textMine]}>Circle unavailable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, isMine && styles.cardMine]}>
      <View style={[styles.dot, { backgroundColor: info.color }]} />
      <View style={styles.cardText}>
        <Text style={[styles.cardLabel, isMine && styles.textMine]}>{info.name}</Text>
        <Text style={[styles.cardSubtext, isMine && styles.textMine]}>Circle invite</Text>
      </View>

      {info.status === 'joined' ? (
        <View style={styles.joinedBadge}>
          <Text style={styles.joinedBadgeText}>Joined</Text>
        </View>
      ) : (
        <AnimatedPressable
          style={styles.joinButton}
          onPress={() => joinCircle({ circleId, userId })}
        >
          <Text style={styles.joinButtonText}>Join</Text>
        </AnimatedPressable>
      )}
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
    dot: {
      width: 14,
      height: 14,
      borderRadius: 7,
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
