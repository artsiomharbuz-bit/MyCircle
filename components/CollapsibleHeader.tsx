import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react-native';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import Badge from './Badge';
import { useAppTheme } from '../ThemeContext';
import { Colors, elevation, motion, space, typography } from '../theme';

export const HEADER_HEIGHT = 88;

const HIDE_THRESHOLD = 4;

export type HeaderIcon = { icon: IconSvgElement; onPress: () => void };

export default function CollapsibleHeader({
  title,
  scrollY,
  onPressTitle,
  leftIcon,
  onPressLeft,
  leftBadgeCount,
  rightIcons,
  brand = false,
  titleBadgeCount,
  pinned = false,
  altTitle,
  altSwitchAt = 60,
  onPressAlt,
}: {
  title: string;
  scrollY: Animated.Value;
  onPressTitle?: () => void;
  leftIcon?: IconSvgElement;
  onPressLeft?: () => void;
  leftBadgeCount?: number;
  rightIcons?: HeaderIcon[];
  // Renders the title as the MyCircle wordmark (Unbounded Medium).
  brand?: boolean;
  // Red count bubble beside the title (e.g. unread messages on another
  // logged-in account).
  titleBadgeCount?: number;
  // Never slides away on scroll — needed when the title itself is meant to be
  // seen changing while the user scrolls.
  pinned?: boolean;
  // Once the list has scrolled past `altSwitchAt`, `title` cross-fades into
  // `altTitle` (e.g. the selected circle) and tapping the header calls
  // `onPressAlt` instead of `onPressTitle`.
  altTitle?: string;
  altSwitchAt?: number;
  onPressAlt?: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors, scheme);
  const [translateY] = useState(() => new Animated.Value(0));
  const lastY = useRef(0);
  const hidden = useRef(false);
  const [altActive, setAltActive] = useState(false);
  const altRef = useRef(false);

  // Time-based (not scroll-driven) so the swap always plays as one smooth
  // fade + slide, however fast or slowly the list is being scrolled.
  const altProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(altProgress, {
      toValue: altActive ? 1 : 0,
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [altActive, altProgress]);

  const baseOpacity = altProgress.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' });
  const baseShift = altProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const altOpacity = altProgress.interpolate({ inputRange: [0.4, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const altShift = altProgress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  useEffect(() => {
    if (!altTitle) {
      altRef.current = false;
      setAltActive(false);
      return;
    }
    const id = scrollY.addListener(({ value }) => {
      // A little hysteresis so hovering at the boundary doesn't flicker.
      const next = altRef.current ? value >= altSwitchAt - 14 : value >= altSwitchAt;
      if (next !== altRef.current) {
        altRef.current = next;
        setAltActive(next);
      }
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, altTitle, altSwitchAt]);

  useEffect(() => {
    if (pinned) return;
    const id = scrollY.addListener(({ value }) => {
      const delta = value - lastY.current;
      lastY.current = value;

      const shouldHide = value > HEADER_HEIGHT && delta > HIDE_THRESHOLD;
      const shouldShow = value <= HEADER_HEIGHT || delta < -HIDE_THRESHOLD;

      if (shouldHide && !hidden.current) {
        hidden.current = true;
        Animated.timing(translateY, {
          toValue: -HEADER_HEIGHT,
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
  }, [scrollY, translateY, pinned]);

  const titleNode = (
    <View style={styles.titleWrap}>
      <Animated.View
        style={altTitle ? { opacity: baseOpacity, transform: [{ translateY: baseShift }] } : undefined}
      >
        <Text style={[styles.title, brand && styles.brandTitle]}>{title}</Text>
      </Animated.View>
      {!!altTitle && (
        <Animated.View
          style={[styles.altWrap, { opacity: altOpacity, transform: [{ translateY: altShift }] }]}
          pointerEvents="none"
        >
          <Text style={[styles.title, brand && styles.brandTitle]} numberOfLines={1}>
            {altTitle}
          </Text>
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} color={colors.white} />
        </Animated.View>
      )}
      {!!titleBadgeCount && titleBadgeCount > 0 && (
        <Badge count={titleBadgeCount} style={styles.titleBadge} />
      )}
    </View>
  );

  const titlePress = altActive && onPressAlt ? onPressAlt : onPressTitle;

  return (
    <Animated.View style={[styles.header, { transform: [{ translateY }] }]}>

      {leftIcon && (
        <AnimatedPressable style={styles.leftButton} onPress={onPressLeft}>
          <HugeiconsIcon icon={leftIcon} size={20} color={colors.white} />
          <Badge count={leftBadgeCount} />
        </AnimatedPressable>
      )}

      {titlePress ? (
        <Pressable onPress={titlePress} hitSlop={10}>{titleNode}</Pressable>
      ) : (
        titleNode
      )}

      {rightIcons && rightIcons.length > 0 && (
        <View style={styles.rightButtonsRow}>
          {rightIcons.map(({ icon, onPress }, index) => (
            <AnimatedPressable key={index} style={styles.rightButton} onPress={onPress}>
              <HugeiconsIcon icon={icon} size={20} color={colors.white} />
            </AnimatedPressable>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const createStyles = (colors: Colors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: HEADER_HEIGHT,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 14,
      overflow: 'hidden',
      backgroundColor: colors.background,
      zIndex: 10,
      // A dark drop shadow reads as a soft lift on the dark theme, but just
      // looks like a dirty smudge under a light header — so light mode gets
      // no shadow at all instead of a lighter one.
      ...(scheme === 'dark' ? { ...elevation.medium } : null),
    },
    // A nav-bar title reads better lighter than a content headline — h3
    // (17px) is the conventional mobile nav-title weight/size, not h1
    // (24px), which made every screen's header feel oversized.
    title: {
      ...typography.h3,
      letterSpacing: 0.2,
      color: colors.white,
    },
    titleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    altWrap: {
      position: 'absolute',
      left: -60,
      right: -60,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xxs,
    },
    titleBadge: {
      position: 'relative',
      top: 0,
      right: 0,
      marginLeft: space.xs,
    },
    brandTitle: {
      fontFamily: 'Unbounded_500Medium',
      fontWeight: '500',
      fontSize: 18,
      letterSpacing: 0,
    },
    leftButton: {
      position: 'absolute',
      left: space.lg,
      bottom: 9,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    rightButtonsRow: {
      position: 'absolute',
      right: space.lg,
      bottom: 9,
      flexDirection: 'row',
      gap: space.xs,
    },
    rightButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
  });
