import { ReactNode, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Text from './AppText';
import { radius, space, typography } from '../theme';

// Portrait window the remixed clip plays in.
const WINDOW_ASPECT = 9 / 16;
// How much of the frame the window may take up.
const MAX_WINDOW_WIDTH = 0.62;
const MAX_WINDOW_HEIGHT = 0.7;

// Perceived brightness of a #rrggbb color, 0-255 — picks readable text for
// the credit line on top of the sampled color.
function brightness(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// A remixed clip/post's media plays in a small centered window; everything
// around it is the clip's own most common color (see dominantColor.ts),
// with the original creator's username centered underneath. No border or
// gray letterboxing — the color fills the whole frame. `style` lets a caller
// with its own positioning (e.g. ClipsScreen's absolute-fill stage) place
// the frame; it always fills whatever box it's given.
export default function RemixFrame({
  color,
  username,
  style,
  children,
}: {
  color: string;
  username: string | null;
  // Kept so existing call sites don't have to change.
  avatarUrl?: string | null;
  avatarGradient?: [string, string] | null;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  let windowW = 0;
  let windowH = 0;
  if (size) {
    windowH = Math.min(size.h * MAX_WINDOW_HEIGHT, (size.w * MAX_WINDOW_WIDTH) / WINDOW_ASPECT);
    windowW = windowH * WINDOW_ASPECT;
  }

  const textColor = brightness(color) > 150 ? '#111111' : '#ffffff';

  return (
    <View style={[styles.frame, { backgroundColor: color }, style]} onLayout={onLayout}>
      {size && (
        <>
          <View style={[styles.window, { width: windowW, height: windowH }]}>{children}</View>
          {username && (
            <Text style={[styles.credit, { color: textColor }]} numberOfLines={1}>
              @{username}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  window: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  credit: {
    marginTop: space.sm,
    maxWidth: '80%',
    textAlign: 'center',
    ...typography.calloutBold,
  },
});
