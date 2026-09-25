import AppTextInput from './AppTextInput';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from './AppText';
import * as ImagePicker from 'expo-image-picker';
import { useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Flag02Icon,
  Image01Icon,
} from '@hugeicons/core-free-icons';
import FormModal from './FormModal';
import PrimaryButton from './PrimaryButton';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { uploadFileToConvex } from '../uploadMedia';
import { readableError } from '../errorMessage';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

// Reporting a profile takes a written explanation rather than a menu choice,
// and optionally a screenshot as evidence — moderators need the context for
// an account-level report in a way they don't for a single post.
export default function ProfileReportModal({
  visible,
  targetUserId,
  targetUsername,
  reporterId,
  onClose,
}: {
  visible: boolean;
  targetUserId: Id<'users'>;
  targetUsername?: string;
  reporterId: Id<'users'>;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const reportProfile = useMutation(api.moderation.reportProfile);
  const generateUploadUrl = useMutation(api.moderation.generateEvidenceUploadUrl);

  const [reason, setReason] = useState('');
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    setReason('');
    setEvidenceUri(null);
    setSubmitted(false);
    setError('');
    onClose();
  };

  const pickEvidence = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo access was denied, so evidence cannot be attached.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled) {
      setEvidenceUri(result.assets[0].uri);
      setError('');
    }
  };

  const submit = async () => {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      let evidenceStorageId: Id<'_storage'> | undefined;
      if (evidenceUri) {
        const uploadUrl = await generateUploadUrl({ userId: reporterId });
        evidenceStorageId = (await uploadFileToConvex(
          evidenceUri,
          uploadUrl,
          'image/jpeg'
        )) as Id<'_storage'>;
      }

      await reportProfile({ targetUserId, reporterId, reason, evidenceStorageId });
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
        subtitle="Your report has been sent to our moderators. They'll look at this account and the evidence you attached, and decide what happens next."
        icon={CheckmarkCircle01Icon}
        onClose={close}
        footer={<PrimaryButton label="Done" onPress={close} />}
      />
    );
  }

  return (
    <FormModal
      visible={visible}
      title={targetUsername ? `Report @${targetUsername}` : 'Report this profile'}
      subtitle="Tell us what's wrong with this account in your own words. You can attach a screenshot as evidence."
      icon={Flag02Icon}
      onClose={close}
      footer={
        <PrimaryButton
          label="Submit report"
          tone="danger"
          loading={submitting}
          disabled={reason.trim().length === 0}
          onPress={submit}
        />
      }
    >
      <Text style={styles.label}>What happened?</Text>
      <AppTextInput
        style={styles.textArea}
        placeholder="Describe the problem — what they posted, said, or did."
        placeholderTextColor={colors.placeholder}
        multiline
        textAlignVertical="top"
        maxLength={1000}
        value={reason}
        onChangeText={(value) => {
          setReason(value);
          if (error) setError('');
        }}
      />
      <Text style={styles.counter}>{reason.length}/1000</Text>

      <Text style={styles.label}>Evidence (optional)</Text>
      {evidenceUri ? (
        <View style={styles.evidenceWrap}>
          <Image source={{ uri: evidenceUri }} style={styles.evidenceImage} />
          <Pressable style={styles.removeEvidence} onPress={() => setEvidenceUri(null)}>
            <HugeiconsIcon icon={Cancel01Icon} size={16} color={colors.accentText} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.picker, pressed && styles.pickerPressed]}
          onPress={pickEvidence}
        >
          <View style={styles.pickerIcon}>
            <HugeiconsIcon icon={Image01Icon} size={20} color={colors.white} />
          </View>
          <View style={styles.pickerText}>
            <Text style={styles.pickerLabel}>Attach a screenshot</Text>
            <Text style={styles.pickerHint}>Helps moderators see what you saw</Text>
          </View>
        </Pressable>
      )}

      {error !== '' && <Text style={styles.error}>{error}</Text>}
    </FormModal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    label: {
      marginBottom: 10,
      fontSize: 13,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    textArea: {
      ...typography.body,
      minHeight: 130,
      borderRadius: radius.input,
      padding: space.md,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.white,
    },
    counter: {
      marginTop: space.xs,
      marginBottom: 26,
      textAlign: 'right',
      ...typography.caption,
      color: colors.textMuted,
    },
    picker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      padding: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    pickerPressed: {
      backgroundColor: colors.buttonSecondary,
    },
    pickerIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    pickerText: {
      flex: 1,
      gap: 2,
    },
    pickerLabel: {
      ...typography.bodyBold,
      color: colors.white,
    },
    pickerHint: {
      ...typography.caption,
      color: colors.textMuted,
    },
    evidenceWrap: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    evidenceImage: {
      width: '100%',
      height: 220,
    },
    removeEvidence: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    error: {
      marginTop: space.md,
      ...typography.footnote,
      color: colors.errorText,
    },
  });
