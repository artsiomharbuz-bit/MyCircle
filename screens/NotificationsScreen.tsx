import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Alert02Icon,
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Comment01Icon,
  FavouriteIcon,
  Flag02Icon,
  LegalHammerIcon,
  Megaphone01Icon,
  Notification01Icon,
  PlayIcon,
} from '@hugeicons/core-free-icons';
import AdReviewModal from '../components/AdReviewModal';
import AnimatedPressable from '../components/AnimatedPressable';
import ReportReviewModal from '../components/ReportReviewModal';
import VerifiedBadge from '../components/VerifiedBadge';
import { HEADER_HEIGHT } from '../components/CollapsibleHeader';
import EmptyState from '../components/EmptyState';
import FadeInView from '../components/FadeInView';
import FollowButton from '../components/FollowButton';
import Skeleton from '../components/Skeleton';
import { useModGate } from '../components/ModGate';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { AD_KIND_LABEL } from '../adPricing';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';
import { formatRelativeTime } from '../formatRelativeTime';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function NotificationsScreen({
  userId,
  onBack,
  onOpenUser,
  onOpenAds,
}: {
  userId: Id<'users'>;
  onBack: () => void;
  onOpenUser: (userId: Id<'users'>) => void;
  onOpenAds: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);

  const notifications = useQuery(api.notifications.listNotifications, { userId });
  const followingIds = useQuery(api.follows.getFollowingIds, { followerId: userId });
  const follow = useMutation(api.follows.follow);
  const unfollow = useMutation(api.follows.unfollow);
  const clearNotifications = useMutation(api.notifications.clearNotifications);
  const markNotificationsSeen = useMutation(api.notifications.markNotificationsSeen);

  // Live, mod-only queues — Convex queries are already reactive, so a report
  // getting resolved or an ad getting approved/rejected by ANY moderator
  // makes the row disappear here immediately, no polling needed.
  const modStatus = useQuery(api.moderation.getModStatus, { userId });
  const pendingReports = useQuery(
    api.moderation.listModInbox,
    modStatus?.isMod ? { userId } : 'skip'
  );
  const pendingAds = useQuery(
    api.ads.listPendingAds,
    modStatus?.isMod ? { modId: userId } : 'skip'
  );
  const { run, gate } = useModGate(userId);
  const [openReportId, setOpenReportId] = useState<Id<'reports'> | null>(null);
  const [openAdId, setOpenAdId] = useState<Id<'ads'> | null>(null);

  useEffect(() => {
    markNotificationsSeen({ userId });
  }, [userId]);

  const toggleFollow = (targetId: Id<'users'>, isFollowing: boolean) => {
    if (isFollowing) {
      unfollow({ followerId: userId, followingId: targetId });
    } else {
      follow({ followerId: userId, followingId: targetId });
    }
  };

  const now = Date.now();
  const newNotifications = notifications?.filter((n) => now - n.createdAt < DAY_MS);
  const earlierNotifications = notifications?.filter((n) => now - n.createdAt >= DAY_MS);

  const renderRow = (notif: NonNullable<typeof notifications>[number]) => {
    if (notif.type === 'ad_status') {
      const approved = notif.status === 'approved';
      return (
        <FadeInView key={`ad-status-${notif._id}`}>
          <AnimatedPressable onPress={onOpenAds}>
            <View style={styles.row}>
              <View style={[styles.systemAvatar, !approved && styles.systemAvatarStrike]}>
                <HugeiconsIcon
                  icon={approved ? CheckmarkCircle01Icon : Megaphone01Icon}
                  size={20}
                  color={colors.accentText}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLine}>
                  <Text style={styles.rowName}>
                    {approved ? 'Your ad was approved' : 'Your ad was rejected'}
                  </Text>
                  {!approved && notif.message && (
                    <Text style={styles.rowAction}> — {notif.message}</Text>
                  )}
                  {approved && <Text style={styles.rowAction}> — pay to launch it whenever you're ready.</Text>}
                </Text>
                <Text style={styles.rowTime}>{formatRelativeTime(notif.createdAt)}</Text>
              </View>
            </View>
          </AnimatedPressable>
        </FadeInView>
      );
    }

    // Warnings and strikes come from the moderation team rather than another
    // user, so they have no avatar to show and nowhere to navigate to.
    if (notif.type === 'moderation') {
      const isStrike = notif.alertType === 'strike';
      return (
        <FadeInView key={`moderation-${notif._id}`}>
          <View style={styles.row}>
            <View style={[styles.systemAvatar, isStrike && styles.systemAvatarStrike]}>
              <HugeiconsIcon
                icon={isStrike ? LegalHammerIcon : Alert02Icon}
                size={20}
                color={colors.accentText}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLine}>
                <Text style={styles.rowName}>
                  {isStrike ? 'You received a strike' : 'You received a warning'}
                </Text>
                <Text style={styles.rowAction}> — {notif.message}</Text>
              </Text>
              <Text style={styles.rowTime}>{formatRelativeTime(notif.createdAt)}</Text>
            </View>
          </View>
        </FadeInView>
      );
    }

    const letter = (notif.fromUser.username ?? '?').charAt(0).toUpperCase();
    const gradient = (notif.fromUser.avatarGradient as [string, string]) ?? [
      colors.red,
      colors.coral,
    ];
    const isFollowing = followingIds?.includes(notif.fromUser._id as Id<'users'>) ?? false;
    const displayName = notif.fromUser.name ?? notif.fromUser.username ?? 'Someone';

    return (
      <FadeInView key={`${notif.type}-${notif._id}`}>
        <AnimatedPressable onPress={() => onOpenUser(notif.fromUser._id as Id<'users'>)}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              {notif.fromUser.avatarUrl ? (
                <Image source={{ uri: notif.fromUser.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={gradient} style={styles.avatarGradient}>
                  <Text style={styles.avatarLetter}>{letter}</Text>
                </LinearGradient>
              )}
              {notif.type === 'like' && (
                <View style={styles.badge}>
                  <HugeiconsIcon icon={FavouriteIcon} size={11} color="#ffffff" fill={colors.red} />
                </View>
              )}
              {notif.type === 'comment' && (
                <View style={styles.badge}>
                  <HugeiconsIcon
                    icon={Comment01Icon}
                    size={11}
                    color={colors.white}
                    fill={colors.white}
                  />
                </View>
              )}
            </View>

            <View style={styles.rowText}>
              <Text style={styles.rowLine}>
                <Text style={styles.rowName}>{displayName}</Text>
                {notif.fromUser.isVerified && <VerifiedBadge verified size={13} />}
                <Text style={styles.rowAction}>
                  {notif.type === 'follow' && ' started following you.'}
                  {notif.type === 'like' && ' liked your post.'}
                  {notif.type === 'comment' && ` commented: "${notif.commentText}"`}
                </Text>
              </Text>
              <Text style={styles.rowTime}>{formatRelativeTime(notif.createdAt)}</Text>
            </View>

            {notif.type === 'follow' ? (
              !isFollowing && (
                <FollowButton
                  following={false}
                  onPress={() => toggleFollow(notif.fromUser._id as Id<'users'>, false)}
                />
              )
            ) : (
              <View style={styles.thumb}>
                {notif.postMediaUrl && (
                  <Image source={{ uri: notif.postMediaUrl }} style={styles.thumbImage} />
                )}
                {!notif.postMediaUrl && (
                  <HugeiconsIcon icon={PlayIcon} size={16} color={colors.textMuted} />
                )}
              </View>
            )}
          </View>
        </AnimatedPressable>
      </FadeInView>
    );
  };

  const pendingCount = (pendingReports?.length ?? 0) + (pendingAds?.length ?? 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {modStatus?.isMod && pendingCount > 0 && (
          <View style={styles.section}>
            <View style={styles.queueTitleRow}>
              <Text style={styles.queueSectionTitle}>Pending review</Text>
              <View style={styles.queueCount}>
                <Text style={styles.queueCountText}>{pendingCount}</Text>
              </View>
            </View>

            {pendingReports?.map((report) => (
              <FadeInView key={`report-${report._id}`}>
                <AnimatedPressable
                  onPress={() => run(() => setOpenReportId(report._id as Id<'reports'>))}
                >
                  <View style={styles.row}>
                    <View style={[styles.systemAvatar, styles.systemAvatarStrike]}>
                      <HugeiconsIcon icon={Flag02Icon} size={20} color={colors.accentText} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowLine}>
                        <Text style={styles.rowName}>
                          {report.kind === 'profile'
                            ? 'Profile reported'
                            : report.kind === 'sound'
                              ? 'Sound reported'
                              : `${report.postKind === 'clip' ? 'Clip' : 'Post'} reported`}
                        </Text>
                        <Text style={styles.rowAction}>
                          {' '}
                          — @{report.target?.username ?? 'unknown'}: "{report.reason}"
                        </Text>
                      </Text>
                      <Text style={styles.rowTime}>{formatRelativeTime(report.createdAt)}</Text>
                    </View>
                  </View>
                </AnimatedPressable>
              </FadeInView>
            ))}

            {pendingAds?.map((ad) => (
              <FadeInView key={`ad-${ad._id}`}>
                <AnimatedPressable onPress={() => run(() => setOpenAdId(ad._id as Id<'ads'>))}>
                  <View style={styles.row}>
                    <View style={styles.systemAvatar}>
                      <HugeiconsIcon icon={Megaphone01Icon} size={20} color={colors.accentText} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowLine}>
                        <Text style={styles.rowName}>{AD_KIND_LABEL[ad.kind]} review</Text>
                        <Text style={styles.rowAction}>
                          {' '}
                          — {ad.displayName} by @{ad.creator?.username ?? 'unknown'}
                        </Text>
                      </Text>
                      <Text style={styles.rowTime}>{formatRelativeTime(ad.createdAt)}</Text>
                    </View>
                  </View>
                </AnimatedPressable>
              </FadeInView>
            ))}
          </View>
        )}

        {notifications === undefined && (
          <View style={styles.section}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.row}>
                <Skeleton style={styles.avatar} />
                <View style={styles.rowText}>
                  <Skeleton style={styles.rowLineSkeleton} />
                  <Skeleton style={styles.rowTimeSkeleton} />
                </View>
              </View>
            ))}
          </View>
        )}

        {newNotifications && newNotifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>New</Text>
            {newNotifications.map(renderRow)}
          </View>
        )}

        {earlierNotifications && earlierNotifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Earlier</Text>
            {earlierNotifications.map(renderRow)}
          </View>
        )}

        {notifications && notifications.length === 0 && (
          <EmptyState
            icon={Notification01Icon}
            message="No notifications yet. Likes, comments, and new followers will show up here."
            style={styles.emptyState}
          />
        )}
      </ScrollView>

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>

        {notifications && notifications.length > 0 && (
          <Pressable
            style={styles.clearButton}
            onPress={() => clearNotifications({ userId })}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        )}
      </View>

      <ReportReviewModal
        visible={openReportId !== null}
        reportId={openReportId}
        modId={userId}
        onClose={() => setOpenReportId(null)}
        onOpenUser={onOpenUser}
      />
      <AdReviewModal
        visible={openAdId !== null}
        adId={openAdId}
        modId={userId}
        onClose={() => setOpenAdId(null)}
        onOpenUser={onOpenUser}
      />
      {gate}

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

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
      overflow: 'hidden',
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
      fontFamily: 'Poppins_600SemiBold',
      fontSize: typography.h2.fontSize,
      color: colors.white,
    },
    clearButton: {
      paddingVertical: space.xs,
      paddingHorizontal: space.xxs,
    },
    clearButtonText: {
      fontSize: typography.calloutBold.fontSize,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '600',
      color: colors.textMuted,
    },
    list: {
      paddingHorizontal: space.xl,
      paddingTop: HEADER_HEIGHT + space.md,
      paddingBottom: space.xl,
    },
    section: {
      marginBottom: space.xl,
    },
    sectionTitle: {
      fontSize: typography.footnote.fontSize,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: space.sm,
    },
    queueTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      marginBottom: space.sm,
    },
    queueSectionTitle: {
      fontSize: typography.footnote.fontSize,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    queueCount: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.red,
    },
    queueCountText: {
      fontSize: typography.micro.fontSize,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      color: colors.accentText,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      marginBottom: space.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    avatarGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    systemAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.yellow,
    },
    systemAvatarStrike: {
      backgroundColor: colors.red,
    },
    avatarImage: {
      flex: 1,
    },
    avatarLetter: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 17,
      color: '#ffffff',
    },
    badge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    rowText: {
      flex: 1,
    },
    rowLineSkeleton: {
      width: '70%',
      height: 14,
      borderRadius: 7,
    },
    rowTimeSkeleton: {
      marginTop: 6,
      width: 40,
      height: 12,
      borderRadius: 6,
    },
    rowLine: {
      fontSize: typography.callout.fontSize,
      lineHeight: typography.callout.lineHeight,
    },
    rowName: {
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      color: colors.white,
    },
    rowAction: {
      color: colors.white,
    },
    rowTime: {
      marginTop: 2,
      fontSize: typography.footnote.fontSize,
      color: colors.textMuted,
    },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: colors.buttonBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
    emptyState: {
      marginTop: 60,
    },
  });
