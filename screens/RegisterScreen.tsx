import { useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import LegalDocModal from '../components/LegalDocModal';
import { LegalDocKey } from '../legalText';
import { StatusBar } from 'expo-status-bar';
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
}: {
  onBack: () => void;
  onSwitchToLogin: () => void;
  onRegistered: (userId: Id<'users'>, sessionToken: string) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const entrance = useEntranceAnimation();
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
      setError('Enter an email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }
    if (!agreedToTerms) {
      setError('Please agree to the Privacy Policy and Terms and Conditions.');
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
          Join MyCircle
        </Text>
        <Text variant="body" style={styles.subtitle}>
          Create an account to get started.
        </Text>
      </Animated.View>

      <Animated.View style={[styles.actions, entrance]}>
        <TextField
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.passwordWrap}>
          <TextField
            style={styles.passwordInput}
            placeholder="Password"
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
            I agree to the{' '}
            <Text
              variant="footnote"
              style={styles.link}
              onPress={() => setLegalDoc('privacy')}
            >
              Privacy Policy
            </Text>{' '}
            and{' '}
            <Text
              variant="footnote"
              style={styles.link}
              onPress={() => setLegalDoc('terms')}
            >
              Terms and Conditions
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
            label="Register"
            tone="primary"
            loading={submitting}
            disabled={submitting || !agreedToTerms}
            onPress={handleSubmit}
          />
        </View>

        <Text variant="callout" style={styles.switchText}>
          Already have an account?{' '}
          <Text variant="calloutBold" style={styles.link} onPress={onSwitchToLogin}>
            Login
          </Text>
        </Text>
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
  });
