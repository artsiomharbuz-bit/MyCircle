import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { api } from '../convex/_generated/api';
import BackButton from '../components/BackButton';
import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import useEntranceAnimation from '../useEntranceAnimation';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space } from '../theme';

function normalize(username: string) {
  return username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export default function OnboardingUsernameScreen({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: (username: string) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const entrance = useEntranceAnimation();
  const [username, setUsername] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(normalize(username)), 300);
    return () => clearTimeout(handle);
  }, [username]);

  const available = useQuery(
    api.users.isUsernameAvailable,
    debounced.length >= 3 ? { username: debounced } : 'skip'
  );

  const canContinue = debounced.length >= 3 && available === true;

  let statusText = '';
  if (username.length > 0 && debounced.length < 3) {
    statusText = 'At least 3 characters.';
  } else if (debounced.length >= 3 && available === undefined) {
    statusText = 'Checking availability…';
  } else if (available === false) {
    statusText = 'That username is taken.';
  } else if (available === true) {
    statusText = 'Available!';
  }

  return (
    <View style={styles.container}>
      <BackButton onPress={onBack} />

      <Animated.View style={[styles.titleWrap, entrance]}>
        <Text variant="display" style={styles.title}>
          Pick a username
        </Text>
        <Text variant="body" style={styles.subtitle}>
          Letters, numbers and underscores only.
        </Text>
      </Animated.View>

      <Animated.View style={[styles.actions, entrance]}>
        <View style={styles.inputWrap}>
          <Text variant="body" style={styles.at}>
            @
          </Text>
          <TextField
            style={styles.input}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
            autoFocus
          />
        </View>

        {statusText.length > 0 && (
          <Text
            variant="footnote"
            style={[
              styles.status,
              available === true && styles.statusOk,
              available === false && styles.statusBad,
            ]}
          >
            {statusText}
          </Text>
        )}

        <PrimaryButton
          label="Continue"
          tone="primary"
          disabled={!canContinue}
          onPress={() => canContinue && onNext(debounced)}
        />
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
    },
    title: {
      color: colors.white,
    },
    subtitle: {
      marginTop: space.xs,
      color: colors.textMuted,
    },
    actions: {
      marginTop: space.xxl,
      gap: space.sm,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 56,
      borderRadius: radius.input,
      paddingHorizontal: 22,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    at: {
      color: colors.textMuted,
      marginRight: 2,
    },
    input: {
      flex: 1,
      height: undefined,
      paddingHorizontal: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    status: {
      color: colors.textMuted,
    },
    statusOk: {
      color: colors.white,
    },
    statusBad: {
      color: colors.red,
    },
  });
