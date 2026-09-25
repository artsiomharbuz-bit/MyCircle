import { Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAuthedMutation as useMutation } from '../SessionContext';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export type PollData = {
  question: string;
  options: { label: string; votes: number; percentage: number }[];
  totalVotes: number;
  myVote: number | null;
};

// Shown below a post's caption (see PostCard) and pinned above a clip's
// comment list (see CommentsPanel) — before voting it's a plain list of
// tappable options; once the viewer has voted (or is just looking at
// someone else's poll after voting), every option shows as a percentage
// bar instead, with the viewer's own pick highlighted.
export default function PollCard({
  poll,
  postId,
  viewerId,
}: {
  poll: PollData;
  postId: Id<'posts'>;
  viewerId: Id<'users'>;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const vote = useMutation(api.polls.vote);
  const hasVoted = poll.myVote !== null;

  return (
    <View style={styles.card}>
      <Text style={styles.question}>{poll.question}</Text>
      <View style={styles.options}>
        {poll.options.map((option, index) => {
          const isMine = poll.myVote === index;
          return (
            <Pressable
              key={index}
              style={styles.option}
              onPress={() => vote({ postId, userId: viewerId, optionIndex: index })}
            >
              {hasVoted && (
                <View
                  style={[
                    styles.fill,
                    { width: `${option.percentage}%` },
                    isMine && styles.fillMine,
                  ]}
                />
              )}
              <View style={styles.optionContent}>
                <Text style={[styles.optionLabel, isMine && styles.optionLabelMine]} numberOfLines={2}>
                  {option.label}
                </Text>
                {hasVoted && (
                  <Text style={[styles.optionPercentage, isMine && styles.optionLabelMine]}>
                    {option.percentage}%
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.voteCount}>
        {poll.totalVotes === 0
          ? 'No votes yet'
          : `${poll.totalVotes} ${poll.totalVotes === 1 ? 'vote' : 'votes'}`}
      </Text>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      gap: space.xs,
    },
    question: {
      ...typography.bodyBold,
      color: colors.white,
    },
    options: {
      gap: space.xs,
    },
    option: {
      minHeight: 44,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
    },
    fill: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.buttonSecondary,
    },
    fillMine: {
      backgroundColor: colors.coral,
      opacity: 0.35,
    },
    optionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.sm,
      paddingVertical: space.xs + 2,
      gap: space.sm,
    },
    optionLabel: {
      flex: 1,
      ...typography.calloutBold,
      color: colors.white,
    },
    optionLabelMine: {
      color: colors.coral,
    },
    optionPercentage: {
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.textMuted,
    },
    voteCount: {
      ...typography.caption,
      color: colors.textMuted,
    },
  });
