import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import PrimaryButton from '../components/PrimaryButton';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';
import { compressMedia } from '../compressMedia';
import { readableError } from '../errorMessage';
import { uploadFileToConvex } from '../uploadMedia';
import useEntranceAnimation from '../useEntranceAnimation';
import type { CapturedMedia } from './CameraScreen';
import type { PersistedTextOverlay } from './EditMediaScreen';

export default function StoryAudienceScreen({
  userId,
  media,
  textOverlay,
  onBack,
  onPosted,
}: {
  userId: Id<'users'>;
  media: CapturedMedia;
  textOverlay: PersistedTextOverlay | null;
  onBack: () => void;
  onPosted: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation(['storyAudience', 'common']);
  const entrance = useEntranceAnimation();
  // No selected circles means "Friends"; otherwise the story is visible to
  // members of any selected circle.
  const [selectedCircleIds, setSelectedCircleIds] = useState<Id<'userCircles'>[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myCircles = useQuery(api.userCircles.listMyCircles, { userId });
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
  const createStory = useMutation(api.stories.createStory);

  const toggleCircle = (circleId: Id<'userCircles'>) => {
    setSelectedCircleIds((current) =>
      current.includes(circleId)
        ? current.filter((id) => id !== circleId)
        : [...current, circleId]
    );
  };

  const handleShare = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const compressedUri = await compressMedia(media.uri, media.type);
      const uploadUrl = await generateUploadUrl({ userId });
      const storageId = await uploadFileToConvex(
        compressedUri,
        uploadUrl,
        media.type === 'photo' ? 'image/jpeg' : 'video/mp4'
      );

      await createStory({
        authorId: userId,
        mediaStorageId: storageId as Id<'_storage'>,
        mediaType: media.type,
        circleIds: selectedCircleIds.length > 0 ? selectedCircleIds : undefined,
        textOverlay: textOverlay ?? undefined,
      });

      onPosted();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
      </Pressable>

      <Animated.View style={[styles.titleWrap, entrance]}>
        <Text style={styles.title}>{t('titleText')}</Text>
        <Text style={styles.subtitle}>{t('subtitleText')}</Text>
      </Animated.View>

      <Animated.View style={[styles.options, entrance]}>
        <Pressable
          style={[styles.option, selectedCircleIds.length === 0 && styles.optionActive]}
          onPress={() => setSelectedCircleIds([])}
        >
          <View style={[styles.optionDot, { backgroundColor: colors.coral }]} />
          <Text style={styles.optionLabel}>{t('friendsLabel')}</Text>
        </Pressable>

        {myCircles?.map((circle) => (
          <Pressable
            key={circle._id}
            style={[
              styles.option,
              selectedCircleIds.includes(circle._id as Id<'userCircles'>) && styles.optionActive,
            ]}
            onPress={() => toggleCircle(circle._id as Id<'userCircles'>)}
          >
            <View style={[styles.optionDot, { backgroundColor: circle.color }]} />
            <Text style={styles.optionLabel}>{circle.name}</Text>
          </Pressable>
        ))}
      </Animated.View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.shareButtonWrap}>
        <PrimaryButton label={t('shareStoryButton')} onPress={handleShare} loading={submitting} />
      </View>

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: space.xl,
      paddingTop: space.xxl,
      paddingBottom: space.xl,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleWrap: {
      marginTop: space.xxl,
    },
    title: {
      ...typography.h1,
      fontSize: 28,
      color: colors.white,
    },
    subtitle: {
      marginTop: space.xs,
      ...typography.body,
      color: colors.textMuted,
    },
    options: {
      marginTop: space.xxl,
      gap: space.sm,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      padding: space.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionActive: {
      borderColor: colors.white,
    },
    optionDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    optionLabel: {
      ...typography.bodyBold,
      color: colors.white,
    },
    error: {
      marginTop: space.md,
      color: colors.errorText,
      ...typography.footnote,
      textAlign: 'center',
    },
    shareButtonWrap: {
      marginTop: 'auto',
    },
  });
