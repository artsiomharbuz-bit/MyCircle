import { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import BackButton from '../components/BackButton';
import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import useEntranceAnimation from '../useEntranceAnimation';
import { useAppTheme } from '../ThemeContext';
import { Colors, space } from '../theme';

export default function OnboardingNameScreen({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: (name: string) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const entrance = useEntranceAnimation();
  const [name, setName] = useState('');
  const canContinue = name.trim().length > 0;

  return (
    <View style={styles.container}>
      <BackButton onPress={onBack} />

      <Animated.View style={[styles.titleWrap, entrance]}>
        <Text variant="display" style={styles.title}>
          What's your name?
        </Text>
        <Text variant="body" style={styles.subtitle}>
          This is how people in your circle will see you.
        </Text>
      </Animated.View>

      <Animated.View style={[styles.actions, entrance]}>
        <TextField
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          autoFocus
        />

        <PrimaryButton
          label="Continue"
          tone="primary"
          disabled={!canContinue}
          onPress={() => canContinue && onNext(name.trim())}
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
  });
