import { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['onboardingName', 'common']);
  const [name, setName] = useState('');
  const canContinue = name.trim().length > 0;

  return (
    <View style={styles.container}>
      <BackButton onPress={onBack} />

      <Animated.View style={[styles.titleWrap, entrance]}>
        <Text variant="display" style={styles.title}>
          {t('title')}
        </Text>
        <Text variant="body" style={styles.subtitle}>
          {t('subtitle')}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.actions, entrance]}>
        <TextField
          placeholder={t('namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoFocus
        />

        <PrimaryButton
          label={t('continueButton')}
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
