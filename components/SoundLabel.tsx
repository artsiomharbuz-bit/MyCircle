import { Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Bookmark02Icon, MusicNote02Icon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import { useAppTheme } from '../ThemeContext';
import { Colors, space, typography } from '../theme';

export type PostSound = {
  _id: string;
  name: string;
  isDeleted: boolean;
  isOwner?: boolean;
  isSaved?: boolean;
  ownerUsername?: string;
} | null;

// The small "♪ Sound name" line under a post's author row / a clip's
// caption — tapping it opens that sound's own screen. Renders nothing when
// the post has no sound at all, which is most posts.
export default function SoundLabel({
  sound,
  onPress,
  // Optional — when given (and the viewer isn't the sound's own owner),
  // renders a small save toggle right next to the label so a sound can be
  // saved straight from the feed without leaving it to open its screen.
  onToggleSave,
  // Clips render this over full-bleed video, so it needs the same white-on-
  // dark-scrim treatment as the rest of that overlay regardless of theme;
  // posts render it inline in their own card and should just use house
  // colors instead.
  onDark = false,
}: {
  sound: PostSound;
  onPress: () => void;
  onToggleSave?: () => void;
  onDark?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors, onDark);

  if (!sound) return null;

  const showSave = !!onToggleSave && !sound.isOwner && !sound.isDeleted;

  return (
    <View style={styles.container}>
      <Pressable style={styles.row} onPress={onPress} hitSlop={6}>
        <HugeiconsIcon
          icon={MusicNote02Icon}
          size={13}
          color={onDark ? '#ffffff' : colors.textMuted}
        />
        <Text style={styles.label} numberOfLines={1}>
          {sound.name}
        </Text>
      </Pressable>

      {showSave && (
        <AnimatedPressable
          style={styles.saveButton}
          hitSlop={8}
          accessibilityLabel={sound.isSaved ? 'Unsave sound' : 'Save sound'}
          onPress={onToggleSave}
        >
          <HugeiconsIcon
            icon={Bookmark02Icon}
            size={13}
            color={onDark ? '#ffffff' : colors.textMuted}
            fill={sound.isSaved ? (onDark ? '#ffffff' : colors.textMuted) : 'none'}
          />
        </AnimatedPressable>
      )}
    </View>
  );
}

const createStyles = (colors: Colors, onDark: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xxs,
      flexShrink: 1,
    },
    label: {
      ...typography.caption,
      color: onDark ? 'rgba(255,255,255,0.85)' : colors.textMuted,
      flexShrink: 1,
    },
    saveButton: {
      paddingHorizontal: space.xxs,
    },
  });
