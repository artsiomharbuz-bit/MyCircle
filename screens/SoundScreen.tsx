import AppTextInput from '../components/AppTextInput';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  Bookmark02Icon,
  Flag02Icon,
  MusicNote02Icon,
  PauseIcon,
  PencilEdit01Icon,
  PlayIcon,
} from '@hugeicons/core-free-icons';
import EmptyState from '../components/EmptyState';
import FormModal from '../components/FormModal';
import PrimaryButton from '../components/PrimaryButton';
import ProfileContentSwitch, { ProfileContentTab } from '../components/ProfileContentSwitch';
import Skeleton from '../components/Skeleton';
import SoundReportModal from '../components/SoundReportModal';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { readableError } from '../errorMessage';
import { uploadFileToConvex } from '../uploadMedia';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 3;
const GRID_COLUMNS = 3;
const GRID_TILE_SIZE = (SCREEN_WIDTH - 48 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

// The screen a sound's name opens to everywhere it appears: who made it, a
// preview, Save/Report (or Edit, for its own creator), and every post/clip
// currently using it.
export default function SoundScreen({
  soundId,
  viewerId,
  onBack,
  onOpenUser,
  onOpenClip,
}: {
  soundId: Id<'sounds'>;
  viewerId: Id<'users'>;
  onBack: () => void;
  onOpenUser: (userId: Id<'users'>) => void;
  onOpenClip: (postId: Id<'posts'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation(['sound', 'common']);

  const sound = useQuery(api.sounds.getSound, { soundId, viewerId });
  const toggleSave = useMutation(api.sounds.toggleSaveSound);

  const [tab, setTab] = useState<ProfileContentTab>('clips');
  const [previewing, setPreviewing] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const content = useQuery(
    api.sounds.listContentForSound,
    sound && !sound.isDeleted
      ? { soundId, contentKind: tab === 'clips' ? 'clip' : 'post', viewerId }
      : 'skip'
  );

  const player = useVideoPlayer(
    previewing && sound?.audioUrl ? { uri: sound.audioUrl } : null,
    (p) => {
      p.loop = true;
    }
  );
  useEffect(() => {
    if (previewing) player.play();
    else player.pause();
  }, [previewing, player]);

  if (sound === undefined) {
    return (
      <View style={styles.container}>
        <Header onBack={onBack} colors={colors} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.white} />
        </View>
        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      </View>
    );
  }

  if (sound === null) {
    return (
      <View style={styles.container}>
        <Header onBack={onBack} colors={colors} />
        <View style={styles.loading}>
          <Text variant="callout" style={styles.emptyText}>{t('soundNotFoundText')}</Text>
        </View>
        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header onBack={onBack} colors={colors} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Pressable
            style={styles.pictureButton}
            disabled={sound.isDeleted || !sound.audioUrl}
            onPress={() => setPreviewing((v) => !v)}
          >
            {sound.pictureUrl ? (
              <Image source={{ uri: sound.pictureUrl }} style={styles.picture} />
            ) : (
              <View style={styles.pictureFallback}>
                <HugeiconsIcon icon={MusicNote02Icon} size={30} color={colors.white} />
              </View>
            )}
            {!sound.isDeleted && sound.audioUrl && (
              <View style={styles.playOverlay}>
                <HugeiconsIcon
                  icon={previewing ? PauseIcon : PlayIcon}
                  size={20}
                  color="#ffffff"
                />
              </View>
            )}
          </Pressable>

          <Text variant="h1" style={styles.name}>{sound.name}</Text>

          {sound.owner && (
            <Pressable onPress={() => onOpenUser(sound.owner!._id as Id<'users'>)}>
              <Text variant="callout" style={styles.owner}>
                {t('ownerLabel', { username: sound.owner.username ?? t('unknownUsername') })}
              </Text>
            </Pressable>
          )}

          <Text variant="footnote" style={styles.useCount}>
            {sound.useCount === 1
              ? t('useCountSingular', { count: sound.useCount })
              : t('useCountPlural', { count: sound.useCount })}
          </Text>

          {sound.isDeleted ? (
            <View style={styles.deletedBanner}>
              <Text variant="footnote" style={styles.deletedText}>
                {t('deletedBannerText')}
              </Text>
            </View>
          ) : (
            <View style={styles.actionsRow}>
              {sound.isOwner ? (
                <PrimaryButton
                  label={t('editSoundButton')}
                  tone="ghost"
                  onPress={() => setEditVisible(true)}
                />
              ) : (
                <>
                  <Pressable
                    style={[styles.pillButton, sound.isSaved && styles.pillButtonActive]}
                    onPress={() => toggleSave({ soundId, userId: viewerId })}
                  >
                    <HugeiconsIcon
                      icon={Bookmark02Icon}
                      size={16}
                      color={sound.isSaved ? colors.black : colors.white}
                      fill={sound.isSaved ? colors.black : 'none'}
                    />
                    <Text
                      variant="calloutBold"
                      style={[styles.pillButtonText, sound.isSaved && styles.pillButtonTextActive]}
                    >
                      {sound.isSaved ? t('savedLabel') : t('common:save')}
                    </Text>
                  </Pressable>

                  <Pressable style={styles.pillButton} onPress={() => setReportVisible(true)}>
                    <HugeiconsIcon icon={Flag02Icon} size={16} color={colors.white} />
                    <Text variant="calloutBold" style={styles.pillButtonText}>{t('common:report')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>

        {!sound.isDeleted && (
          <>
            <View style={styles.switchRow}>
              <ProfileContentSwitch value={tab} onChange={setTab} />
            </View>

            {content === undefined ? (
              <View style={styles.grid}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} style={styles.gridSkeletonTile} />
                ))}
              </View>
            ) : content.length === 0 ? (
              <EmptyState
                icon={MusicNote02Icon}
                message={
                  tab === 'clips' ? t('noClipsUseSound') : t('noPostsUseSound')
                }
                style={styles.emptyState}
              />
            ) : (
              <View style={styles.grid}>
                {content.map((item) => (
                  <ContentTile
                    key={item._id}
                    mediaUrl={item.mediaUrl}
                    mediaType={item.mediaType}
                    onPress={() =>
                      tab === 'clips'
                        ? onOpenClip(item._id as Id<'posts'>)
                        : onOpenUser(item.author!._id as Id<'users'>)
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <EditSoundModal
        visible={editVisible}
        soundId={soundId}
        userId={viewerId}
        currentName={sound.name}
        currentPictureUrl={sound.pictureUrl}
        onClose={() => setEditVisible(false)}
      />

      <SoundReportModal
        visible={reportVisible}
        soundId={soundId}
        soundName={sound.name}
        reporterId={viewerId}
        onClose={() => setReportVisible(false)}
      />

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

function Header({ onBack, colors }: { onBack: () => void; colors: Colors }) {
  const styles = createStyles(colors);
  const { t } = useTranslation('sound');
  return (
    <View style={styles.header}>
      <Pressable style={styles.backButton} onPress={onBack} accessibilityLabel={t('goBackLabel')}>
        <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
      </Pressable>
      <Text variant="h3" style={styles.headerTitle}>{t('headerTitle')}</Text>
    </View>
  );
}

function ContentTile({
  mediaUrl,
  mediaType,
  onPress,
}: {
  mediaUrl: string | null;
  mediaType: 'photo' | 'video';
  onPress: () => void;
}) {
  const player = useVideoPlayer(
    mediaType === 'video' && mediaUrl ? { uri: mediaUrl } : null,
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    }
  );

  return (
    <Pressable style={tileStyles.tile} onPress={onPress}>
      {mediaUrl &&
        (mediaType === 'photo' ? (
          <Image source={{ uri: mediaUrl }} style={tileStyles.media} />
        ) : (
          <VideoView
            style={tileStyles.media}
            player={player}
            nativeControls={false}
            contentFit="cover"
            surfaceType="textureView"
            pointerEvents="none"
          />
        ))}
    </Pressable>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    width: GRID_TILE_SIZE,
    height: GRID_TILE_SIZE * 1.4,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  media: {
    ...StyleSheet.absoluteFill,
  },
});

// Owner-only: rename the sound and/or swap its picture.
function EditSoundModal({
  visible,
  soundId,
  userId,
  currentName,
  currentPictureUrl,
  onClose,
}: {
  visible: boolean;
  soundId: Id<'sounds'>;
  userId: Id<'users'>;
  currentName: string;
  currentPictureUrl: string | null;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation(['sound', 'common']);
  const updateSound = useMutation(api.sounds.updateSound);
  const generateUploadUrl = useMutation(api.sounds.generateUploadUrl);

  const [name, setName] = useState(currentName);
  const [pictureUri, setPictureUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    setName(currentName);
    setPictureUri(null);
    setError('');
    onClose();
  };

  const pickPicture = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('photoAccessDeniedError'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled) setPictureUri(result.assets[0].uri);
  };

  const save = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      let pictureStorageId: Id<'_storage'> | undefined;
      if (pictureUri) {
        const uploadUrl = await generateUploadUrl({ userId });
        pictureStorageId = (await uploadFileToConvex(
          pictureUri,
          uploadUrl,
          'image/jpeg'
        )) as Id<'_storage'>;
      }
      await updateSound({ soundId, userId, name, pictureStorageId });
      close();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const displayPicture = pictureUri ?? currentPictureUrl;

  return (
    <FormModal
      visible={visible}
      title={t('editSoundModalTitle')}
      subtitle={t('editSoundModalSubtitle')}
      icon={PencilEdit01Icon}
      onClose={close}
      footer={
        <PrimaryButton
          label={t('saveChangesButton')}
          loading={submitting}
          disabled={name.trim().length === 0}
          onPress={save}
        />
      }
    >
      <Pressable style={styles.editPictureButton} onPress={pickPicture}>
        {displayPicture ? (
          <Image source={{ uri: displayPicture }} style={styles.editPicture} />
        ) : (
          <View style={styles.editPictureFallback}>
            <HugeiconsIcon icon={MusicNote02Icon} size={26} color={colors.white} />
          </View>
        )}
        <View style={styles.editPictureBadge}>
          <HugeiconsIcon icon={PencilEdit01Icon} size={13} color="#ffffff" />
        </View>
      </Pressable>

      <AppTextInput
        style={styles.nameInput}
        placeholder={t('soundNamePlaceholder')}
        placeholderTextColor={colors.placeholder}
        value={name}
        onChangeText={(value) => {
          setName(value);
          if (error) setError('');
        }}
        maxLength={60}
      />

      {error !== '' && <Text variant="footnote" style={styles.error}>{error}</Text>}
    </FormModal>
  );
}

const AVATAR = 96;

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
    headerTitle: {
      color: colors.white,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingBottom: 36,
    },
    hero: {
      alignItems: 'center',
      paddingHorizontal: space.xl,
      marginBottom: space.xl,
    },
    pictureButton: {
      width: AVATAR,
      height: AVATAR,
    },
    picture: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: radius.lg,
      backgroundColor: colors.buttonSecondary,
    },
    pictureFallback: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonSecondary,
    },
    playOverlay: {
      position: 'absolute',
      bottom: -6,
      right: -6,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.coral,
      borderWidth: 3,
      borderColor: colors.background,
    },
    name: {
      marginTop: space.lg,
      color: colors.white,
      textAlign: 'center',
    },
    owner: {
      marginTop: space.xxs,
      color: colors.textMuted,
    },
    useCount: {
      marginTop: space.sm,
      color: colors.textMuted,
    },
    deletedBanner: {
      marginTop: space.lg,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.red,
    },
    deletedText: {
      color: colors.errorText,
      textAlign: 'center',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: space.sm,
      marginTop: space.lg,
    },
    pillButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      paddingHorizontal: space.lg,
      height: 42,
      borderRadius: radius.button,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillButtonActive: {
      backgroundColor: colors.white,
      borderColor: colors.white,
    },
    pillButtonText: {
      color: colors.white,
    },
    pillButtonTextActive: {
      color: colors.black,
    },
    switchRow: {
      alignItems: 'center',
      marginBottom: space.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: space.xl,
      gap: GRID_GAP,
    },
    gridSkeletonTile: {
      width: GRID_TILE_SIZE,
      height: GRID_TILE_SIZE * 1.4,
      borderRadius: radius.sm,
    },
    emptyState: {
      marginTop: space.sm,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textMuted,
      marginTop: space.sm,
      paddingHorizontal: space.xl,
    },
    editPictureButton: {
      alignSelf: 'center',
      width: 88,
      height: 88,
      marginBottom: space.xl,
    },
    editPicture: {
      width: 88,
      height: 88,
      borderRadius: 20,
      backgroundColor: colors.buttonSecondary,
    },
    editPictureFallback: {
      width: 88,
      height: 88,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonSecondary,
    },
    editPictureBadge: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.coral,
      borderWidth: 3,
      borderColor: colors.background,
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
