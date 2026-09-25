import { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { useAppTheme } from '../ThemeContext';

// One pulsing block — every skeleton in the app is built out of these,
// sized/shaped via `style` to match the real content it stands in for.
export default function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ backgroundColor: colors.buttonSecondary, opacity }, style]}
    />
  );
}
