import { StyleSheet } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ChevronLeftIcon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import { useAppTheme } from '../ThemeContext';
import { Colors } from '../theme';

export default function BackButton({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <AnimatedPressable
      style={styles.backButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <HugeiconsIcon icon={ChevronLeftIcon} size={22} color={colors.white} />
    </AnimatedPressable>
  );
}

const SIZE = 42;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backButton: {
      height: SIZE,
      width: SIZE,
      borderRadius: SIZE / 2,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
