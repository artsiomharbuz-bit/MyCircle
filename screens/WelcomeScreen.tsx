import { Animated, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
import AnimatedPressable from '../components/AnimatedPressable';
import useEntranceAnimation from '../useEntranceAnimation';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space } from '../theme';

export default function WelcomeScreen({
  onLogin,
  onRegister,
  onGuest,
}: {
  onLogin: () => void;
  onRegister: () => void;
  onGuest: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const entrance = useEntranceAnimation();
  const { t } = useTranslation(['welcome', 'common']);

  return (
    <View style={styles.container}>
      <Logo />

      <Animated.View style={[styles.titleWrap, entrance]}>
        <Text variant="display" style={styles.title}>
          {t('common:appName')}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.actions, entrance]}>
        {/* Login is the app's one recurring accent action — kept in the
            accent color everywhere it appears (here and on LoginScreen)
            so the accent reads as a consistent signal, not decoration. */}
        <AnimatedPressable style={[styles.button, styles.primaryButton]} onPress={onLogin}>
          <Text variant="h3" style={styles.primaryButtonText}>
            {t('loginButton')}
          </Text>
        </AnimatedPressable>

        <AnimatedPressable style={[styles.button, styles.secondaryButton]} onPress={onRegister}>
          <Text variant="h3" style={styles.secondaryButtonText}>
            {t('registerButton')}
          </Text>
        </AnimatedPressable>
      </Animated.View>

      <AnimatedPressable style={styles.guestButton} onPress={onGuest}>
        <Text variant="callout" style={styles.guestButtonText}>
          {t('guestButton')}
        </Text>
      </AnimatedPressable>

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: space.xl,
      paddingTop: space.md,
      paddingBottom: space.xl,
    },
    titleWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: colors.white,
      letterSpacing: 0.5,
    },
    actions: {
      gap: space.sm,
    },
    button: {
      height: 56,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButton: {
      backgroundColor: colors.red,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 8,
      elevation: 3,
    },
    primaryButtonText: {
      color: colors.accentText,
    },
    secondaryButton: {
      backgroundColor: colors.buttonBackground,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 2,
    },
    secondaryButtonText: {
      color: colors.buttonText,
    },
    guestButton: {
      marginTop: space.md,
      alignItems: 'center',
      paddingVertical: space.xs,
    },
    guestButtonText: {
      color: colors.textMuted,
      textDecorationLine: 'underline',
    },
  });
