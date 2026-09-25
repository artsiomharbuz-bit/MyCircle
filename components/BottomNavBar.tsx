import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Home01Icon, PlusSignIcon, SentIcon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import Badge from './Badge';
import ExploreIcon from './ExploreIcon';
import SmileyNavIcon from './SmileyNavIcon';
import { useAppTheme } from '../ThemeContext';
import { Colors, elevation, motion, space } from '../theme';

export const NAV_BAR_HEIGHT = 48;

const HIDE_THRESHOLD = 4;

// 'search' isn't rendered as its own icon anymore (search moved into the
// Home/Explore header), but screens still pass it as `active` while there so
// none of these four icons incorrectly lights up. 'create' is never `active`
// either — it opens the camera rather than landing on a tab of its own.
type Tab = 'home' | 'explore' | 'search' | 'dms' | 'profile';

export default function BottomNavBar({
  active,
  unreadMessageCount,
  scrollY,
  onPressHome,
  onPressExplore,
  onPressCreate,
  onPressDMs,
  onPressProfile,
}: {
  active: Tab;
  unreadMessageCount?: number;
  // Optional — screens that don't track scroll position just get a bar that
  // never hides. When given, the bar slides away under the bottom edge on a
  // deliberate scroll-down and slides back in on scroll-up, mirroring
  // CollapsibleHeader's behavior at the top of the screen.
  scrollY?: Animated.Value;
  onPressHome: () => void;
  onPressExplore: () => void;
  onPressCreate: () => void;
  onPressDMs: () => void;
  onPressProfile: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors, scheme);
  const [translateY] = useState(() => new Animated.Value(0));
  const lastY = useRef(0);
  const hidden = useRef(false);

  useEffect(() => {
    if (!scrollY) return;

    const id = scrollY.addListener(({ value }) => {
      const delta = value - lastY.current;
      lastY.current = value;

      const shouldHide = value > NAV_BAR_HEIGHT && delta > HIDE_THRESHOLD;
      const shouldShow = value <= NAV_BAR_HEIGHT || delta < -HIDE_THRESHOLD;

      if (shouldHide && !hidden.current) {
        hidden.current = true;
        Animated.timing(translateY, {
          toValue: NAV_BAR_HEIGHT,
          duration: motion.duration.base,
          useNativeDriver: true,
        }).start();
      } else if (shouldShow && hidden.current) {
        hidden.current = false;
        Animated.timing(translateY, {
          toValue: 0,
          duration: motion.duration.base,
          useNativeDriver: true,
        }).start();
      }
    });

    return () => scrollY.removeListener(id);
  }, [scrollY, translateY]);

  // `colors.white` is already "whichever color is the primary foreground for
  // the active theme" (real white on dark mode, near-black on light mode),
  // so the active tab is automatically legible either way. Every icon is
  // drawn in this one fully-opaque color — an inactive tab dims by giving
  // its *wrapping view* a lower opacity, not by drawing its strokes in a
  // translucent color. A translucent stroke alpha-blends with itself
  // everywhere two curves of the same path cross (an icon's outline
  // crosses itself constantly), so every overlap reads as a visibly darker
  // smudge; a solid stroke dimmed as one already-composited layer has
  // nothing to overlap with, so it stays a flat, even tone.
  const activeColor = colors.white;

  // Bold outline always; the active tab additionally fills solid (handled
  // per-icon below) so it reads as "the one you're on" beyond just the tint.
  // Each tab also gets a one-shot tap animation — fired *after* navigating,
  // not before: this component now lives in App.tsx rather than inside
  // each screen (see the note where it's mounted), so it survives a screen
  // switch and can animate the newly-active icon in place instead of
  // having to finish before it's safe to navigate away.
  const ICON_STROKE_WIDTH = 2.2;

  const homeScale = useRef(new Animated.Value(1)).current;
  const exploreSpin = useRef(new Animated.Value(0)).current;
  const dmsTranslate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dmsOpacity = useRef(new Animated.Value(1)).current;
  const profileNod = useRef(new Animated.Value(0)).current;

  const playHome = () => {
    homeScale.stopAnimation();
    homeScale.setValue(1);
    Animated.sequence([
      Animated.timing(homeScale, { toValue: 1.35, duration: 110, useNativeDriver: true }),
      Animated.spring(homeScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
    ]).start();
  };

  const playExplore = () => {
    exploreSpin.stopAnimation();
    exploreSpin.setValue(0);
    Animated.timing(exploreSpin, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  };

  const playDms = () => {
    dmsTranslate.stopAnimation();
    dmsOpacity.stopAnimation();
    dmsTranslate.setValue({ x: 0, y: 0 });
    dmsOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(dmsTranslate, {
        toValue: { x: 20, y: -16 },
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(dmsOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      dmsTranslate.setValue({ x: -20, y: 16 });
      Animated.parallel([
        Animated.timing(dmsTranslate, {
          toValue: { x: 0, y: 0 },
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(dmsOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    });
  };

  const playProfile = () => {
    profileNod.stopAnimation();
    profileNod.setValue(0);
    Animated.sequence([
      Animated.timing(profileNod, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(profileNod, { toValue: -1, duration: 110, useNativeDriver: true }),
      Animated.timing(profileNod, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const exploreSpinDeg = exploreSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const profileNodDeg = profileNod.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-14deg', '0deg', '14deg'],
  });

  // Dimming an inactive tab is a flat opacity on its whole wrapping view
  // (composited as one layer) rather than a translucent icon color — see
  // the comment on `activeColor` above.
  const INACTIVE_OPACITY = 0.55;
  const iconOpacity = (tab: Tab) => (active === tab ? 1 : INACTIVE_OPACITY);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <AnimatedPressable
        style={styles.tab}
        onPress={() => {
          onPressHome();
          requestAnimationFrame(playHome);
        }}
      >
        <Animated.View style={{ opacity: iconOpacity('home'), transform: [{ scale: homeScale }] }}>
          <HugeiconsIcon
            icon={Home01Icon}
            size={24}
            color={activeColor}
            fill={active === 'home' ? activeColor : 'none'}
            strokeWidth={ICON_STROKE_WIDTH}
          />
        </Animated.View>
      </AnimatedPressable>

      <AnimatedPressable
        style={styles.tab}
        onPress={() => {
          onPressExplore();
          requestAnimationFrame(playExplore);
        }}
      >
        <Animated.View style={{ opacity: iconOpacity('explore'), transform: [{ rotate: exploreSpinDeg }] }}>
          <ExploreIcon
            size={24}
            color={activeColor}
            active={active === 'explore'}
            backgroundColor={colors.background}
          />
        </Animated.View>
      </AnimatedPressable>

      <AnimatedPressable style={styles.createButton} onPress={onPressCreate}>
        <HugeiconsIcon icon={PlusSignIcon} size={26} color={activeColor} strokeWidth={ICON_STROKE_WIDTH} />
      </AnimatedPressable>

      <AnimatedPressable
        style={styles.tab}
        onPress={() => {
          onPressDMs();
          requestAnimationFrame(playDms);
        }}
      >
        <View style={styles.iconWrap}>
          <Animated.View
            style={{
              opacity: Animated.multiply(dmsOpacity, iconOpacity('dms')),
              transform: [{ translateX: dmsTranslate.x }, { translateY: dmsTranslate.y }],
            }}
          >
            <HugeiconsIcon
              icon={SentIcon}
              size={24}
              color={activeColor}
              fill={active === 'dms' ? activeColor : 'none'}
              strokeWidth={ICON_STROKE_WIDTH}
            />
          </Animated.View>
          <Badge count={unreadMessageCount} />
        </View>
      </AnimatedPressable>

      <AnimatedPressable
        style={styles.tab}
        onPress={() => {
          onPressProfile();
          requestAnimationFrame(playProfile);
        }}
      >
        <Animated.View style={{ opacity: iconOpacity('profile'), transform: [{ rotate: profileNodDeg }] }}>
          <SmileyNavIcon
            size={24}
            color={activeColor}
            active={active === 'profile'}
            backgroundColor={colors.background}
          />
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const createStyles = (colors: Colors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: NAV_BAR_HEIGHT,
      flexDirection: 'row',
      paddingHorizontal: space.sm,
      paddingTop: space.xxs,
      paddingBottom: space.xxs,
      gap: space.xxs,
      backgroundColor: colors.background,
      zIndex: 10,
      // Upward-facing lift off the bottom edge — see CollapsibleHeader's
      // matching comment for why light mode skips the shadow entirely.
      ...(scheme === 'dark'
        ? { ...elevation.medium, shadowOffset: { width: 0, height: -4 } }
        : null),
    },
    tab: {
      flex: 1,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrap: {
      position: 'relative',
    },
  });
