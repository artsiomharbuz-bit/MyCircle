import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import { IconSvgElement } from '@hugeicons/react-native';
import FormModal from './FormModal';
import PrimaryButton from './PrimaryButton';
import { readableError } from '../errorMessage';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

// The confirmation step that stands between a moderator and anything
// irreversible — a takedown, a dismissal, a ban. Deliberately a full screen
// rather than a small alert: it states plainly what is about to happen and
// who it happens to before the button is reachable.
export default function ConfirmActionModal({
  visible,
  title,
  subtitle,
  icon,
  consequences,
  confirmLabel,
  tone = 'danger',
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  icon: IconSvgElement;
  // Bulleted "here's what this does" lines shown above the buttons.
  consequences?: string[];
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    setError('');
    onClose();
  };

  const confirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onConfirm();
      close();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      visible={visible}
      title={title}
      subtitle={subtitle}
      icon={icon}
      onClose={close}
      footer={
        <View style={styles.footer}>
          <PrimaryButton
            label={confirmLabel}
            tone={tone}
            loading={submitting}
            onPress={confirm}
          />
          <PrimaryButton label="Go back" tone="ghost" onPress={close} />
        </View>
      }
    >
      {consequences && consequences.length > 0 && (
        <View style={styles.list}>
          {consequences.map((line) => (
            <View key={line} style={styles.item}>
              <View style={styles.bullet} />
              <Text style={styles.itemText}>{line}</Text>
            </View>
          ))}
        </View>
      )}

      {error !== '' && <Text style={styles.error}>{error}</Text>}
    </FormModal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    list: {
      padding: space.md,
      borderRadius: radius.lg,
      gap: 14,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
    },
    bullet: {
      marginTop: 7,
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.textMuted,
    },
    itemText: {
      flex: 1,
      ...typography.callout,
      color: colors.white,
    },
    error: {
      marginTop: space.md,
      ...typography.footnote,
      color: colors.errorText,
    },
    footer: {
      gap: space.sm,
    },
  });
