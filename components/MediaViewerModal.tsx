import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';

export type ViewerMedia = { uri: string; type: 'photo' | 'video' };

function ViewerVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView style={styles.media} player={player} nativeControls contentFit="contain" />;
}

// Full-screen viewer for a picture or video tapped in a chat. Always dark,
// independent of the app theme.
export default function MediaViewerModal({
  media,
  onClose,
}: {
  media: ViewerMedia | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={media !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {media?.type === 'photo' && (
          <Pressable style={styles.fill} onPress={onClose}>
            <Image source={{ uri: media.uri }} style={styles.media} resizeMode="contain" />
          </Pressable>
        )}
        {media?.type === 'video' && <ViewerVideo uri={media.uri} />}

        <Pressable
          style={styles.close}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={26} color="#ffffff" />
        </Pressable>
        <StatusBar style="light" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  close: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
