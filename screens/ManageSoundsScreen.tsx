import AppTextInput from '../components/AppTextInput';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  MusicNote02Icon,
  Upload01Icon,
  Video01Icon,
} from '@hugeicons/core-free-icons';
import EmptyState from '../components/EmptyState';
import FormModal from '../components/FormModal';
import PrimaryButton from '../components/PrimaryButton';
import Skeleton from '../components/Skeleton';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { readableError } from '../errorMessage';
import { uploadFileToConvex } from '../uploadMedia';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space } from '../theme';

type Source = { kind: 'file'; name: string; uri: string; mimeType: string } | { kind: 'video'; name: string; uri: string };

// Settings > Sounds: turn a music file, or a video you have, into a sound
// anyone on MyCircle can find and use — plus a list of every sound this
// account has made, for jumping into one to edit it.
export default function ManageSoundsScreen({
  userId,
  onBack,
  onOpenSound,
}: {
  userId: Id<'users'>;
  onBack: () => void;
  onOpenSound: (soundId: Id<'sounds'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);

  const mySounds = useQuery(api.sounds.listMySounds, { userId });
  const generateUploadUrl = useMutation(api.sounds.generateUploadUrl);
  const createUploadedSound = useMutation(api.sounds.createUploadedSound);

  const [pendingSource, setPendingSource] = useState<Source | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPendingSource({
      kind: 'file',
      name: asset.name.replace(/\.[^.]+$/, ''),
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'audio/mpeg',
    });
    setName(asset.name.replace(/\.[^.]+$/, ''));
  };

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo/video library access was denied.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setPendingSource({ kind: 'video', name: 'My sound', uri: result.assets[0].uri });
    setName('My sound');
  };

  const closeForm = () => {
    setPendingSource(null);
    setName('');
    setError('');
  };

  const submit = async () => {
    if (!pendingSource || !name.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const uploadUrl = await generateUploadUrl({ userId });
      const audioStorageId = await uploadFileToConvex(
        pendingSource.uri,
        uploadUrl,
        pendingSource.kind === 'file' ? pendingSource.mimeType : 'video/mp4'
      );
      await createUploadedSound({
        ownerId: userId,
        name,
        audioStorageId: audioStorageId as Id<'_storage'>,
        audioIsVideo: pendingSource.kind === 'video',
      });
      closeForm();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} accessibilityLabel="Go back">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </Pressable>
        <Text variant="h3" style={styles.title}>Sounds</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="footnote" style={styles.sectionTitle}>Add a sound</Text>
        <View style={styles.addOptions}>
          <Pressable style={styles.addOption} onPress={pickFile}>
            <View style={styles.addIcon}>
              <HugeiconsIcon icon={Upload01Icon} size={19} color={colors.white} />
            </View>
            <View style={styles.addText}>
              <Text variant="bodyBold" style={styles.addLabel}>Upload an audio file</Text>
              <Text variant="caption" style={styles.addDescription}>
                An mp3 or other audio file from your device
              </Text>
            </View>
            <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={colors.textMuted} />
          </Pressable>

          <Pressable style={styles.addOption} onPress={pickVideo}>
            <View style={styles.addIcon}>
              <HugeiconsIcon icon={Video01Icon} size={19} color={colors.white} />
            </View>
            <View style={styles.addText}>
              <Text variant="bodyBold" style={styles.addLabel}>Use a video's sound</Text>
              <Text variant="caption" style={styles.addDescription}>
                Pick a video — its own audio becomes a usable sound
              </Text>
            </View>
            <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text variant="footnote" style={styles.sectionTitle}>Your sounds</Text>
        {mySounds === undefined && (
          <View style={styles.loading}>
            <Skeleton style={styles.soundRowSkeleton} />
            <Skeleton style={styles.soundRowSkeleton} />
            <Skeleton style={styles.soundRowSkeleton} />
          </View>
        )}
        {mySounds && mySounds.length === 0 && (
          <EmptyState
            icon={MusicNote02Icon}
            message="No sounds yet. Sounds you make — either from a post/clip going global, or added here — will show up in this list."
            style={styles.emptyState}
          />
        )}
        {mySounds?.map((sound) => (
          <Pressable
            key={sound._id}
            style={styles.soundRow}
            onPress={() => onOpenSound(sound._id as Id<'sounds'>)}
          >
            {sound.pictureUrl ? (
              <Image source={{ uri: sound.pictureUrl }} style={styles.soundPicture} />
            ) : (
              <View style={styles.soundPictureFallback}>
                <HugeiconsIcon icon={MusicNote02Icon} size={18} color={colors.white} />
              </View>
            )}
            <View style={styles.addText}>
              <Text variant="bodyBold" style={styles.addLabel} numberOfLines={1}>
                {sound.name}
              </Text>
              <Text variant="caption" style={styles.addDescription}>
                {sound.isGlobal ? 'Public' : 'Private'} · {sound.useCount}{' '}
                {sound.useCount === 1 ? 'use' : 'uses'}
              </Text>
            </View>
            <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>

      <FormModal
        visible={pendingSource !== null}
        title="Name this sound"
        subtitle="This is what everyone will see and search for."
        icon={MusicNote02Icon}
        onClose={closeForm}
        footer={
          <PrimaryButton
            label="Add sound"
            loading={submitting}
            disabled={name.trim().length === 0}
            onPress={submit}
          />
        }
      >
        <AppTextInput
          style={styles.nameInput}
          placeholder="Sound name"
          placeholderTextColor={colors.placeholder}
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (error) setError('');
          }}
          maxLength={60}
          autoFocus
        />
        {error !== '' && <Text variant="footnote" style={styles.error}>{error}</Text>}
      </FormModal>

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const PICTURE_SIZE = 44;

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
      gap: space.md,
      paddingHorizontal: space.xl,
      paddingBottom: space.md,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: colors.white,
    },
    content: {
      paddingHorizontal: space.lg,
      paddingBottom: space.xxl,
    },
    sectionTitle: {
      marginBottom: space.sm,
      marginTop: space.xxs,
      fontFamily: 'Poppins_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    addOptions: {
      backgroundColor: colors.inputBackground,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: space.xl,
    },
    addOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      minHeight: 60,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    addIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    addText: {
      flex: 1,
      gap: space.xxs,
    },
    addLabel: {
      color: colors.white,
    },
    addDescription: {
      color: colors.textMuted,
    },
    loading: {
      marginTop: space.lg,
      gap: space.sm,
    },
    soundRowSkeleton: {
      height: PICTURE_SIZE,
      borderRadius: radius.sm,
    },
    emptyState: {
      marginTop: space.sm,
    },
    soundRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingVertical: space.sm,
    },
    soundPicture: {
      width: PICTURE_SIZE,
      height: PICTURE_SIZE,
      borderRadius: radius.sm,
      backgroundColor: colors.buttonSecondary,
    },
    soundPictureFallback: {
      width: PICTURE_SIZE,
      height: PICTURE_SIZE,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonSecondary,
    },
    nameInput: {
      fontFamily: 'Poppins_400Regular',
      height: 56,
      borderRadius: radius.input,
      paddingHorizontal: space.xl,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.white,
      fontSize: 15,
    },
    error: {
      marginTop: space.md,
      color: colors.errorText,
    },
  });
