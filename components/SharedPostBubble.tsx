import { Image, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { PlayIcon } from '@hugeicons/core-free-icons';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export default function SharedPostBubble({
  postId,
  viewerId,
  isMine,
}: {
  postId: Id<'posts'>;
  viewerId: Id<'users'>;
  isMine: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const post = useQuery(api.posts.getPost, { postId, viewerId });

  if (post === undefined) {
    return <View style={[styles.card, isMine && styles.cardMine]} />;
  }

  if (post === null) {
    return (
      <View style={[styles.card, isMine && styles.cardMine]}>
        <Text style={[styles.unavailable, isMine && styles.textMine]}>Post unavailable</Text>
      </View>
    );
  }

  const displayName = post.author?.name ?? post.author?.username ?? 'Someone';

  return (
    <View style={[styles.card, isMine && styles.cardMine]}>
      <View style={styles.thumb}>
        {post.mediaUrl && <Image source={{ uri: post.mediaUrl }} style={styles.thumbImage} />}
        {post.mediaType === 'video' && (
          <View style={styles.playBadge}>
            <HugeiconsIcon icon={PlayIcon} size={12} color="#ffffff" />
          </View>
        )}
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardLabel, isMine && styles.textMine]}>
          {post.kind === 'clip' ? 'Clip' : 'Post'} from {displayName}
        </Text>
        {post.caption && (
          <Text style={[styles.cardCaption, isMine && styles.textMine]} numberOfLines={2}>
            {post.caption}
          </Text>
        )}
      </View>
    </View>
  );
}

const THUMB_SIZE = 56;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      maxWidth: '78%',
      padding: space.xs,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderBottomLeftRadius: 6,
    },
    cardMine: {
      backgroundColor: colors.white,
      alignSelf: 'flex-end',
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: 6,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: radius.sm,
      overflow: 'hidden',
      backgroundColor: '#111',
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
    playBadge: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    cardText: {
      flex: 1,
      paddingRight: 6,
    },
    cardLabel: {
      ...typography.calloutBold,
      color: colors.white,
    },
    cardCaption: {
      marginTop: 2,
      ...typography.caption,
      color: colors.textMuted,
    },
    unavailable: {
      ...typography.footnote,
      color: colors.textMuted,
      padding: space.xxs,
    },
    textMine: {
      color: colors.black,
    },
  });
