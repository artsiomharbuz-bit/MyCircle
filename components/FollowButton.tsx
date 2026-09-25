import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Text from './AppText';
import AnimatedPressable from './AnimatedPressable';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export default function FollowButton({
  following,
  onPress,
  compact = false,
  coral = false,
  style,
}: {
  following: boolean;
  onPress: () => void;
  compact?: boolean;
  // Accent-colored Follow (profiles, suggestions) instead of the neutral one.
  coral?: boolean;
  // Lets callers (e.g. the profile screen's full-width Follow/Message row)
  // resize the button rather than being stuck with the default pill size.
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors, scheme);

  return (
    <AnimatedPressable
      style={[
        styles.button,
        compact && styles.buttonCompact,
        following ? styles.buttonFollowing : coral ? styles.buttonCoral : styles.buttonFollow,
        style,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.text,
          compact && styles.textCompact,
          following ? styles.textFollowing : coral ? styles.textCoral : styles.textFollow,
        ]}
      >
        {following ? 'Following' : 'Follow'}
      </Text>
    </AnimatedPressable>
  );
}

const createStyles = (colors: Colors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    button: {
      paddingHorizontal: space.md,
      height: 34,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonCompact: {
      paddingHorizontal: space.sm,
      height: 30,
      borderRadius: radius.xs,
    },
    buttonFollow: {
      backgroundColor: colors.buttonBackground,
      // A dark drop shadow reads as a lift on dark mode but as a smudge on
      // light mode, so light mode skips it entirely.
      ...(scheme === 'dark'
        ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.18,
            shadowRadius: 6,
            elevation: 2,
          }
        : null),
    },
    buttonCoral: {
      backgroundColor: colors.coral,
    },
    buttonFollowing: {
      backgroundColor: colors.buttonSecondary,
    },
    text: {
      fontSize: typography.footnote.fontSize,
      fontFamily: 'Poppins_600SemiBold',
    },
    textCompact: {
      fontSize: typography.caption.fontSize,
    },
    textFollow: {
      color: colors.buttonText,
    },
    textCoral: {
      color: '#ffffff',
    },
    textFollowing: {
      color: colors.white,
    },
  });
