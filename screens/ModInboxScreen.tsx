import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  Flag02Icon,
  MusicNote02Icon,
  ShieldUserIcon,
} from '@hugeicons/core-free-icons';
import AnimatedPressable from '../components/AnimatedPressable';
import { HEADER_HEIGHT } from '../components/CollapsibleHeader';
import EmptyState from '../components/EmptyState';
import FadeInView from '../components/FadeInView';
import ReportReviewModal from '../components/ReportReviewModal';
import Skeleton from '../components/Skeleton';
import VerifiedBadge from '../components/VerifiedBadge';
import { useModGate } from '../components/ModGate';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { formatRelativeTime } from '../formatRelativeTime';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

// Every moderator's shared inbox. The same reports appear for all of them, so
// one moderator opening a report ("under investigation") or resolving it is
// reflected in everyone else's list the moment it happens.
export default function ModInboxScreen({
  userId,
  onBack,
  onOpenUser,
}: {
  userId: Id<'users'>;
  onBack: () => void;
  onOpenUser: (userId: Id<'users'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const { run, gate } = useModGate(userId);

  const reports = useQuery(api.moderation.listModInbox, { userId });
  const [openReportId, setOpenReportId] = useState<Id<'reports'> | null>(null);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {reports === undefined &&
          [0, 1, 2].map((i) => (
            <View key={i} style={styles.row}>
              <Skeleton style={styles.avatar} />
              <View style={styles.rowText}>
                <Skeleton style={styles.titleSkeleton} />
                <Skeleton style={styles.previewSkeleton} />
              </View>
            </View>
          ))}

        {reports && reports.length === 0 && (
          <EmptyState
            icon={CheckmarkCircle02Icon}
            message="Nothing to review. New reports from the community land here."
            style={styles.emptyState}
          />
        )}

        {reports?.map((report) => {
          const displayName =
            report.target?.name ?? report.target?.username ?? 'Someone';
          const letter = (report.target?.username ?? displayName).charAt(0).toUpperCase();
          const gradient = (report.target?.avatarGradient as [string, string]) ?? [
            colors.red,
            colors.coral,
          ];
          const investigating = report.status === 'investigating';

          return (
            <FadeInView key={report._id}>
              <AnimatedPressable
                onPress={() => run(() => setOpenReportId(report._id as Id<'reports'>))}
              >
                <View style={[styles.row, investigating && styles.rowInvestigating]}>
                  <View style={styles.avatarWrap}>
                    {report.postThumbUrl ? (
                      <Image source={{ uri: report.postThumbUrl }} style={styles.avatar} />
                    ) : report.kind === 'sound' && report.soundPictureUrl ? (
                      <Image source={{ uri: report.soundPictureUrl }} style={styles.avatar} />
                    ) : report.kind === 'sound' ? (
                      <View style={[styles.avatar, styles.center]}>
                        <HugeiconsIcon icon={MusicNote02Icon} size={20} color={colors.white} />
                      </View>
                    ) : report.target?.avatarUrl ? (
                      <Image
                        source={{ uri: report.target.avatarUrl }}
                        style={styles.avatar}
                      />
                    ) : (
                      <LinearGradient colors={gradient} style={[styles.avatar, styles.center]}>
                        <Text style={styles.avatarLetter}>{letter}</Text>
                      </LinearGradient>
                    )}
                    <View style={styles.kindBadge}>
                      <HugeiconsIcon
                        icon={
                          report.kind === 'profile'
                            ? ShieldUserIcon
                            : report.kind === 'sound'
                              ? MusicNote02Icon
                              : Flag02Icon
                        }
                        size={11}
                        color={colors.accentText}
                      />
                    </View>
                  </View>

                  <View style={styles.rowText}>
                    <View style={styles.titleLine}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {report.kind === 'profile'
                          ? 'Profile reported'
                          : report.kind === 'sound'
                            ? `Sound reported${report.soundName ? `: ${report.soundName}` : ''}`
                            : `${report.postKind === 'clip' ? 'Clip' : 'Post'} reported`}
                      </Text>
                      <Text style={styles.rowTime}>{formatRelativeTime(report.createdAt)}</Text>
                    </View>

                    <View style={styles.targetLine}>
                      <Text style={styles.rowTarget} numberOfLines={1}>
                        @{report.target?.username ?? 'unknown'}
                      </Text>
                      <VerifiedBadge verified={report.target?.isVerified} size={13} />
                    </View>

                    <Text style={styles.rowReason} numberOfLines={2}>
                      {report.reason}
                    </Text>

                    {investigating && (
                      <View style={styles.investigatingChip}>
                        <Text style={styles.investigatingText}>
                          Under investigation
                          {report.claimedByMe
                            ? ' · by you'
                            : report.claimedBy?.username
                              ? ` · @${report.claimedBy.username}`
                              : ''}
                        </Text>
                      </View>
                    )}

                    {report.postMissing && (
                      <Text style={styles.gone}>The reported post has already been deleted.</Text>
                    )}
                    {report.soundMissing && (
                      <Text style={styles.gone}>This sound has already been removed.</Text>
                    )}
                  </View>
                </View>
              </AnimatedPressable>
            </FadeInView>
          );
        })}
      </ScrollView>

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} accessibilityLabel="Go back">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>Reports</Text>
        {reports && reports.length > 0 && (
          <Text style={styles.count}>{reports.length}</Text>
        )}
      </View>

      <ReportReviewModal
        visible={openReportId !== null}
        reportId={openReportId}
        modId={userId}
        onClose={() => setOpenReportId(null)}
        onOpenUser={onOpenUser}
      />

      {gate}

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const AVATAR_SIZE = 54;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: HEADER_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.xl,
      paddingTop: space.xl,
      gap: space.md,
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      zIndex: 10,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      ...typography.h2,
      color: colors.white,
    },
    count: {
      ...typography.callout,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.textMuted,
    },
    list: {
      paddingHorizontal: space.lg,
      paddingTop: HEADER_HEIGHT + space.sm,
      paddingBottom: space.xxl,
      gap: space.xs,
    },
    emptyState: {
      marginTop: 70,
    },
    row: {
      flexDirection: 'row',
      gap: space.md,
      padding: space.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowInvestigating: {
      borderColor: colors.yellow,
    },
    avatarWrap: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: 16,
      backgroundColor: colors.buttonSecondary,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetter: {
      ...typography.h3,
      color: '#ffffff',
    },
    kindBadge: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      width: 21,
      height: 21,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.red,
      borderWidth: 2,
      borderColor: colors.inputBackground,
    },
    rowText: {
      flex: 1,
      gap: 3,
    },
    titleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
    },
    rowTitle: {
      flex: 1,
      ...typography.bodyBold,
      color: colors.white,
    },
    rowTime: {
      ...typography.caption,
      color: colors.textMuted,
    },
    targetLine: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rowTarget: {
      ...typography.footnote,
      color: colors.textMuted,
    },
    rowReason: {
      marginTop: 3,
      ...typography.footnote,
      lineHeight: 18,
      color: colors.white,
    },
    investigatingChip: {
      alignSelf: 'flex-start',
      marginTop: 7,
      paddingHorizontal: space.xs,
      paddingVertical: 5,
      borderRadius: radius.xs,
      backgroundColor: colors.yellow,
    },
    investigatingText: {
      ...typography.micro,
      color: '#111111',
    },
    titleSkeleton: {
      width: 150,
      height: 15,
      borderRadius: 7,
    },
    previewSkeleton: {
      marginTop: 8,
      width: '80%',
      height: 13,
      borderRadius: 6,
    },
    gone: {
      marginTop: 5,
      ...typography.caption,
      color: colors.errorText,
    },
  });
