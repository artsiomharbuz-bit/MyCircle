import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { CheckmarkCircle01Icon, Flag02Icon, Tick01Icon } from '@hugeicons/core-free-icons';
import FormModal from './FormModal';
import PrimaryButton from './PrimaryButton';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { POST_REPORT_REASONS } from '../moderationOptions';
import { readableError } from '../errorMessage';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

// Reporting a post or clip: pick a reason, send it, get thanked. The report
// lands in every moderator's inbox the moment it's submitted.
export default function PostReportModal({
  visible,
  postId,
  postKind,
  reporterId,
  onClose,
}: {
  visible: boolean;
  postId: Id<'posts'>;
  postKind: 'post' | 'clip';
  reporterId: Id<'users'>;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const reportPost = useMutation(api.moderation.reportPost);

  const [reason, setReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    setReason(null);
    setSubmitted(false);
    setError('');
    onClose();
  };

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await reportPost({ postId, reporterId, reason });
      setSubmitted(true);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <FormModal
        visible={visible}
        title="Thanks for keeping MyCircle safe"
        subtitle={`Your report has been sent to our moderators. They'll review this ${postKind} and decide what happens next — you won't be told who reported it.`}
        icon={CheckmarkCircle01Icon}
        onClose={close}
        footer={<PrimaryButton label="Done" onPress={close} />}
      >
        <View style={styles.thanksCard}>
          <Text style={styles.thanksText}>
            Reported for: <Text style={styles.thanksReason}>{reason}</Text>
          </Text>
        </View>
      </FormModal>
    );
  }

  return (
    <FormModal
      visible={visible}
      title={`Report this ${postKind}`}
      subtitle="Why are you reporting it? Pick the closest reason — it helps moderators review faster."
      icon={Flag02Icon}
      onClose={close}
      footer={
        <PrimaryButton
          label="Submit report"
          tone="danger"
          loading={submitting}
          disabled={!reason}
          onPress={submit}
        />
      }
    >
      <View style={styles.list}>
        {POST_REPORT_REASONS.map((option) => {
          const selected = reason === option;
          return (
            <Pressable
              key={option}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
              onPress={() => {
                setReason(option);
                if (error) setError('');
              }}
            >
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {option}
              </Text>
              <View style={[styles.check, selected && styles.checkSelected]}>
                {selected && <HugeiconsIcon icon={Tick01Icon} size={13} color={colors.black} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      {error !== '' && <Text style={styles.error}>{error}</Text>}
    </FormModal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    list: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.md,
      paddingVertical: 15,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    optionPressed: {
      backgroundColor: colors.buttonSecondary,
    },
    optionSelected: {
      backgroundColor: colors.buttonSecondary,
    },
    optionLabel: {
      flex: 1,
      ...typography.body,
      color: colors.white,
    },
    optionLabelSelected: {
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '600',
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkSelected: {
      backgroundColor: colors.white,
      borderColor: colors.white,
    },
    error: {
      marginTop: space.md,
      ...typography.footnote,
      color: colors.errorText,
    },
    thanksCard: {
      padding: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    thanksText: {
      ...typography.callout,
      color: colors.textMuted,
    },
    thanksReason: {
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '600',
      color: colors.white,
    },
  });
