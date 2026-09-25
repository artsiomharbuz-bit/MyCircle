import { Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAppTheme } from '../ThemeContext';
import { Colors, space, typography } from '../theme';

export default function FollowCounts({
  posts,
  followers,
  following,
  onPressFollowers,
  onPressFollowing,
}: {
  // Optional — the profile screen's stat row leads with a post count; other
  // call sites can omit it and just show followers/following.
  posts?: number;
  followers: number;
  following: number;
  onPressFollowers: () => void;
  onPressFollowing: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.row}>
      {posts !== undefined && (
        <View style={styles.item}>
          <Text style={styles.count}>{posts}</Text>
          <Text style={styles.label}>Posts</Text>
        </View>
      )}

      <Pressable style={styles.item} onPress={onPressFollowers}>
        <Text style={styles.count}>{followers}</Text>
        <Text style={styles.label}>Followers</Text>
      </Pressable>

      <Pressable style={styles.item} onPress={onPressFollowing}>
        <Text style={styles.count}>{following}</Text>
        <Text style={styles.label}>Following</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: space.xl,
    },
    item: {
      alignItems: 'center',
    },
    count: {
      ...typography.h3,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.white,
    },
    label: {
      marginTop: 2,
      ...typography.footnote,
      color: colors.textMuted,
    },
  });
