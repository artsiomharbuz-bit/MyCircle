import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Flag02Icon } from '@hugeicons/core-free-icons';
import ActionSheet, { SheetAction } from './ActionSheet';
import PostReportModal from './PostReportModal';
import VerifiedBadge from './VerifiedBadge';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

// The three-dot menu on an ad card/clip. The card itself only ever shows the
// advertiser's chosen persona (display name + avatar) — this is the one
// place the account that actually paid for the ad is always shown, to
// anyone, regardless of how the ad presents itself.
export default function AdOptionsSheet({
  visible,
  creator,
  postId,
  reporterId,
  postKind = 'post',
  onClose,
}: {
  visible: boolean;
  creator: {
    _id: Id<'users'>;
    name?: string;
    username?: string;
    avatarUrl: string | null;
    isVerified?: boolean;
  } | null;
  postId?: Id<'posts'>;
  reporterId?: Id<'users'>;
  postKind?: 'post' | 'clip';
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [reportOpen, setReportOpen] = useState(false);

  const letter = (creator?.username ?? creator?.name ?? '?').charAt(0).toUpperCase();

  const actions: SheetAction[] =
    postId && reporterId
      ? [
          {
            key: 'report',
            label: 'Report this ad',
            description: 'Tell moderators something is wrong with this ad',
            icon: Flag02Icon,
            tone: 'danger',
            onPress: () => {
              onClose();
              setReportOpen(true);
            },
          },
        ]
      : [];

  return (
    <>
      <ActionSheet visible={visible} title="Ad options" actions={actions} onClose={onClose}>
        <View style={styles.advertiserCard}>
          <Text style={styles.advertiserLabel}>Advertised by</Text>
          <View style={styles.advertiserRow}>
            <View style={styles.avatar}>
              {creator?.avatarUrl ? (
                <Image source={{ uri: creator.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={[colors.red, colors.coral]} style={styles.avatarGradient}>
                  <Text style={styles.avatarLetter}>{letter}</Text>
                </LinearGradient>
              )}
            </View>
            <View style={styles.advertiserText}>
              <View style={styles.advertiserNameRow}>
                <Text style={styles.advertiserName}>
                  {creator?.username ? `@${creator.username}` : 'Unknown account'}
                </Text>
                <VerifiedBadge verified={creator?.isVerified} size={14} />
              </View>
              {creator?.name && <Text style={styles.advertiserSubname}>{creator.name}</Text>}
            </View>
          </View>
        </View>
      </ActionSheet>

      {postId && reporterId && (
        <PostReportModal
          visible={reportOpen}
          postId={postId}
          postKind={postKind}
          reporterId={reporterId}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    advertiserCard: {
      marginTop: space.xxs,
      padding: space.sm + 2,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    advertiserLabel: {
      ...typography.caption,
      fontFamily: 'Poppins_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textMuted,
      marginBottom: space.sm - 2,
    },
    advertiserRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: colors.border,
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
      fontSize: 15,
      color: '#ffffff',
    },
    advertiserText: {
      flex: 1,
      gap: 2,
    },
    advertiserNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    advertiserName: {
      ...typography.bodyBold,
      color: colors.white,
    },
    advertiserSubname: {
      ...typography.footnote,
      color: colors.textMuted,
    },
  });
