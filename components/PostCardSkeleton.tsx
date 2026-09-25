import { StyleSheet, View } from 'react-native';
import Skeleton from './Skeleton';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space } from '../theme';

const AVATAR_SIZE = 40;

// Mirrors PostCard.tsx's exact layout (card padding/radius, avatar size,
// media aspect ratio, action row) so the feed doesn't visibly reflow the
// instant real content arrives.
export default function PostCardSkeleton() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Skeleton style={styles.avatar} />
        <Skeleton style={styles.authorName} />
      </View>

      <Skeleton style={styles.media} />

      <View style={styles.actions}>
        <Skeleton style={styles.actionIcon} />
        <Skeleton style={styles.actionIcon} />
        <Skeleton style={styles.actionIcon} />
        <Skeleton style={styles.bookmarkIcon} />
      </View>

      <Skeleton style={styles.captionLine} />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      marginHorizontal: space.md,
      marginBottom: space.lg,
      padding: space.md,
      borderRadius: radius.xl,
      backgroundColor: colors.inputBackground,
      gap: space.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
    },
    authorName: {
      width: 120,
      height: 15,
      borderRadius: 7,
    },
    media: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderRadius: radius.md,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.lg,
    },
    actionIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
    },
    bookmarkIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
      marginLeft: 'auto',
    },
    captionLine: {
      width: '70%',
      height: 14,
      borderRadius: 7,
    },
  });
