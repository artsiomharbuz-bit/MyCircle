import { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { StatusBar } from 'expo-status-bar';
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react-native';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { useAppTheme } from '../ThemeContext';
import { Colors, space, typography } from '../theme';

// A full-screen modal that behaves like a regular screen: back button with
// the house `paddingTop: 40`, a title block, and static content underneath.
//
// Anything with a TextInput uses this rather than a bottom sheet on purpose —
// the app's layouts never reposition for the keyboard, and a bottom sheet
// would simply be swallowed by it. Top-anchored content keeps every field
// visible while the keyboard covers only empty space below.
export default function FormModal({
  visible,
  title,
  subtitle,
  icon,
  children,
  footer,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  icon?: IconSvgElement;
  children?: ReactNode;
  // Pinned below the scrolling content; where the primary button lives.
  footer?: ReactNode;
  onClose: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel="Go back">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {icon && (
            <View style={styles.iconTile}>
              <HugeiconsIcon icon={icon} size={20} color={colors.white} />
            </View>
          )}

          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          <View style={styles.body}>{children}</View>
        </ScrollView>

        {footer && <View style={styles.footer}>{footer}</View>}

        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 40,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.xl,
      paddingBottom: 6,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: space.xl,
      paddingTop: 18,
      paddingBottom: space.xl,
    },
    // Matches the icon-tile language used everywhere else in the app
    // (Settings rows, ActionSheet rows) — a small neutral square, not a
    // decorative colored circle. The title and the primary button's own
    // color are what carry meaning (danger, etc.), not this.
    iconTile: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      marginBottom: space.md,
    },
    // Sheet/modal titles use h2 to match the ActionSheet reference pattern.
    title: {
      ...typography.h2,
      color: colors.white,
    },
    subtitle: {
      marginTop: 9,
      ...typography.callout,
      color: colors.textMuted,
    },
    body: {
      marginTop: space.xl,
    },
    footer: {
      paddingHorizontal: space.xl,
      paddingTop: space.sm,
      paddingBottom: 30,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
  });
