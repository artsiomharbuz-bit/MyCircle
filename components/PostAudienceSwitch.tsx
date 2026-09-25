import { Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAppTheme } from '../ThemeContext';
import { Colors, space } from '../theme';

export type PostAudienceFilter = 'circles' | 'global';

const OPTIONS: { key: PostAudienceFilter; label: string }[] = [
  { key: 'circles', label: 'Circles' },
  { key: 'global', label: 'Global' },
];

// Two plain text tabs with an underline on the active one — deliberately
// minimal, no container or icons.
export default function PostAudienceSwitch({
  value,
  onChange,
}: {
  value: PostAudienceFilter;
  onChange: (value: PostAudienceFilter) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      {OPTIONS.map(({ key, label }) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignSelf: 'center',
      gap: space.xl,
      marginBottom: space.md,
    },
    tab: {
      paddingVertical: space.xxs,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.white,
    },
    label: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
    labelActive: {
      color: colors.white,
    },
  });
