import { Image, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import Skeleton from './Skeleton';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, space, typography } from '../theme';

const AVATAR_SIZE = 68;
const RING_WIDTH = 2;
const RING_GAP = 2;

// Highlights are shown to anyone visiting the profile; only its owner sees
// the "+ New" bubble. There's no story-style gradient ring here on purpose —
// that ring means "active in the last 24h", which doesn't apply to a
// permanent shelf of saved media, so highlights get a plain, quiet border.
export default function HighlightsRow({
  userId,
  isSelf,
  onCreate,
  onOpenHighlight,
}: {
  userId: Id<'users'>;
  isSelf: boolean;
  onCreate: () => void;
  onOpenHighlight: (highlightId: Id<'highlights'>) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation('highlights');

  const highlights = useQuery(api.highlights.listHighlights, { userId });

  if (highlights === undefined) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.item}>
            <Skeleton style={styles.skeletonAvatar} />
          </View>
        ))}
      </ScrollView>
    );
  }

  if (highlights.length === 0 && !isSelf) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {isSelf && (
        <AnimatedPressable onPress={onCreate}>
          <View style={styles.item}>
            <View style={[styles.ring, styles.newRing]}>
              <View style={styles.newCircle}>
                <HugeiconsIcon icon={PlusSignIcon} size={22} color={colors.textMuted} />
              </View>
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {t('newButton')}
            </Text>
          </View>
        </AnimatedPressable>
      )}

      {highlights.map((highlight) => (
        <AnimatedPressable key={highlight._id} onPress={() => onOpenHighlight(highlight._id)}>
          <View style={styles.item}>
            <View style={styles.ring}>
              <View style={styles.avatar}>
                {highlight.coverUrl && (
                  <Image source={{ uri: highlight.coverUrl }} style={styles.avatarImage} />
                )}
              </View>
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {highlight.name}
            </Text>
          </View>
        </AnimatedPressable>
      ))}
    </ScrollView>
  );
}

const createStyles = (colors: Colors) => {
  const ringSize = AVATAR_SIZE + (RING_WIDTH + RING_GAP) * 2;
  return StyleSheet.create({
    row: {
      gap: space.md,
      paddingHorizontal: space.xl,
      paddingBottom: space.lg,
    },
    item: {
      width: AVATAR_SIZE + 12,
      alignItems: 'center',
    },
    skeletonAvatar: {
      width: ringSize,
      height: ringSize,
      borderRadius: ringSize / 2,
    },
    ring: {
      width: ringSize,
      height: ringSize,
      borderRadius: ringSize / 2,
      borderWidth: RING_WIDTH,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    newRing: {
      borderStyle: 'dashed',
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      overflow: 'hidden',
      backgroundColor: colors.inputBackground,
    },
    avatarImage: {
      flex: 1,
    },
    newCircle: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
    },
    label: {
      marginTop: 6,
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
};
