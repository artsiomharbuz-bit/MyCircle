import { StyleSheet, View, ViewStyle } from 'react-native';
import Text from './AppText';
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react-native';
import AnimatedPressable from './AnimatedPressable';
import { useAppTheme } from '../ThemeContext';
import { Colors, elevation, radius, space, typography } from '../theme';

export default function EmptyState({
  icon,
  message,
  buttonLabel,
  onPressButton,
  style,
}: {
  // Optional — every call site already reads fine without one, this just
  // gives the message a visual anchor instead of floating as bare text.
  icon?: IconSvgElement;
  message: string;
  buttonLabel?: string;
  onPressButton?: () => void;
  style?: ViewStyle;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors, scheme);

  return (
    <View style={[styles.container, style]}>
      {icon && (
        <View style={styles.iconWrap}>
          <HugeiconsIcon icon={icon} size={26} color={colors.textMuted} />
        </View>
      )}
      <Text style={styles.message}>{message}</Text>
      {buttonLabel && onPressButton && (
        <AnimatedPressable style={styles.button} onPress={onPressButton}>
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

const createStyles = (colors: Colors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.xxl,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    message: {
      ...typography.callout,
      color: colors.textMuted,
      textAlign: 'center',
    },
    button: {
      height: 44,
      paddingHorizontal: space.xl,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white,
      ...(scheme === 'dark' ? { ...elevation.low } : null),
    },
    buttonText: {
      ...typography.calloutBold,
      color: colors.black,
    },
  });
