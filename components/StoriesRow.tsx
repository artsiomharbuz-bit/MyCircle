import { Image, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import Skeleton from './Skeleton';
import StoryRing from './StoryRing';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, space, typography } from '../theme';

const AVATAR_SIZE = 68;

type PersonSummary = {
  _id: string;
  name?: string;
  username?: string;
  avatarUrl: string | null;
  avatarGradient?: string[];
};

function Avatar({ person, colors }: { person: PersonSummary; colors: Colors }) {
  const letter = (person.username ?? person.name ?? '?').charAt(0).toUpperCase();
  const gradient = (person.avatarGradient as [string, string]) ?? [colors.red, colors.coral];
  const styles = createStyles(colors);

  return (
    <View style={styles.avatar}>
      {person.avatarUrl ? (
        <Image source={{ uri: person.avatarUrl }} style={styles.avatarImage} />
      ) : (
        <LinearGradient colors={gradient} style={styles.avatarGradient}>
          <Text style={styles.avatarLetter}>{letter}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

export default function StoriesRow({
  userId,
  onAddStory,
  onOpenStory,
}: {
  userId: Id<'users'>;
  onAddStory: () => void;
  onOpenStory: (authorId: Id<'users'>) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const me = useQuery(api.users.getUser, { userId });
  const groups = useQuery(api.stories.listActiveStoriesForViewer, { viewerId: userId });

  const myGroup = groups?.find((g) => g.author._id === userId);
  const others = groups?.filter((g) => g.author._id !== userId) ?? [];

  if (me === undefined || groups === undefined) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.item}>
            <View style={styles.skeletonRing}>
              <Skeleton style={styles.skeletonAvatar} />
            </View>
            <Skeleton style={styles.labelSkeleton} />
          </View>
        ))}
      </ScrollView>
    );
  }
  if (!me) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <AnimatedPressable onPress={() => (myGroup ? onOpenStory(userId) : onAddStory())}>
        <View style={styles.item}>
          <View style={styles.avatarWrap}>
            <StoryRing hasStory={!!myGroup} size={AVATAR_SIZE}>
              <Avatar person={{ ...me, _id: userId }} colors={colors} />
            </StoryRing>
            {!myGroup && (
              <View style={styles.plusBadge}>
                <HugeiconsIcon icon={PlusSignIcon} size={12} color={colors.black} />
              </View>
            )}
          </View>
          <Text style={styles.label} numberOfLines={1}>
            Your Story
          </Text>
        </View>
      </AnimatedPressable>

      {others.map((group) => (
        <AnimatedPressable
          key={group.author._id}
          onPress={() => onOpenStory(group.author._id as Id<'users'>)}
        >
          <View style={styles.item}>
            <StoryRing hasStory size={AVATAR_SIZE}>
              <Avatar person={group.author} colors={colors} />
            </StoryRing>
            <Text style={styles.label} numberOfLines={1}>
              {group.author.name ?? group.author.username ?? 'Someone'}
            </Text>
          </View>
        </AnimatedPressable>
      ))}
    </ScrollView>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      gap: space.md,
      paddingHorizontal: space.xl,
      paddingBottom: space.lg,
    },
    // ScrollView auto-applies flexDirection: 'row' to its contentContainerStyle
    // for horizontal scroll — needed explicitly here since the loading state
    // renders `row` on a plain View instead.
    rowStatic: {
      flexDirection: 'row',
    },
    labelSkeleton: {
      marginTop: 6,
      width: AVATAR_SIZE - 10,
      height: 11,
      borderRadius: 5,
    },
    skeletonRing: {
      width: AVATAR_SIZE + 2 * (3 + 3),
      height: AVATAR_SIZE + 2 * (3 + 3),
      borderRadius: (AVATAR_SIZE + 2 * (3 + 3)) / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skeletonAvatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
    },
    item: {
      width: AVATAR_SIZE + 12,
      alignItems: 'center',
    },
    avatarWrap: {
      position: 'relative',
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      overflow: 'hidden',
    },
    avatarGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImage: {
      flex: 1,
    },
    avatarLetter: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 20,
      color: '#ffffff',
    },
    plusBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.white,
      borderWidth: 2,
      borderColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      marginTop: 6,
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
