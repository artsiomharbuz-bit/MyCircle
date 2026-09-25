import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Alert02Icon, LegalHammerIcon } from '@hugeicons/core-free-icons';
import PrimaryButton from './PrimaryButton';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { MAX_STRIKES } from '../moderationOptions';
import { useAppTheme } from '../ThemeContext';
import { Colors, elevation, radius, space, typography } from '../theme';

export type PendingAlert = {
  _id: Id<'userAlerts'>;
  type: 'warning' | 'strike';
  message: string;
  createdAt: number;
};

// A warning or a strike, shown the moment the user opens the app and not
// dismissable by tapping away — they have to read it and acknowledge. It
// stays in their notifications afterwards either way.
export default function AccountAlertPopup({
  alert,
  userId,
  strikeCount,
}: {
  alert: PendingAlert | null;
  userId: Id<'users'>;
  strikeCount: number;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors, scheme);
  const acknowledgeAlert = useMutation(api.moderation.acknowledgeAlert);
  const [dismissing, setDismissing] = useState(false);

  if (!alert) return null;

  const isStrike = alert.type === 'strike';

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.medallion, isStrike && styles.medallionStrike]}>
            <HugeiconsIcon
              icon={isStrike ? LegalHammerIcon : Alert02Icon}
              size={28}
              color={colors.accentText}
            />
          </View>

          <Text style={styles.title}>
            {isStrike ? "You've received a strike" : "You've received a warning"}
          </Text>

          {isStrike && (
            <View style={styles.strikeRow}>
              {Array.from({ length: MAX_STRIKES }).map((_, index) => (
                <View
                  key={index}
                  style={[styles.strikePip, index < strikeCount && styles.strikePipFilled]}
                />
              ))}
              <Text style={styles.strikeCount}>
                {strikeCount} of {MAX_STRIKES}
              </Text>
            </View>
          )}

          <Text style={styles.message}>{alert.message}</Text>

          <Text style={styles.footnote}>
            {isStrike
              ? `Reaching ${MAX_STRIKES} strikes means a permanent ban. Please review the community guidelines.`
              : 'Repeated violations can lead to restrictions, strikes or a ban.'}
          </Text>

          <View style={styles.action}>
            <PrimaryButton
              label="I understand"
              loading={dismissing}
              onPress={async () => {
                setDismissing(true);
                try {
                  await acknowledgeAlert({ alertId: alert._id, userId });
                } finally {
                  setDismissing(false);
                }
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: space.xl,
      backgroundColor: 'transparent',
    },
    card: {
      width: '100%',
      maxWidth: 380,
      alignItems: 'center',
      borderRadius: radius.sheet,
      padding: space.xl,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      ...(scheme === 'dark' ? elevation.high : null),
    },
    medallion: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.yellow,
      marginBottom: space.md,
    },
    medallionStrike: {
      backgroundColor: colors.red,
    },
    title: {
      ...typography.h1,
      textAlign: 'center',
      color: colors.white,
    },
    strikeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginTop: space.md - 2,
    },
    strikePip: {
      width: 26,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.buttonSecondary,
    },
    strikePipFilled: {
      backgroundColor: colors.red,
    },
    strikeCount: {
      marginLeft: 5,
      ...typography.caption,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.textMuted,
    },
    message: {
      marginTop: space.md,
      ...typography.body,
      textAlign: 'center',
      color: colors.white,
    },
    footnote: {
      marginTop: space.md - 2,
      ...typography.footnote,
      textAlign: 'center',
      color: colors.textMuted,
    },
    action: {
      alignSelf: 'stretch',
      marginTop: space.xl,
    },
  });
