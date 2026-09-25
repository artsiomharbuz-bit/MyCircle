import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius } from '../theme';

export type CircleLabelData = { id: string; name: string; color: string };

// A small pill naming the circle(s) a post/clip/story was shared to: a ring in
// the circle's own color, then its name, then "+N" when there are more.
// `onDark` is for labels sitting on top of full-bleed media (clips, stories);
// on a post card it follows the theme.
export default function CircleLabel({
  circles,
  onDark = false,
}: {
  circles?: CircleLabelData[] | null;
  onDark?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors, onDark);
  if (!circles || circles.length === 0) return null;

  const first = circles[0];
  const extra = circles.length - 1;

  return (
    <View style={styles.pill}>
      <View style={[styles.ring, { borderColor: first.color }]}>
        <View style={[styles.core, { backgroundColor: first.color }]} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {first.name}
        {extra > 0 ? ` +${extra}` : ''}
      </Text>
    </View>
  );
}

const createStyles = (colors: Colors, onDark: boolean) =>
  StyleSheet.create({
    pill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      maxWidth: 150,
      height: 20,
      paddingLeft: 6,
      paddingRight: 8,
      borderRadius: radius.pill,
      backgroundColor: onDark ? 'rgba(0,0,0,0.5)' : colors.buttonSecondary,
      borderWidth: onDark ? 1 : 0,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    ring: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    core: { width: 2.5, height: 2.5, borderRadius: 1.25 },
    label: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 11,
      lineHeight: 15,
      color: onDark ? '#ffffff' : colors.white,
      flexShrink: 1,
    },
  });
