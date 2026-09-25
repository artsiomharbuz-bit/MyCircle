import { useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GridViewIcon, PlaySquareIcon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import { useAppTheme } from '../ThemeContext';
import { Colors, motion, space, typography } from '../theme';

export type ProfileContentTab = 'posts' | 'clips';

const TABS: { id: ProfileContentTab; label: string; icon: typeof GridViewIcon }[] = [
  { id: 'posts', label: 'Posts', icon: GridViewIcon },
  { id: 'clips', label: 'Clips', icon: PlaySquareIcon },
];

export default function ProfileContentSwitch({
  value,
  onChange,
}: {
  value: ProfileContentTab;
  onChange: (value: ProfileContentTab) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const anims = useRef(
    Object.fromEntries(TABS.map((t) => [t.id, new Animated.Value(t.id === value ? 1 : 0)]))
  ).current;

  const select = (id: ProfileContentTab) => {
    if (id === value) return;

    // JS-driven (not native) because we're animating width, not a transform —
    // scaleX + borderRadius on a thin bar like this fails to render at all on
    // some Android devices when native-driven, even though it looks fine on web.
    Animated.timing(anims[value], {
      toValue: 0,
      duration: motion.duration.base,
      useNativeDriver: false,
    }).start();

    Animated.timing(anims[id], {
      toValue: 1,
      duration: motion.duration.base,
      useNativeDriver: false,
    }).start();

    onChange(id);
  };

  return (
    <View style={styles.row}>
      {TABS.map((tab) => {
        const isSelected = tab.id === value;
        return (
          <AnimatedPressable key={tab.id} onPress={() => select(tab.id)} style={styles.tab}>
            <View style={styles.tabContent}>
              <HugeiconsIcon
                icon={tab.icon}
                size={16}
                color={isSelected ? colors.white : colors.textMuted}
                fill={isSelected ? colors.white : 'none'}
              />
              <Text style={[styles.label, { color: isSelected ? colors.white : colors.textMuted }]}>
                {tab.label}
              </Text>
            </View>
            <Animated.View
              style={[
                styles.underline,
                {
                  backgroundColor: colors.white,
                  width: anims[tab.id].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: space.xl,
    },
    tab: {
      alignItems: 'center',
    },
    tabContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    label: {
      ...typography.bodyBold,
    },
    underline: {
      marginTop: 6,
      height: 3,
      borderRadius: 2,
    },
  });
