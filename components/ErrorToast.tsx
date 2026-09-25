import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Text from './AppText';
import { subscribeToErrors } from '../errorReporting';
import { useAppTheme } from '../ThemeContext';
import { Colors, elevation, radius, space, typography } from '../theme';

const VISIBLE_MS = 3500;

// Shows failed-and-unhandled backend calls as a short message at the top of
// the screen.
export default function ErrorToast() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () =>
      subscribeToErrors((next) => {
        setMessage(next);
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
            () => setMessage(null)
          );
        }, VISIBLE_MS);
      }),
    [opacity]
  );

  if (!message) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    toast: {
      position: 'absolute',
      top: 56,
      left: space.xl,
      right: space.xl,
      zIndex: 2000,
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      ...elevation.high,
    },
    text: {
      ...typography.callout,
      color: colors.white,
      textAlign: 'center',
    },
  });
