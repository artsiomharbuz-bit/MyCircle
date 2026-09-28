import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { useAuthedMutation as useMutation } from '../SessionContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { captureRef } from 'react-native-view-shot';
import PostTextOverlay from '../components/PostTextOverlay';
import { burnTextIntoVideo, canBurnText } from '../modules/burn-text';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  MusicNote02Icon,
  PenTool01Icon,
  StickerIcon,
  TextIcon,
  UserStoryIcon,
} from '@hugeicons/core-free-icons';
import AudioMixSheet from '../components/AudioMixSheet';
import DraggableText, { TextTransform } from '../components/DraggableText';
import NativePopup from '../components/nativepopup';
import SoundAudioLayer from '../components/SoundAudioLayer';
import SoundPickerModal, { PickedSound } from '../components/SoundPickerModal';
import TextToolEditor from '../components/TextToolEditor';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { compressMedia } from '../compressMedia';
import { readableError } from '../errorMessage';
import { uploadFileToConvex } from '../uploadMedia';
// Deliberately not theme-reactive — this is a full-bleed photo/video editing
// canvas, always dark chrome regardless of the app's own light/dark setting.
import { mediaColors as colors, radius, space, textToolFonts, TextToolFont, typography } from '../theme';
import type { CapturedMedia, PostKind } from './CameraScreen';

type TextOverlay = { text: string; color: string; font: TextToolFont };

// What actually gets persisted to the post for a video clip (a photo instead
// gets this burned straight into its pixels — see handleNext below). Position
// is normalized to the edited canvas's own size so playback can reproduce the
// same placement at any screen/card size.
export type PersistedTextOverlay = {
  text: string;
  color: string;
  fontFamily?: string;
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
};

export type AudioMode = 'sound-only' | 'both';

// What EditMediaScreen hands back about sound, for AudienceSelectionScreen
// to forward into createPost: either a sound the user explicitly picked (and
// how it's balanced against the clip's own audio, if any), the instruction
// to promote this video's own audio into a personal sound (the default for
// any video nobody picked a sound for), or nothing at all (photos with no
// sound picked have none to promote).
export type PersistedSound =
  | { kind: 'picked'; soundId: Id<'sounds'>; soundVolume: number; originalVolume: number; audioMode: AudioMode }
  | { kind: 'own' }
  | null;

const DEFAULT_SOUND_VOLUME = 0.8;
const DEFAULT_ORIGINAL_VOLUME = 1;

