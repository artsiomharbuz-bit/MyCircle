import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Tick02Icon } from '@hugeicons/core-free-icons';
import { HEADER_HEIGHT } from './CollapsibleHeader';
import { useAppTheme } from '../ThemeContext';
import { Colors, elevation, radius, space, typography } from '../theme';

export type DropdownOption = { id: string; label: string; color?: string };

// A selection panel that drops down from the header (used for switching the
// Home circle / the Explore feed once the header title has turned into the
// current selection). Tapping outside closes it.
export default function HeaderDropdown({
  visible,
  options,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  options: DropdownOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors, scheme);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.panel}>
        {options.map((option) => {
          const selected = option.id === selectedId;
          return (
            <Pressable
              key={option.id}
              style={styles.row}
              onPress={() => {
                onClose();
                if (!selected) onSelect(option.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              {option.color && <View style={[styles.dot, { backgroundColor: option.color }]} />}
              <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
                {option.label}
              </Text>
              {selected && <HugeiconsIcon icon={Tick02Icon} size={18} color={colors.coral} />}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
    panel: {
      position: 'absolute',
      top: HEADER_HEIGHT - 6,
      left: space.xl,
      right: space.xl,
      maxHeight: '55%',
      paddingVertical: space.xxs,
      borderRadius: radius.lg,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      ...(scheme === 'dark' ? elevation.high : null),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      minHeight: 48,
      paddingHorizontal: space.md,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    label: { ...typography.body, color: colors.textMuted, flex: 1 },
    labelSelected: { fontFamily: 'Poppins_600SemiBold', color: colors.white },
  });
