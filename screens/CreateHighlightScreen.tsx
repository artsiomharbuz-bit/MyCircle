import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  Image02Icon,
  PlayIcon,
  PlusSignIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import Skeleton from '../components/Skeleton';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { compressMedia, compressPhoto } from '../compressMedia';
import { readableError } from '../errorMessage';
import { uploadFileToConvex } from '../uploadMedia';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

type PickedMedia = { uri: string; mediaType: 'photo' | 'video' };

const COVER_SIZE = 92;
const GRID_COLUMNS = 3;
const GRID_GAP = 6;

export default function CreateHighlightScreen({
  userId,
  onBack,
  onCreated,
}: {
  userId: Id<'users'>;
  onBack: () => void;
  onCreated: (highlightId: Id<'highlights'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation(['highlights', 'common']);

  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedStoryIds, setSelectedStoryIds] = useState<Id<'stories'>[]>([]);
  const [pickedMedia, setPickedMedia] = useState<PickedMedia[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recentStories = useQuery(api.highlights.listRecentStoriesForHighlight, { userId });
  const generateUploadUrl = useMutation(api.highlights.generateUploadUrl);
  const createHighlight = useMutation(api.highlights.createHighlight);

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('photoAccessDeniedError'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  };

  const addFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('photoAccessDeniedError'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 0.8,
    });
    if (result.canceled) return;
    const added = result.assets.map((asset) => ({
      uri: asset.uri,
      mediaType: (asset.type === 'video' ? 'video' : 'photo') as 'photo' | 'video',
    }));
    setPickedMedia((prev) => [...prev, ...added]);
  };

  const removePickedMedia = (index: number) => {
    setPickedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleStory = (storyId: Id<'stories'>) => {
    setSelectedStoryIds((prev) =>
      prev.includes(storyId) ? prev.filter((id) => id !== storyId) : [...prev, storyId]
    );
  };

  const totalItemCount = selectedStoryIds.length + pickedMedia.length;
  const canCreate = name.trim().length > 0 && !!coverUri && totalItemCount > 0 && !creating;

  const handleCreate = async () => {
    if (!canCreate || !coverUri) return;
    setCreating(true);
    setError(null);
    try {
      const compressedCover = await compressPhoto(coverUri);
      const coverUploadUrl = await generateUploadUrl({ userId });
      const coverStorageId = await uploadFileToConvex(compressedCover, coverUploadUrl, 'image/jpeg');

      const uploadedItems: { mediaStorageId: Id<'_storage'>; mediaType: 'photo' | 'video' }[] = [];
      for (const media of pickedMedia) {
        const compressed = await compressMedia(media.uri, media.mediaType);
        const uploadUrl = await generateUploadUrl({ userId });
        const storageId = await uploadFileToConvex(
          compressed,
          uploadUrl,
          media.mediaType === 'photo' ? 'image/jpeg' : 'video/mp4'
        );
        uploadedItems.push({ mediaStorageId: storageId as Id<'_storage'>, mediaType: media.mediaType });
      }

      const highlightId = await createHighlight({
        ownerId: userId,
        name: name.trim(),
        coverStorageId: coverStorageId as Id<'_storage'>,
        storyIds: selectedStoryIds,
        uploadedItems,
      });
      if (highlightId) onCreated(highlightId);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} accessibilityLabel={t('common:back')}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>{t('createTitle')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.coverSection}>
          <Pressable onPress={pickCover} style={styles.coverPicker}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverPlaceholder}>
                <HugeiconsIcon icon={Image02Icon} size={24} color={colors.textMuted} />
              </View>
            )}
          </Pressable>
          <Text style={styles.coverLabel}>{t('coverLabel')}</Text>
        </View>

        <TextField
          style={styles.nameInput}
          placeholder={t('namePlaceholder')}
          value={name}
          onChangeText={setName}
          cursorColor={colors.coral}
          maxLength={30}
        />

        <Text style={styles.sectionLabel}>{t('addStoriesLabel')}</Text>
        {recentStories === undefined ? (
          <View style={styles.grid}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} style={styles.gridTile} />
            ))}
          </View>
        ) : recentStories.length === 0 ? (
          <Text style={styles.emptyNote}>{t('noRecentStories')}</Text>
        ) : (
          <View style={styles.grid}>
            {recentStories.map((story) => {
              const selected = selectedStoryIds.includes(story._id);
              return (
                <Pressable
                  key={story._id}
                  style={styles.gridTile}
                  onPress={() => toggleStory(story._id)}
                >
                  {story.mediaType === 'photo' ? (
                    <Image source={{ uri: story.mediaUrl ?? undefined }} style={styles.gridImage} />
                  ) : (
                    <View style={styles.videoPlaceholder}>
                      <HugeiconsIcon icon={PlayIcon} size={22} color={colors.white} />
                    </View>
                  )}
                  <View style={[styles.tileOverlay, selected && styles.tileOverlaySelected]} />
                  <View style={[styles.checkBadge, selected && styles.checkBadgeSelected]}>
                    {selected && <HugeiconsIcon icon={Tick02Icon} size={13} color={colors.black} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>{t('addFromLibraryLabel')}</Text>
        <View style={styles.grid}>
          <Pressable style={[styles.gridTile, styles.addTile]} onPress={addFromLibrary}>
            <HugeiconsIcon icon={PlusSignIcon} size={22} color={colors.textMuted} />
          </Pressable>
          {pickedMedia.map((media, index) => (
            <View key={`${media.uri}-${index}`} style={styles.gridTile}>
              {media.mediaType === 'photo' ? (
                <Image source={{ uri: media.uri }} style={styles.gridImage} />
              ) : (
                <View style={styles.videoPlaceholder}>
                  <HugeiconsIcon icon={PlayIcon} size={22} color={colors.white} />
                </View>
              )}
              <Pressable
                style={styles.removeBadge}
                onPress={() => removePickedMedia(index)}
                accessibilityLabel={t('common:remove')}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={12} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.createButtonWrap}>
        <PrimaryButton
          label={t('createButton')}
          onPress={handleCreate}
          disabled={!canCreate}
          loading={creating}
        />
      </View>

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const createStyles = (colors: Colors) => {
  const tileSize = 100;
  return StyleSheet.create({
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
      ...typography.h2,
      color: colors.white,
    },
    content: {
      paddingHorizontal: space.lg,
      paddingBottom: space.xxl,
    },
    coverSection: {
      alignItems: 'center',
      marginBottom: space.lg,
    },
    coverPicker: {
      width: COVER_SIZE,
      height: COVER_SIZE,
      borderRadius: COVER_SIZE / 2,
      overflow: 'hidden',
    },
    coverImage: {
      flex: 1,
    },
    coverPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: COVER_SIZE / 2,
    },
    coverLabel: {
      marginTop: space.xs,
      ...typography.caption,
      color: colors.textMuted,
    },
    nameInput: {
      marginBottom: space.lg,
    },
    sectionLabel: {
      marginBottom: space.sm,
      ...typography.caption,
      fontFamily: 'Poppins_600SemiBold',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    sectionLabelSpaced: {
      marginTop: space.lg,
    },
    emptyNote: {
      ...typography.footnote,
      color: colors.textMuted,
      marginBottom: space.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
    },
    gridTile: {
      width: tileSize,
      height: tileSize,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.inputBackground,
    },
    gridImage: {
      flex: 1,
    },
    videoPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#2a2a2a',
    },
    tileOverlay: {
      ...StyleSheet.absoluteFill,
    },
    tileOverlaySelected: {
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderWidth: 2,
      borderColor: colors.white,
      borderRadius: radius.md,
    },
    checkBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkBadgeSelected: {
      backgroundColor: colors.white,
    },
    removeBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addTile: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    error: {
      marginTop: space.md,
      ...typography.footnote,
      color: colors.red,
    },
    createButtonWrap: {
      marginHorizontal: space.lg,
      marginBottom: space.xl,
    },
  });
};
