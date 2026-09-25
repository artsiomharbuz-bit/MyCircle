import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../ThemeContext';
import { Colors, motion, radius, space } from '../theme';

export default function TypingDots() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const dots = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const loops = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 140),
          Animated.timing(dot, {
            toValue: 1,
            duration: motion.duration.slow,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: motion.duration.slow,
            useNativeDriver: true,
          }),
          Animated.delay((2 - index) * 140),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View style={styles.bubble}>
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              transform: [
                {
                  translateY: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -4],
                  }),
                },
              ],
              opacity: dot.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 1],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    bubble: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: space.xxs,
      paddingHorizontal: space.md,
      paddingVertical: 14,
      borderRadius: radius.lg,
      borderBottomLeftRadius: 6,
      backgroundColor: colors.inputBackground,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textMuted,
    },
  });
