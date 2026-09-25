import { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react-native';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export type SheetAction = {
  key: string;
  label: string;
  description?: string;
  icon: IconSvgElement;
  // 'danger' paints the row's icon tile and label red (delete, ban, strike).
  // Everything else — including affirmative actions like "lift restriction"
  // — stays neutral; the label text carries the meaning, not the color.
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onPress: () => void;
};

// The house bottom sheet: a grabber, an optional title block, a list of
// tappable rows, and room for arbitrary content underneath. Every moderation
// menu in the app is built from this so they all feel like one feature.
export default function ActionSheet({
  visible,
  title,
  subtitle,
  actions = [],
  children,
  onClose,
}: {
  visible: boolean;
  title?: string;
  subtitle?: string;
  actions?: SheetAction[];
  children?: ReactNode;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.anchor} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {title && (
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {actions.length > 0 && (
              <View style={styles.list}>
                {actions.map((action) => {
                  const danger = action.tone === 'danger';
                  const labelColor = action.disabled
                    ? colors.textMuted
                    : danger
                      ? colors.red
                      : colors.white;

                  return (
                    <Pressable
                      key={action.key}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && !action.disabled && styles.rowPressed,
                      ]}
                      disabled={action.disabled}
                      onPress={action.onPress}
                    >
                      <View style={[styles.iconTile, danger && styles.iconTileDanger]}>
                        <HugeiconsIcon
                          icon={action.icon}
                          size={19}
                          color={danger ? colors.accentText : labelColor}
                        />
                      </View>
                      <View style={styles.rowText}>
                        <Text style={[styles.rowLabel, { color: labelColor }]}>
                          {action.label}
                        </Text>
                        {action.description && (
                          <Text style={styles.rowDescription}>{action.description}</Text>
                        )}
                      </View>
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}

            {children}
          </ScrollView>

          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'transparent',
    },
    anchor: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '86%',
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      paddingTop: space.xs,
      paddingHorizontal: space.lg,
      paddingBottom: space.xxl,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.buttonSecondary,
    },
    titleBlock: {
      paddingTop: space.lg,
      paddingBottom: space.xxs,
      gap: space.xxs,
    },
    title: {
      ...typography.h2,
      color: colors.white,
    },
    subtitle: {
      ...typography.footnote,
      color: colors.textMuted,
    },
    scroll: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingTop: space.md,
      paddingBottom: space.xxs,
    },
    list: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.sm,
      paddingVertical: space.sm,
      minHeight: 60,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowPressed: {
      backgroundColor: colors.buttonSecondary,
    },
    iconTile: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    iconTileDanger: {
      backgroundColor: colors.red,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      ...typography.bodyBold,
    },
    rowDescription: {
      ...typography.caption,
      color: colors.textMuted,
    },
    cancel: {
      marginTop: space.md,
      height: 50,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelLabel: {
      ...typography.bodyBold,
      color: colors.white,
    },
  });
