import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Cancel01Icon,
  CameraRotated01Icon,
  FlashIcon,
  FlashOffIcon,
  Image02Icon,
} from '@hugeicons/core-free-icons';
// Deliberately not theme-reactive — the camera preview is always dark, like
// a native camera app, regardless of the app's own light/dark setting.
import { mediaColors as colors, radius, space, typography } from '../theme';

const HOLD_THRESHOLD = 300;

const CONTENT_TYPES = ['Post', 'Story', 'Clip'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export type CapturedMedia = {
  uri: string;
  type: 'photo' | 'video';
  // Width / height of the camera preview this was shot in. The editor shows
  // the media in a box of the same shape so it looks exactly like it did in
  // the viewfinder (instead of being blown up to fill the whole screen).
  previewAspect?: number;
};
// Max pictures in one swipeable post.
export const MAX_POST_PHOTOS = 10;
export type PostKind = 'post' | 'clip' | 'story';

export default function CameraScreen({
  initialContentType = 'Post',
  onClose,
  onCaptured,
}: {
  initialContentType?: ContentType;
  onClose: () => void;
  // `extras` are additional pictures picked together with the first (posts
  // only — a clip or a video is always a single item).
  onCaptured: (media: CapturedMedia, kind: PostKind, extras?: CapturedMedia[]) => void;
}) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const [contentType, setContentType] = useState<ContentType>(initialContentType);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torchOn, setTorchOn] = useState(false);
  const [previewAspect, setPreviewAspect] = useState<number | undefined>(undefined);

  const permissionsGranted = cameraPermission?.granted && micPermission?.granted;

  const kindForContentType = (): PostKind => {
    if (contentType === 'Clip') return 'clip';
    if (contentType === 'Story') return 'story';
    return 'post';
  };

  const takePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      if (photo?.uri) {
        onCaptured({ uri: photo.uri, type: 'photo', previewAspect }, kindForContentType());
      }
    } catch (err) {
      console.log('Failed to take photo', err);
    }
  };

  const startRecording = () => {
    setMode('video');
    // give the camera a beat to switch into video mode before we start recording
    setTimeout(async () => {
      setIsRecording(true);
      try {
        const video = await cameraRef.current?.recordAsync();
        if (video?.uri) {
          onCaptured({ uri: video.uri, type: 'video', previewAspect }, kindForContentType());
        }
      } catch (err) {
        console.log('Failed to record video', err);
      } finally {
        setIsRecording(false);
        setMode('picture');
      }
    }, 100);
  };

  const isClip = contentType === 'Clip';

  // Clips are video-only, so there's no press-vs-hold distinction to make —
  // any press starts recording immediately, same as holding does for a
  // post/story, and there's no tap-for-a-photo shortcut to fall back to.
  const handlePressIn = () => {
    if (isClip) {
      startRecording();
      return;
    }
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      startRecording();
    }, HOLD_THRESHOLD);
  };

  const handlePressOut = () => {
    if (isClip) {
      if (isRecording) cameraRef.current?.stopRecording();
      return;
    }
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      takePhoto();
      return;
    }
    if (isRecording) {
      cameraRef.current?.stopRecording();
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: isClip ? ['videos'] : ['images', 'videos'],
      // Several pictures make one swipeable post. Clips are single videos,
      // and a selection containing a video is treated as just that video.
      allowsMultipleSelection: !isClip,
      selectionLimit: isClip ? 1 : MAX_POST_PHOTOS,
      quality: 0.8,
    });

    if (!result.canceled) {
      const assets = result.assets;
      const allPhotos = assets.every((a) => a.type !== 'video');
      const chosen = allPhotos ? assets : [assets.find((a) => a.type === 'video') ?? assets[0]];
      const [first, ...rest] = chosen;
      onCaptured(
        { uri: first.uri, type: first.type === 'video' ? 'video' : 'photo' },
        kindForContentType(),
        rest.map((a) => ({ uri: a.uri, type: 'photo' as const }))
      );
    }
  };

  if (!permissionsGranted) {
    return (
      <View style={styles.permissionContainer}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.white} />
        </Pressable>

        <Text style={styles.permissionText}>
          MyCircle needs access to your camera and microphone.
        </Text>

        <Pressable
          style={styles.permissionButton}
          onPress={async () => {
            await requestCameraPermission();
            await requestMicPermission();
          }}
        >
          <Text style={styles.permissionButtonText}>Grant Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.closeButton} onPress={onClose}>
        <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.white} />
      </Pressable>

      {facing === 'back' && (
        <Pressable style={styles.flashButton} onPress={() => setTorchOn((on) => !on)}>
          <HugeiconsIcon
            icon={torchOn ? FlashIcon : FlashOffIcon}
            size={20}
            color={colors.white}
          />
        </Pressable>
      )}

      <View
        style={styles.previewWrap}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) setPreviewAspect(width / height);
        }}
      >
        <CameraView
          ref={cameraRef}
          style={styles.preview}
          facing={facing}
          enableTorch={torchOn && facing === 'back'}
          mode={mode}
          videoQuality="1080p"
        />
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.galleryButton} onPress={pickFromLibrary}>
          <HugeiconsIcon icon={Image02Icon} size={22} color={colors.white} />
        </Pressable>

        <Pressable
          style={[styles.captureButton, isRecording && styles.captureButtonRecording]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View style={[styles.captureInner, isRecording && styles.captureInnerRecording]} />
        </Pressable>

        <Pressable
          style={styles.flipButton}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
        >
          <HugeiconsIcon icon={CameraRotated01Icon} size={22} color={colors.white} />
        </Pressable>
      </View>

      {isClip && !isRecording && (
        <Text style={styles.clipHint}>Hold to record, or import a video from your gallery.</Text>
      )}

      <ScrollView
        horizontal
        style={styles.contentTypeScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.contentTypeRow}
      >
        {CONTENT_TYPES.map((type) => (
          <Pressable key={type} onPress={() => setContentType(type)} style={styles.contentTypeItem}>
            <Text
              style={[
                styles.contentTypeText,
                type === contentType && styles.contentTypeTextActive,
              ]}
            >
              {type.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // The two top-corner controls and the two flanking bottom controls all use
  // the same dark glass-chip treatment (colors.buttonBackground, fully round)
  // so every floating control over the preview reads as one family.
  closeButton: {
    position: 'absolute',
    top: 40,
    left: space.xl,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.buttonBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashButton: {
    position: 'absolute',
    top: 40,
    right: space.xl,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.buttonBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewWrap: {
    flex: 1,
    marginTop: 100,
    marginHorizontal: space.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  preview: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xxl,
    paddingVertical: space.xxl,
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.buttonBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.buttonBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonRecording: {
    borderColor: colors.red,
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
  },
  captureInnerRecording: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.red,
  },
  clipHint: {
    marginTop: -12,
    marginBottom: space.sm,
    paddingHorizontal: space.xxl,
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  contentTypeScroll: {
    flexGrow: 0,
    height: 56,
  },
  contentTypeRow: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingHorizontal: space.xxl,
  },
  contentTypeItem: {
    paddingVertical: 4,
  },
  contentTypeText: {
    ...typography.footnote,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.5)',
  },
  contentTypeTextActive: {
    color: colors.white,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
  },
  permissionText: {
    ...typography.body,
    color: colors.white,
    textAlign: 'center',
    marginBottom: space.xl,
  },
  permissionButton: {
    height: 52,
    paddingHorizontal: space.xl,
    borderRadius: radius.button,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    color: colors.black,
    ...typography.bodyBold,
  },
});
