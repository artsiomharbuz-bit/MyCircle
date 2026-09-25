import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAppTheme } from '../ThemeContext';
import { Colors, space, typography } from '../theme';

// The small "Contains AI" pill shown on a post/clip whose creator flagged it
// as made or edited with AI, set via the Options menu in PostDetailsScreen.
// Renders nothing when the flag isn't set, which is most posts.
export default function AiLabel({
  visible,
  // Clips render this over full-bleed video, so it needs the same white-on-
  // dark-scrim treatment as the rest of that overlay regardless of theme;
  // posts render it inline in their own card and should just use house
  // colors instead.
  onDark = false,
}: {
  visible?: boolean;
  onDark?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors, onDark);

  if (!visible) return null;

  return (
    <View style={styles.pill}>
      <Text style={styles.label}>Contains AI</Text>
    </View>
  );
}

const createStyles = (colors: Colors, onDark: boolean) =>
  StyleSheet.create({
    pill: {
      alignSelf: 'flex-start',
      height: 20,
      paddingHorizontal: space.xs,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: onDark ? 'rgba(255,255,255,0.16)' : colors.buttonSecondary,
      borderWidth: onDark ? 0 : 1,
      borderColor: colors.border,
    },
    label: {
      ...typography.micro,
      letterSpacing: 0.3,
      color: onDark ? '#ffffff' : colors.textMuted,
    },
  });
