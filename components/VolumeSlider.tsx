import { useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react-native';
import { useAppTheme } from '../ThemeContext';
import { Colors, space, typography } from '../theme';

// A plain horizontal 0-1 slider, built on PanResponder rather than a native
// slider dependency — this project has no slider package, and one control
// isn't worth adding one for. Used for the sound/video volume balance in the
// audio-mix sheet.
export default function VolumeSlider({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: IconSvgElement;
  value: number;
  onChange: (value: number) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const trackWidth = useRef(0);
  const [dragging, setDragging] = useState(false);
  // The value the drag started from, so `onPanResponderMove` can add the
  // gesture's cumulative `dx` to it instead of recomputing from
  // `locationX` on every event — `locationX` is re-derived against the
  // touched native view on each move and is prone to briefly reporting a
  // stale/zeroed value mid-gesture (visible as the thumb jumping to 0 and
  // snapping back), where `dx` is a plain delta from the gesture's own
  // start point and doesn't have that problem.
  const dragStartValue = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        setDragging(true);
        if (trackWidth.current > 0) {
          const clamped = Math.max(
            0,
            Math.min(1, event.nativeEvent.locationX / trackWidth.current)
          );
          dragStartValue.current = clamped;
          onChange(clamped);
        }
      },
      onPanResponderMove: (_, gesture) => {
        if (trackWidth.current <= 0) return;
        const next = Math.max(
          0,
          Math.min(1, dragStartValue.current + gesture.dx / trackWidth.current)
        );
        onChange(next);
      },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    })
  ).current;

  const onTrackLayout = (event: LayoutChangeEvent) => {
    trackWidth.current = event.nativeEvent.layout.width;
  };

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <View style={styles.labelRow}>
          <HugeiconsIcon icon={icon} size={16} color={colors.textMuted} />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.valueText}>{Math.round(value * 100)}%</Text>
      </View>

      <View style={styles.track} onLayout={onTrackLayout} {...panResponder.panHandlers}>
        <View style={styles.trackBackground} />
        <View style={[styles.trackFill, { width: `${value * 100}%` }]} />
        <View
          style={[
            styles.thumb,
            dragging && styles.thumbActive,
            { left: `${value * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

const THUMB_SIZE = 20;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: 10,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
    },
    label: {
      fontSize: typography.footnote.fontSize,
      lineHeight: typography.footnote.lineHeight,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.textMuted,
    },
    valueText: {
      fontSize: typography.footnote.fontSize,
      lineHeight: typography.footnote.lineHeight,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.white,
    },
    track: {
      height: THUMB_SIZE,
      justifyContent: 'center',
    },
    trackBackground: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.buttonSecondary,
    },
    trackFill: {
      position: 'absolute',
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.white,
    },
    thumb: {
      position: 'absolute',
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      marginLeft: -THUMB_SIZE / 2,
      backgroundColor: colors.white,
      borderWidth: 2,
      borderColor: colors.background,
    },
    thumbActive: {
      transform: [{ scale: 1.15 }],
    },
  });
