import { useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import LegalDocModal from '../components/LegalDocModal';
import { LegalDocKey } from '../legalText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAction } from 'convex/react';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { CheckmarkSquare02Icon, SquareIcon, ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import BackButton from '../components/BackButton';
import Logo from '../components/Logo';
import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import useEntranceAnimation from '../useEntranceAnimation';
import { useAppTheme } from '../ThemeContext';
import { Colors, space } from '../theme';
import { readableError } from '../errorMessage';
import { setStoredUserId, setStoredSessionToken } from '../session';

export default function RegisterScreen({
  onBack,
  onSwitchToLogin,
  onRegistered,
  onGuest,
}: {
  onBack: () => void;
  onSwitchToLogin: () => void;
  onRegistered: (userId: Id<'users'>, sessionToken: string) => void;
  // Not shown while switching into an already-logged-in account (see
  // App.tsx's isAddingAccount).
  onGuest?: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const entrance = useEntranceAnimation();
  const { t } = useTranslation(['register', 'common']);
  const register = useAction(api.auth.register);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !password) {
      setError(t('emptyFieldsError'));
      return;
    }
    if (password.length < 6) {
      setError(t('shortPasswordError'));
      return;
    }
    if (!agreedToTerms) {
      setError(t('termsNotAgreedError'));
      return;
    }

    setSubmitting(true);
    try {
      const { userId, sessionToken } = await register({ email: email.trim(), password });
      await setStoredUserId(userId);
      await setStoredSessionToken(userId, sessionToken);
      onRegistered(userId as Id<'users'>, sessionToken);
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
          {t('joinTitle')}
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

        <Pressable style={styles.termsRow} onPress={() => setAgreedToTerms((v) => !v)}>
          <HugeiconsIcon
            icon={agreedToTerms ? CheckmarkSquare02Icon : SquareIcon}
            size={20}
            color={agreedToTerms ? colors.white : colors.textMuted}
            fill={agreedToTerms ? colors.white : 'none'}
          />
          <Text variant="footnote" style={styles.terms}>
            {t('agreeToText')}{' '}
            <Text
              variant="footnote"
              style={styles.link}
              onPress={() => setLegalDoc('privacy')}
            >
              {t('privacyPolicy')}
            </Text>{' '}
            {t('andConnector')}{' '}
            <Text
              variant="footnote"
              style={styles.link}
              onPress={() => setLegalDoc('terms')}
            >
              {t('termsAndConditions')}
            </Text>
          </Text>
        </Pressable>

        {!!error && (
          <Text variant="footnote" style={styles.error}>
            {error}
          </Text>
        )}

        <View style={styles.buttonWrap}>
          <PrimaryButton
            label={t('registerButton')}
            tone="primary"
            loading={submitting}
            disabled={submitting || !agreedToTerms}
            onPress={handleSubmit}
          />
        </View>

        <Text variant="callout" style={styles.switchText}>
          {t('haveAccountText')}{' '}
          <Text variant="calloutBold" style={styles.link} onPress={onSwitchToLogin}>
            {t('loginLink')}
          </Text>
        </Text>

        {onGuest && (
          <Pressable style={styles.guestButton} onPress={onGuest}>
            <Text variant="callout" style={styles.guestButtonText}>
              {t('guestButton')}
            </Text>
          </Pressable>
        )}
      </Animated.View>

      <LegalDocModal docKey={legalDoc} onClose={() => setLegalDoc(null)} />
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
    error: {
      color: colors.red,
      textAlign: 'center',
    },
    buttonWrap: {
      marginTop: space.xxs,
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
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.xs,
      marginTop: space.xxs,
      paddingHorizontal: space.xxs,
    },
    terms: {
      flex: 1,
      color: colors.textMuted,
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
