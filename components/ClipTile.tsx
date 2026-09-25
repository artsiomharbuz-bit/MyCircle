import { Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useVideoPlayer, VideoView } from 'expo-video';
// Deliberately not theme-reactive: this overlay always sits on top of video
// media (unknown brightness), so it always uses the same white-on-dark-scrim
// treatment regardless of the app's own light/dark setting — same as Reels.
import { mediaColors as colors, radius, space, typography } from '../theme';
import AiLabel from './AiLabel';
import { CircleLabelData } from './CircleLabel';
import { FriendLiker } from './FriendLikers';
import { PollData } from './PollCard';
import { PostTextOverlayData } from './PostTextOverlay';

const TILE_WIDTH = 116;
const TILE_HEIGHT = 190;

export type ClipPost = {
  _id: string;
  title?: string;
  caption?: string;
  mediaType: 'photo' | 'video';
  audience?: 'circles' | 'global';
  circleLabels?: CircleLabelData[];
  mediaUrl: string | null;
  containsAi?: boolean;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  friendLikers?: FriendLiker[];
  author: {
    _id: string;
    name?: string;
    username?: string;
    avatarUrl: string | null;
    avatarGradient?: string[];
    isVerified?: boolean;
  } | null;
  textOverlay?: PostTextOverlayData;
  sound?: { _id: string; name: string; isDeleted: boolean; audioUrl: string | null } | null;
  soundVolume?: number;
  originalVolume?: number;
  audioMode?: 'sound-only' | 'both';
  hashtags?: string[];
  poll?: PollData | null;
  expiresAt?: number | null;
  remixColor?: string | null;
  remixOf?: {
    postId: string;
    authorUsername: string | null;
    authorAvatarUrl?: string | null;
    authorAvatarGradient?: string[] | null;
  } | null;
};

export default function ClipTile({ post, onPress }: { post: ClipPost; onPress: () => void }) {
  const player = useVideoPlayer(post.mediaUrl ? { uri: post.mediaUrl } : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const displayName = post.author?.name ?? post.author?.username ?? 'Someone';

  return (
    <Pressable style={styles.tile} onPress={onPress} accessibilityRole="button">
      {post.mediaUrl && (
        // surfaceType="textureView" — the default SurfaceView composites in
        // its own hardware layer above everything else on Android and can
        // swallow touches meant for this tile's own Pressable regardless of
        // pointerEvents/z-order; textureView is a normal view that doesn't
        // have that problem (same reasoning as ClipsScreen's full player).
        // pointerEvents="none" on top of that so the tap unambiguously goes
        // to the Pressable either way.
        <View style={styles.media} pointerEvents="none">
          <VideoView
            style={StyleSheet.absoluteFill}
            player={player}
            nativeControls={false}
            contentFit="cover"
            surfaceType="textureView"
            pointerEvents="none"
          />
        </View>
      )}

      {post.containsAi && (
        <View style={styles.aiBadge}>
          <AiLabel visible onDark />
        </View>
      )}

      <Text style={styles.author} numberOfLines={1}>
        {displayName}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    // Pure-black letterboxing behind the video, not app chrome — stays fixed
    // regardless of theme.
    backgroundColor: '#111',
  },
  media: {
    ...StyleSheet.absoluteFill,
  },
  aiBadge: {
    position: 'absolute',
    top: space.xs,
    left: space.xs,
  },
  author: {
    position: 'absolute',
    left: space.xs,
    right: space.xs,
    bottom: space.xs,
    ...typography.caption,
    fontFamily: 'Poppins_600SemiBold',
    color: colors.white,
  },
});
