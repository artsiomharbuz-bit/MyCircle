import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Text from './AppText';
import AnimatedPressable from './AnimatedPressable';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius } from '../theme';

// The full-width action button used at the bottom of every moderation flow.
// `tone` picks the weight: solid foreground for the ordinary next step, red
// for anything destructive, and a quiet outline for the way out.
export default function PrimaryButton({
  label,
  tone = 'primary',
  disabled,
  loading,
  onPress,
}: {
  label: string;
  tone?: 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const inactive = disabled || loading;

  return (
    <AnimatedPressable disabled={inactive} onPress={onPress}>
      <View
        style={[
          styles.button,
          tone === 'danger' && styles.danger,
          tone === 'ghost' && styles.ghost,
          inactive && styles.inactive,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={tone === 'ghost' ? colors.white : tone === 'danger' ? colors.accentText : colors.black}
          />
        ) : (
          <Text
            style={[
              styles.label,
              tone === 'danger' && styles.labelOnAccent,
              tone === 'ghost' && styles.labelGhost,
            ]}
          >
            {label}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    button: {
      height: 52,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white,
    },
    danger: {
      backgroundColor: colors.red,
    },
    // Borderless — a lighter, more visible fill (buttonSecondary is
    // meaningfully lighter than the background in dark mode and meaningfully
    // darker than it in light mode) carries the surface on its own, rather
    // than needing an outline to separate it from the page behind it.
    ghost: {
      backgroundColor: colors.buttonSecondary,
    },
    inactive: {
      opacity: 0.45,
    },
    label: {
      fontSize: 15,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      color: colors.black,
    },
    labelOnAccent: {
      color: colors.accentText,
    },
    labelGhost: {
      color: colors.white,
    },
  });
