import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../ThemeContext';

const RING_WIDTH = 3;
const RING_GAP = 3;
const RING_COLORS: [string, string, string] = ['#ff3d68', '#ff7a59', '#f5c542'];

// Wraps an avatar with a red-coral gradient ring and a small breathing gap.
// Renders the child as-is when there's no active story.
export default function StoryRing({
  hasStory,
  size,
  children,
  style,
  ringWidth = RING_WIDTH,
  gap = RING_GAP,
}: {
  hasStory: boolean;
  size: number;
  children: ReactNode;
  style?: ViewStyle;
  ringWidth?: number;
  gap?: number;
}) {
  const { colors } = useAppTheme();
  const ringSize = size + (ringWidth + gap) * 2;
  const avatarOffset = ringWidth + gap;

  if (!hasStory) {
    return (
      <View style={[{ width: ringSize, height: ringSize }, style]}>
        <View
          style={{
            position: 'absolute',
            top: avatarOffset,
            left: avatarOffset,
            width: size,
            height: size,
          }}
        >
          {children}
        </View>
      </View>
    );
  }

  const gapMaskSize = size + gap * 2;

  return (
    <View style={[{ width: ringSize, height: ringSize }, style]}>
      <LinearGradient
        colors={RING_COLORS}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: 'absolute',
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: ringWidth,
          left: ringWidth,
          width: gapMaskSize,
          height: gapMaskSize,
          borderRadius: gapMaskSize / 2,
          backgroundColor: colors.background,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: avatarOffset,
          left: avatarOffset,
          width: size,
          height: size,
        }}
      >
        {children}
      </View>
    </View>
  );
}
