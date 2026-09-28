import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Text from './AppText';
import { useAppTheme } from '../ThemeContext';

const INTRO_DELAY_MS = 150;
const INTRO_MS = 520;
const HOLD_MS = 900;
const FADE_MS = 350;

// The mark is drawn from a 176dp square whose white shape is ~140dp wide —
// the same size and position as the native launch splash icon, so the
// hand-off is seamless. From there the mark lifts a little above center while
// the MyCircle wordmark fades in beneath it.
const MARK_SIZE = 176;
const LIFT = 34;
const TEXT_TOP = MARK_SIZE / 2 + 22;

// White background in light mode, black in dark mode; the coral/red gradient
// outline is the same in both.
export default function SplashOverlay() {
  const { scheme } = useAppTheme();
  const dark = scheme === 'dark';
  const opacity = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(lift, {
        toValue: -LIFT,
        duration: INTRO_MS,
        delay: INTRO_DELAY_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: INTRO_MS,
        delay: INTRO_DELAY_MS + 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    intro.start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() =>
        setGone(true)
      );
    }, INTRO_DELAY_MS + INTRO_MS + HOLD_MS);
    return () => {
      intro.stop();
      clearTimeout(timer);
    };
  }, [opacity, lift, textOpacity]);

  if (gone) return null;

  return (
    <Animated.View pointerEvents="auto" style={[
        StyleSheet.absoluteFill,
        styles.wrap,
        { opacity, backgroundColor: dark ? '#000000' : '#FFFFFF' },
      ]}>
      <Animated.View style={[styles.group, { transform: [{ translateY: lift }] }]}>
        <Animated.Image
          source={require('../assets/mycirclelogo.png')}
          resizeMode="contain"
          style={styles.mark}
        />
        <Animated.View style={[styles.textWrap, { opacity: textOpacity }]}>
          <Text style={[styles.wordmark, { color: dark ? '#FFFFFF' : '#000000' }]}>MyCircle</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { width: MARK_SIZE, height: MARK_SIZE },
  textWrap: {
    position: 'absolute',
    top: TEXT_TOP,
    left: -60,
    right: -60,
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: 'Unbounded_500Medium',
    fontSize: 24,
    lineHeight: 30,
  },
});
