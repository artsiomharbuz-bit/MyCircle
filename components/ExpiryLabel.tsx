import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Time02Icon } from '@hugeicons/core-free-icons';
import { useAppTheme } from '../ThemeContext';
import { Colors, space, typography } from '../theme';
import { formatTimeLeft } from '../moderationOptions';

// The small "Xd Xh left" pill on a circles post/clip that was created with
// auto-delete on (see AudienceSelectionScreen) — reuses the exact same
// countdown formatter as account restrictions/bans so the wording is
// consistent everywhere the app counts down to something. Renders nothing
// once expiresAt is null/undefined (most content) or already passed (the
// scheduled deletion is seconds away at that point either way).
export default function ExpiryLabel({
  expiresAt,
  onDark = false,
}: {
  expiresAt?: number | null;
  onDark?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors, onDark);

  if (!expiresAt || expiresAt <= Date.now()) return null;

  return (
    <View style={styles.pill}>
      <HugeiconsIcon icon={Time02Icon} size={11} color={onDark ? '#ffffff' : colors.textMuted} />
      <Text style={styles.label}>{formatTimeLeft(expiresAt)}</Text>
    </View>
  );
}

const createStyles = (colors: Colors, onDark: boolean) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xxs,
      alignSelf: 'flex-start',
      height: 20,
      paddingHorizontal: space.xs,
      borderRadius: 10,
      backgroundColor: onDark ? 'rgba(255,255,255,0.16)' : colors.buttonSecondary,
      borderWidth: onDark ? 0 : 1,
      borderColor: colors.border,
    },
    label: {
      ...typography.micro,
      letterSpacing: 0.3,
      color: onDark ? '#ffffff' : colors.textMuted,
    },
  });
