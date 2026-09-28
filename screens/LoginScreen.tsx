import { useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAction } from 'convex/react';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import BackButton from '../components/BackButton';
import Logo from '../components/Logo';
import TextField from '../components/TextField';
import AnimatedPressable from '../components/AnimatedPressable';
import useEntranceAnimation from '../useEntranceAnimation';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space } from '../theme';
import { readableError } from '../errorMessage';
import { setStoredUserId, setStoredSessionToken } from '../session';

export default function LoginScreen({
  onBack,
  onSwitchToRegister,
  onLoggedIn,
  onGuest,
}: {
  onBack: () => void;
  onSwitchToRegister: () => void;
  onLoggedIn: (userId: Id<'users'>, sessionToken: string, onboardingComplete: boolean) => void;
  // Not shown while switching into an already-logged-in account (see
  // App.tsx's isAddingAccount) — guest browsing only makes sense as the
  // very first thing someone does, not mid-account-switch.
  onGuest?: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const entrance = useEntranceAnimation();
  const { t } = useTranslation(['login', 'common']);
  const login = useAction(api.auth.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !password) {
      setError(t('emptyFieldsError'));
      return;
    }

    setSubmitting(true);
    try {
      const { userId, sessionToken, onboardingComplete } = await login({
        email: email.trim(),
        password,
      });
      await setStoredUserId(userId);
      await setStoredSessionToken(userId, sessionToken);
      onLoggedIn(userId as Id<'users'>, sessionToken, onboardingComplete);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <BackButton onPress={onBack} />

      <Logo />

      <Animated.View style={[styles.titleWrap, entrance]}>
        <Text variant="display" style={styles.title}>
          {t('welcomeBackTitle')}
        </Text>
        <Text variant="body" style={styles.subtitle}>
          {t('subtitle')}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.actions, entrance]}>
        <TextField
          placeholder={t('emailPlaceholder')}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.passwordWrap}>
          <TextField
            style={styles.passwordInput}
            placeholder={t('passwordPlaceholder')}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            error={error ?? undefined}
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={8}
          >
            <HugeiconsIcon
              icon={showPassword ? ViewOffSlashIcon : ViewIcon}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        </View>

        <AnimatedPressable
          style={[styles.button, styles.primaryButton, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text variant="h3" style={styles.primaryButtonText}>
              {t('loginButton')}
            </Text>
          )}
        </AnimatedPressable>

        <Text variant="callout" style={styles.switchText}>
          {t('noAccountText')}{' '}
          <Text variant="calloutBold" style={styles.link} onPress={onSwitchToRegister}>
            {t('registerLink')}
          </Text>
        </Text>

        {onGuest && (
          <AnimatedPressable style={styles.guestButton} onPress={onGuest}>
            <Text variant="callout" style={styles.guestButtonText}>
              {t('guestButton')}
            </Text>
          </AnimatedPressable>
        )}
      </Animated.View>

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
      paddingTop: space.xl,
      paddingBottom: space.xl,
    },
    titleWrap: {
      marginTop: space.xxl,
      alignItems: 'center',
    },
    title: {
      color: colors.white,
    },
    subtitle: {
      marginTop: space.xs,
      color: colors.textMuted,
      textAlign: 'center',
    },
    actions: {
      marginTop: space.xxl,
      gap: space.sm,
    },
    passwordWrap: {
      justifyContent: 'center',
    },
    passwordInput: {
      paddingRight: 52,
    },
    eyeButton: {
      position: 'absolute',
      right: 18,
      top: 0,
      height: 56,
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    button: {
      height: 56,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: space.xxs,
    },
    buttonDisabled: {
      opacity: 0.6,
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
    switchText: {
      marginTop: space.xs,
      textAlign: 'center',
      color: colors.textMuted,
    },
    link: {
      textDecorationLine: 'underline',
      color: colors.textLink,
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
