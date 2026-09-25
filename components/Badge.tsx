import { StyleSheet, View, ViewStyle } from 'react-native';
import Text from './AppText';
import { useAppTheme } from '../ThemeContext';

// A small red badge — pass `count` for a number (renders nothing at 0,
// caps display at "99+"), or `dot` for a plain unlabeled dot. Positions
// itself absolutely, so the caller just needs a `position: 'relative'`
// (or default) wrapper around whatever it's badging.
export default function Badge({
  count,
  dot,
  style,
}: {
  count?: number;
  dot?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useAppTheme();

  if (dot) {
    return <View style={[styles.dot, { backgroundColor: colors.red }, style]} />;
  }
  if (!count || count <= 0) return null;

  return (
    <View style={[styles.badge, { backgroundColor: colors.red }, style]}>
      <Text variant="micro" style={styles.text}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
  },
});
