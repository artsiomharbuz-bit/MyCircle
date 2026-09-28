import { StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { BanIcon } from '@hugeicons/core-free-icons';
import PrimaryButton from '../components/PrimaryButton';
import { FOREVER } from '../moderationOptions';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space } from '../theme';
import { useTranslation } from 'react-i18next';

function describeBan(
  bannedUntil: number | undefined,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (bannedUntil === undefined) return '';
  if (bannedUntil === FOREVER) {
    return t('permanentBanMessage');
  }
  const date = new Date(bannedUntil).toLocaleString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return t('temporaryBanMessage', { date });
}

// What a banned account sees instead of the app. The server enforces the ban
// on every write as well, so this screen is the explanation rather than the
// lock itself.
export default function BannedScreen({
  bannedUntil,
  strikeCount,
  onLogout,
}: {
  bannedUntil: number | undefined;
  strikeCount: number;
  onLogout: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation(['banned', 'common']);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.medallion}>
          <HugeiconsIcon icon={BanIcon} size={34} color={colors.accentText} />
        </View>

        <Text variant="display" style={styles.title}>
          {t('accountBannedTitle')}
        </Text>
        <Text variant="body" style={styles.body}>
          {describeBan(bannedUntil, t)}
        </Text>

        {strikeCount >= 3 && (
          <Text variant="callout" style={styles.reason}>
            {t('strikesMessage')}
          </Text>
        )}

        <View style={styles.card}>
          <Text variant="footnote" style={styles.cardText}>
            {t('supportMessage')}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label={t('logoutButton')} tone="ghost" onPress={onLogout} />
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
      paddingTop: space.xl,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.xxl,
    },
    medallion: {
      width: 82,
      height: 82,
      borderRadius: 41,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.red,
      marginBottom: space.xl,
    },
    title: {
      textAlign: 'center',
      color: colors.white,
    },
    body: {
      marginTop: space.sm,
      textAlign: 'center',
      color: colors.textMuted,
    },
    reason: {
      marginTop: space.xs,
      textAlign: 'center',
      color: colors.white,
    },
    card: {
      marginTop: space.xxl,
      padding: space.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardText: {
      textAlign: 'center',
      color: colors.textMuted,
    },
    footer: {
      paddingHorizontal: space.xl,
      paddingBottom: space.xxl,
    },
  });