export default function EditMediaScreen({
  userId,
  media,
  kind,
  onBack,
  onConfirm,
}: {
  userId: Id<'users'>;
  media: CapturedMedia;
  // Sound only applies to posts/clips — a story never shows this screen's
  // sound controls.
  kind: PostKind;
  onBack: () => void;
  onConfirm: (
    media: CapturedMedia,
    textOverlay: PersistedTextOverlay | null,
    sound: PersistedSound
  ) => void;
}) {
  const { t } = useTranslation(['editMedia', 'common']);
  const player = useVideoPlayer(media.type === 'video' ? { uri: media.uri } : null, (p) => {
    if (media.type === 'video') {
      p.loop = true;
      p.play();
    }
  });

  const [isAddingText, setIsAddingText] = useState(false);
  const [textOverlay, setTextOverlay] = useState<TextOverlay | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canvasRef = useRef<View>(null);
  // Text-only layer (transparent) rendered behind the video purely so it can
  // be captured and burned into the video's pixels.
  const burnLayerRef = useRef<View>(null);
  const [burnOverlay, setBurnOverlay] = useState<PersistedTextOverlay | null>(null);
  const canvasSize = useRef({ width: 0, height: 0 });
  const transformRef = useRef<TextTransform>({
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotation: 0,
  });

  const soundEnabled = kind !== 'story';
  // A story is already the story flow — the shortcut only makes sense when
  // editing media headed for a post/clip instead.
  const canAddToStory = kind !== 'story';
  const [pickerVisible, setPickerVisible] = useState(false);
  const [mixSheetVisible, setMixSheetVisible] = useState(false);
  const [pickedSound, setPickedSound] = useState<PickedSound | null>(null);
  const [audioMode, setAudioMode] = useState<AudioMode>('both');
  const [soundVolume, setSoundVolume] = useState(DEFAULT_SOUND_VOLUME);
  const [originalVolume, setOriginalVolume] = useState(DEFAULT_ORIGINAL_VOLUME);
  const [addingToStory, setAddingToStory] = useState(false);
  const [addedToStoryVisible, setAddedToStoryVisible] = useState(false);
  const [addToStoryError, setAddToStoryError] = useState<string | null>(null);
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
  const createStory = useMutation(api.stories.createStory);

  // Live preview while editing: the video's own volume follows the same
  // mode/volume choice that will actually be saved, and the picked sound
  // plays in sync alongside it.
  useEffect(() => {
    if (media.type !== 'video') return;
    if (!pickedSound) {
      player.volume = 1;
      return;
    }
    player.volume = audioMode === 'both' ? originalVolume : 0;
  }, [media.type, pickedSound, audioMode, originalVolume, player]);

  const onCanvasLayout = (e: LayoutChangeEvent) => {
    canvasSize.current = {
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    };
  };

  const buildPersistedSound = (): PersistedSound => {
    if (pickedSound) {
      return {
        kind: 'picked',
        soundId: pickedSound._id,
        soundVolume,
        // A photo has no audio of its own — always sound-only either way.
        originalVolume: media.type === 'video' ? originalVolume : 0,
        audioMode: media.type === 'video' ? audioMode : 'sound-only',
      };
    }
    // Nobody picked a sound: a video's own audio becomes its personal sound
    // by default; a photo simply has none.
    return media.type === 'video' ? { kind: 'own' } : null;
  };


  const buildNormalizedOverlay = (): PersistedTextOverlay => {
    const { width, height } = canvasSize.current;
    return {
      text: textOverlay!.text,
      color: textOverlay!.color,
      fontFamily: textOverlay!.font.fontFamily,
      translateX: width > 0 ? transformRef.current.translateX / width : 0,
      translateY: height > 0 ? transformRef.current.translateY / height : 0,
      scale: transformRef.current.scale,
      rotation: transformRef.current.rotation,
    };
  };

  // Burns the text into the video's own pixels (Android native module) so it
  // is part of the file. Resolves null when that isn't possible (module not in
  // this build, or the encode failed) and the caller keeps the text as a
  // synced overlay instead.
  const burnTextIntoMedia = async (overlay: PersistedTextOverlay): Promise<string | null> => {
    if (!canBurnText || media.type !== 'video') return null;
    try {
      setBurnOverlay(overlay);
      // Let the text layer mount and lay out before capturing it.
      await new Promise((resolve) => setTimeout(resolve, 150));
      const pngUri = await captureRef(burnLayerRef, { format: 'png', quality: 1, result: 'tmpfile' });
      return await burnTextIntoVideo(media.uri, pngUri);
    } catch (err) {
      console.log('Failed to burn text into video, keeping it as an overlay', err);
      return null;
    } finally {
      setBurnOverlay(null);
    }
  };

  const handleNext = async () => {
    const sound = buildPersistedSound();

    if (!textOverlay) {
      onConfirm(media, null, sound);
      return;
    }

    if (media.type === 'photo') {
      // Rasterize the canvas (photo + positioned text) into a new image, so
      // the text is baked into the actual pixels instead of being separate
      // metadata that could get lost.
      setIsSaving(true);
      try {
        const uri = await captureRef(canvasRef, { format: 'jpg', quality: 0.92 });
        onConfirm({ uri, type: 'photo' }, null, sound);
        return;
      } catch (err) {
        console.log('Failed to burn text into photo, posting without it', err);
        onConfirm(media, null, sound);
        return;
      } finally {
        setIsSaving(false);
      }
    }

    const overlay = buildNormalizedOverlay();
    setIsSaving(true);
    try {
      const burnedUri = await burnTextIntoMedia(overlay);
      if (burnedUri) {
        onConfirm({ ...media, uri: burnedUri }, null, sound);
        return;
      }
    } finally {
      setIsSaving(false);
    }

    // Fallback (no native encoder in this build): persist the overlay as data
    // and re-render it identically wherever the clip plays.
    onConfirm(media, overlay, sound);
  };

  // A side action, not a step in the flow: posts the media to the user's
  // story right now (visible to Friends, same default as the full Story
  // flow) without leaving this screen — Next continues to work normally
  // afterward, toward posting it as a post/clip too.
  const handleAddToStory = async () => {
    if (addingToStory) return;
    setAddToStoryError(null);
    setAddingToStory(true);
    try {
      let storyMedia = media;
      let overlay: PersistedTextOverlay | null = null;

      if (textOverlay) {
        if (media.type === 'photo') {
          try {
            const uri = await captureRef(canvasRef, { format: 'jpg', quality: 0.92 });
            storyMedia = { uri, type: 'photo' };
          } catch (err) {
            console.log('Failed to burn text into photo for story, continuing without it', err);
          }
        } else {
          const normalized = buildNormalizedOverlay();
          const burnedUri = await burnTextIntoMedia(normalized);
          if (burnedUri) {
            storyMedia = { ...media, uri: burnedUri };
          } else {
            overlay = normalized;
          }
        }
      }

      const compressedUri = await compressMedia(storyMedia.uri, storyMedia.type);
      const uploadUrl = await generateUploadUrl({ userId });
      const storageId = await uploadFileToConvex(
        compressedUri,
        uploadUrl,
        storyMedia.type === 'photo' ? 'image/jpeg' : 'video/mp4'
      );

      await createStory({
        authorId: userId,
        mediaStorageId: storageId as Id<'_storage'>,
        mediaType: storyMedia.type,
        textOverlay: overlay ?? undefined,
      });

      setAddedToStoryVisible(true);
    } catch (err) {
      setAddToStoryError(readableError(err));
    } finally {
      setAddingToStory(false);
    }
  };

  return (
    <View style={[styles.container, media.previewAspect ? styles.containerCentered : null]}>
      <View
        ref={canvasRef}
        collapsable={false}
        style={
          media.previewAspect
            ? { marginHorizontal: 16, aspectRatio: media.previewAspect, overflow: 'hidden' }
            : StyleSheet.absoluteFill
        }
        onLayout={onCanvasLayout}
      >
        {burnOverlay && (
          <View
            ref={burnLayerRef}
            collapsable={false}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          >
            <PostTextOverlay overlay={burnOverlay} />
          </View>
        )}

        {media.type === 'photo' ? (
          <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <VideoView
            style={StyleSheet.absoluteFill}
            player={player}
            nativeControls={false}
            contentFit="cover"
          />
        )}

        {textOverlay && (
          <View pointerEvents="box-none" style={styles.overlayCenter}>
            <DraggableText
              text={textOverlay.text}
              color={textOverlay.color}
              fontFamily={textOverlay.font.fontFamily}
              onTransformChange={(t) => {
                transformRef.current = t;
              }}
            />
          </View>
        )}
      </View>

      {pickedSound && (
        <SoundAudioLayer
          audioUrl={pickedSound.audioUrl}
          volume={soundVolume}
          isActive
          syncPlayer={media.type === 'video' ? player : undefined}
        />
      )}

      <Pressable style={styles.backButton} onPress={onBack}>
        <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
      </Pressable>

      {soundEnabled && (
        <Pressable
          style={[styles.addSoundButton, pickedSound && styles.addSoundButtonActive]}
          onPress={() => setPickerVisible(true)}
        >
          <HugeiconsIcon icon={MusicNote02Icon} size={16} color={colors.white} />
          <Text style={styles.addSoundText} numberOfLines={1}>
            {pickedSound ? pickedSound.name : t('addSoundButton')}
          </Text>
        </Pressable>
      )}

      <View style={styles.toolbar}>
        <Pressable style={styles.toolButton} onPress={() => setIsAddingText(true)}>
          <HugeiconsIcon icon={TextIcon} size={22} color={colors.white} />
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => {}}>
          <HugeiconsIcon icon={PenTool01Icon} size={22} color={colors.white} />
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => {}}>
          <HugeiconsIcon icon={StickerIcon} size={22} color={colors.white} />
        </Pressable>
        {/* Mixing the picked sound against the clip's own audio only makes
            sense for video — a photo has nothing to weigh it against. */}
        {soundEnabled && pickedSound && media.type === 'video' && (
          <Pressable style={styles.toolButton} onPress={() => setMixSheetVisible(true)}>
            <HugeiconsIcon icon={MusicNote02Icon} size={22} color={colors.white} />
          </Pressable>
        )}
      </View>

      <View style={styles.bottomActionRow}>
        {canAddToStory && (
          <Pressable
            style={[styles.storyButton, addingToStory && styles.storyButtonDisabled]}
            onPress={handleAddToStory}
            disabled={addingToStory}
            accessibilityLabel={t('addToStoryLabel')}
          >
            {addingToStory ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <HugeiconsIcon icon={UserStoryIcon} size={20} color={colors.white} />
            )}
          </Pressable>
        )}

        <Pressable
          style={[styles.nextButton, isSaving && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={isSaving}
        >
          <Text style={styles.nextButtonText}>{isSaving ? t('savingButton') : t('common:next')}</Text>
        </Pressable>
      </View>

      {isAddingText && (
        <TextToolEditor
          initialText={textOverlay?.text ?? ''}
          initialColor={textOverlay?.color ?? '#ffffff'}
          initialFont={textOverlay?.font ?? textToolFonts[0]}
          onCancel={() => setIsAddingText(false)}
          onConfirm={(text, color, font) => {
            setTextOverlay({ text, color, font });
            setIsAddingText(false);
          }}
        />
      )}

      <SoundPickerModal
        visible={pickerVisible}
        userId={userId}
        onClose={() => setPickerVisible(false)}
        onSelect={(sound) => {
          setPickedSound(sound);
          setPickerVisible(false);
          setAudioMode('both');
          setSoundVolume(DEFAULT_SOUND_VOLUME);
          setOriginalVolume(DEFAULT_ORIGINAL_VOLUME);
        }}
      />

      {pickedSound && (
        <AudioMixSheet
          visible={mixSheetVisible}
          soundName={pickedSound.name}
          audioMode={audioMode}
          soundVolume={soundVolume}
          originalVolume={originalVolume}
          onChangeMode={setAudioMode}
          onChangeSoundVolume={setSoundVolume}
          onChangeOriginalVolume={setOriginalVolume}
          onClose={() => setMixSheetVisible(false)}
        />
      )}

      <NativePopup
        visible={addedToStoryVisible}
        title={t('addedToStoryTitle')}
        message={t('addedToStoryMessage')}
        confirmLabel={t('addedToStoryConfirm')}
        showCancel={false}
        onClose={() => setAddedToStoryVisible(false)}
        onConfirm={() => {}}
      />
      <NativePopup
        visible={addToStoryError !== null}
        title={t('addToStoryErrorTitle')}
        message={addToStoryError ?? ''}
        confirmLabel={t('addToStoryErrorConfirm')}
        showCancel={false}
        onClose={() => setAddToStoryError(null)}
        onConfirm={() => {}}
      />

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  containerCentered: {
    justifyContent: 'center',
  },
  overlayCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Every floating control shares the same dark glass-chip treatment
  // (colors.buttonBackground, fully round, 40px) except the two 48px
  // bottom-right actions, which step up in size to read as the primary
  // pair of actions for finishing the edit.
  backButton: {
    position: 'absolute',
    top: 40,
    left: space.xl,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.buttonBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSoundButton: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: 200,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  addSoundButtonActive: {
    backgroundColor: colors.buttonBackground,
    borderColor: colors.white,
  },
  addSoundText: {
    flexShrink: 1,
    ...typography.footnote,
    fontFamily: 'Poppins_600SemiBold',
    color: colors.white,
  },
  toolbar: {
    position: 'absolute',
    top: 40,
    right: space.xl,
    gap: space.md,
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.buttonBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomActionRow: {
    position: 'absolute',
    bottom: 40,
    right: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  storyButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.buttonBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyButtonDisabled: {
    opacity: 0.6,
  },
  nextButton: {
    height: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.button,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: colors.black,
    ...typography.bodyBold,
    fontSize: 16,
  },
});
