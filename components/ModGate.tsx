import AppTextInput from './AppTextInput';
import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from './AppText';
import { useAction } from 'convex/react';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { SquareLock01Icon, ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import FormModal from './FormModal';
import PrimaryButton from './PrimaryButton';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { getModToken, setModToken, useModToken } from '../modSession';
import { readableError } from '../errorMessage';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

// How long a full-screen modal takes to slide away. Anything presented
// straight after an unlock waits this out first.
const MODAL_DISMISS_MS = 350;

// The password gate. Moderation tools stay locked until the moderator types
// their own account password; the token that unlocks them lives in memory
// only, so closing the app locks everything again.
export function ModUnlockModal({
  visible,
  userId,
  onClose,
  onUnlocked,
}: {
  visible: boolean;
  userId: Id<'users'>;
  onClose: () => void;
  onUnlocked: (token: string) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const unlock = useAction(api.moderationAuth.unlock);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setPassword('');
    setError('');
    setShowPassword(false);
    onClose();
  };

  const submit = async () => {
    if (!password || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { token, expiresAt } = await unlock({ userId, password });
      setModToken(userId, token, expiresAt);
      setPassword('');
      setShowPassword(false);
      onUnlocked(token);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      visible={visible}
      title="Unlock moderator tools"
      subtitle="Confirm it's you with your account password. You'll only be asked once per session — closing the app locks the tools again."
      icon={SquareLock01Icon}
      onClose={close}
      footer={
        <PrimaryButton
          label="Unlock"
          loading={submitting}
          disabled={password.length === 0}
          onPress={submit}
        />
      }
    >
      <View style={styles.passwordWrap}>
        <AppTextInput
          style={[styles.input, styles.passwordInput]}
          placeholder="Your password"
          placeholderTextColor={colors.placeholder}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (error) setError('');
          }}
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
          <HugeiconsIcon
            icon={showPassword ? ViewOffSlashIcon : ViewIcon}
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
      </View>

      {error !== '' && <Text style={styles.error}>{error}</Text>}

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Everything you do with these tools is written to the account's log with your name
          and the time.
        </Text>
      </View>
    </FormModal>
  );
}

// Wraps any moderator action in the password gate: `run` executes it straight
// away when the session is already unlocked, otherwise it prompts first and
// runs it on success. Render `gate` once somewhere in the same component.
//
// When the session is already unlocked the returned promise settles with the
// action itself — so a caller that has just unlocked (the common "unlock,
// then confirm, then act" flow) can await it and surface any failure.
export function useModGate(userId: Id<'users'>) {
  const token = useModToken(userId);
  const [pendingAction, setPendingAction] = useState<
    ((token: string) => unknown) | null
  >(null);

  const run = async <T,>(action: (token: string) => T | Promise<T>): Promise<T | undefined> => {
    const existing = getModToken(userId);
    if (existing) {
      return await action(existing);
    }
    // Stored via the updater form — React would otherwise call the function
    // instead of storing it.
    setPendingAction(() => action);
    return undefined;
  };

  const gate: ReactNode = (
    <ModUnlockModal
      visible={pendingAction !== null}
      userId={userId}
      onClose={() => setPendingAction(null)}
      onUnlocked={(freshToken) => {
        const action = pendingAction;
        setPendingAction(null);
        // Most gated actions open a screen of their own, and a modal can't
        // be presented while another is still dismissing — so let the unlock
        // sheet finish closing first.
        setTimeout(() => action?.(freshToken), MODAL_DISMISS_MS);
      }}
    />
  );

  return { token, isUnlocked: token !== null, run, gate };
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    passwordWrap: {
      justifyContent: 'center',
    },
    input: {
      fontFamily: 'Poppins_400Regular',
      height: 56,
      borderRadius: radius.input,
      paddingHorizontal: 22,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.white,
      fontSize: typography.body.fontSize,
    },
    passwordInput: {
      paddingRight: 52,
    },
    eyeButton: {
      position: 'absolute',
      right: 18,
      height: 56,
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    error: {
      marginTop: space.sm,
      ...typography.footnote,
      color: colors.errorText,
    },
    note: {
      marginTop: 22,
      padding: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    noteText: {
      ...typography.footnote,
      color: colors.textMuted,
    },
  });
