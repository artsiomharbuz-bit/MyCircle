import { Modal, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { UserBlock01Icon } from '@hugeicons/core-free-icons';
import PrimaryButton from './PrimaryButton';
import { formatTimeLeft } from '../moderationOptions';
import { useAppTheme } from '../ThemeContext';
import { Colors, elevation, radius, space, typography } from '../theme';

// Shown once per app open while the account has an active restriction — a
// restriction doesn't lock the app the way a ban does, so this is a notice
// the user can dismiss and keep browsing, not a wall. The server enforces
// the actual restriction on every post/comment regardless of whether this
// was seen.
export default function RestrictedNoticeModal({
  visible,
  restrictedUntil,
  onDismiss,
}: {
  visible: boolean;
  restrictedUntil: number | undefined;
  onDismiss: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, scheme === 'dark' ? elevation.high : null]}>
          <View style={styles.medallion}>
            <HugeiconsIcon icon={UserBlock01Icon} size={26} color="#111111" />
          </View>

          <Text style={styles.title}>You're restricted</Text>

          <View style={styles.timer}>
            <Text style={styles.timerText}>{formatTimeLeft(restrictedUntil)}</Text>
          </View>

          <Text style={styles.body}>
            You can't comment, post, or share posts and clips to Explore while this is active.
            You can still browse the app normally.
          </Text>

          <Text style={styles.footnote}>
            This usually follows a warning or a strike for content or comments that broke the
            community guidelines. Check your notifications for details.
          </Text>

          <View style={styles.action}>
            <PrimaryButton label="Got it" onPress={onDismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 26,
      backgroundColor: 'transparent',
    },
    card: {
      width: '100%',
      maxWidth: 380,
      alignItems: 'center',
      borderRadius: radius.sheet,
      padding: 26,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
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
    title: {
      ...typography.h1,
      textAlign: 'center',
      color: colors.white,
    },
    timer: {
      marginTop: space.sm,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 14,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timerText: {
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      color: colors.white,
    },
    body: {
      marginTop: space.md,
      ...typography.body,
      textAlign: 'center',
      color: colors.white,
    },
    footnote: {
      marginTop: 14,
      ...typography.footnote,
      textAlign: 'center',
      color: colors.textMuted,
    },
    action: {
      alignSelf: 'stretch',
      marginTop: space.xl,
    },
  });
