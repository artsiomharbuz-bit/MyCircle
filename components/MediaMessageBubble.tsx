import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { PlayIcon } from '@hugeicons/core-free-icons';

const SIZE = 220;

// A picture or video sent in a chat. Tapping it hands off to `onOpen`, which
// shows it full screen (see MediaViewerModal).
export default function MediaMessageBubble({
  uri,
  type,
  onOpen,
}: {
  uri: string;
  type: 'photo' | 'video';
  onOpen: () => void;
}) {
  // Only a paused first frame as a thumbnail; playback happens full screen.
  const player = useVideoPlayer(type === 'video' ? { uri } : null, (p) => {
    p.muted = true;
  });

  return (
    <Pressable style={styles.media} onPress={onOpen} accessibilityRole="imagebutton">
      {type === 'photo' ? (
        <Image source={{ uri }} style={styles.fill} resizeMode="cover" />
      ) : (
        <>
          <VideoView
            style={styles.fill}
            player={player}
            nativeControls={false}
            contentFit="cover"
            pointerEvents="none"
          />
          <View style={styles.playOverlay} pointerEvents="none">
            <HugeiconsIcon icon={PlayIcon} size={34} color="#ffffff" fill="#ffffff" />
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  media: {
    width: SIZE,
    height: SIZE,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#00000022',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
