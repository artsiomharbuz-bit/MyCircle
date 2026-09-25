import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  Delete02Icon,
  Flag02Icon,
  MusicNote02Icon,
  UserBlock01Icon,
} from '@hugeicons/core-free-icons';
import ConfirmActionModal from './ConfirmActionModal';
import PostTextOverlay from './PostTextOverlay';
import PrimaryButton from './PrimaryButton';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useModToken } from '../modSession';
import { formatRelativeTime } from '../formatRelativeTime';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

// A moderator's view of one report and nothing else: the reported post or
// clip on its own — no feed, no likes, no comments — or the written profile
// report with whatever evidence came with it.
//
// Opening this is what marks the report "under investigation" in every other
// moderator's inbox, and deleting or dismissing removes it from all of them.
export default function ReportReviewModal({
  visible,
  reportId,
  modId,
  onClose,
  onOpenUser,
}: {
  visible: boolean;
  reportId: Id<'reports'> | null;
  modId: Id<'users'>;
  onClose: () => void;
  onOpenUser: (userId: Id<'users'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const token = useModToken(modId);

  const report = useQuery(
    api.moderation.getReportForReview,
    visible && reportId && token ? { reportId, modId, token } : 'skip'
  );

  const claimReport = useMutation(api.moderation.claimReport);
  const deleteReportedPost = useMutation(api.moderation.deleteReportedPost);
  const deleteReportedSound = useMutation(api.moderation.deleteReportedSound);
  const dismissReport = useMutation(api.moderation.dismissReport);

  const [confirm, setConfirm] = useState<'delete' | 'dismiss' | null>(null);

  // Claiming on open is the whole point of the yellow label: other mods need
  // to see that someone already picked this up.
  useEffect(() => {
    if (!visible || !reportId || !token) return;
    claimReport({ reportId, modId, token }).catch(() => {});
  }, [visible, reportId, token]);

  const isVideo = report?.post?.mediaType === 'video';
  const player = useVideoPlayer(
    visible && isVideo && report?.post?.mediaUrl ? { uri: report.post.mediaUrl } : null,
    (p) => {
      p.loop = true;
      p.muted = false;
    }
  );

  useEffect(() => {
    if (visible && isVideo) player.play();
    else player.pause();
  }, [visible, isVideo, player]);

  const targetId = report?.targetUserId;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel="Go back">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {report?.kind === 'profile'
              ? 'Profile report'
              : report?.kind === 'sound'
                ? 'Sound report'
                : 'Reported content'}
          </Text>
          <View style={styles.investigatingChip}>
            <Text style={styles.investigatingText}>Under investigation</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {report === undefined && <Text style={styles.loading}>Loading report…</Text>}

          {report === null && (
            <Text style={styles.loading}>
              This report is no longer available — another moderator may have handled it.
            </Text>
          )}

          {report && (
            <>
              <View style={styles.reasonCard}>
                <View style={styles.reasonHead}>
                  <View style={styles.reasonIcon}>
                    <HugeiconsIcon icon={Flag02Icon} size={17} color={colors.accentText} />
                  </View>
                  <View style={styles.reasonHeadText}>
                    <Text style={styles.reasonLabel}>Reported reason</Text>
                    <Text style={styles.reasonMeta}>
                      {formatRelativeTime(report.createdAt)} ago · against{' '}
                      {report.target?.username ? `@${report.target.username}` : 'this account'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.reasonText}>{report.reason}</Text>
              </View>

              {report.postMissing && (
                <Text style={styles.missing}>
                  The reported post has already been deleted. Dismiss this report to clear it.
                </Text>
              )}

              {report.soundMissing && (
                <Text style={styles.missing}>
                  This sound has already been removed. Dismiss this report to clear it.
                </Text>
              )}

              {report.sound && (
                <View style={styles.soundCard}>
                  {report.sound.pictureUrl ? (
                    <Image source={{ uri: report.sound.pictureUrl }} style={styles.soundPicture} />
                  ) : (
                    <View style={styles.soundPictureFallback}>
                      <HugeiconsIcon icon={MusicNote02Icon} size={22} color={colors.white} />
                    </View>
                  )}
                  <View style={styles.soundText}>
                    <Text style={styles.postTitle} numberOfLines={1}>
                      {report.sound.name}
                    </Text>
                    <Text style={styles.postCaption}>
                      {report.sound.useCount} {report.sound.useCount === 1 ? 'use' : 'uses'} ·{' '}
                      {report.sound.isGlobal ? 'Public' : 'Private'}
                    </Text>
                  </View>
                </View>
              )}

              {report.post && (
                <View style={styles.mediaWrap}>
                  {report.post.mediaType === 'photo' ? (
                    report.post.mediaUrl && (
                      <Image
                        source={{ uri: report.post.mediaUrl }}
                        style={styles.media}
                        resizeMode="contain"
                      />
                    )
                  ) : (
                    <VideoView
                      style={styles.media}
                      player={player}
                      nativeControls={false}
                      contentFit="contain"
                    />
                  )}
                  {report.post.mediaType === 'video' && report.post.textOverlay && (
                    <PostTextOverlay overlay={report.post.textOverlay} />
                  )}
                </View>
              )}

              {report.post && (report.post.title || report.post.caption) && (
                <View style={styles.captionCard}>
                  {report.post.title && (
                    <Text style={styles.postTitle}>{report.post.title}</Text>
                  )}
                  {report.post.caption && (
                    <Text style={styles.postCaption}>{report.post.caption}</Text>
                  )}
                </View>
              )}

              {report.evidenceUrl && (
                <View style={styles.evidenceBlock}>
                  <Text style={styles.sectionLabel}>Evidence from the reporter</Text>
                  <Image
                    source={{ uri: report.evidenceUrl }}
                    style={styles.evidence}
                    resizeMode="contain"
                  />
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <PrimaryButton
            label="Go to profile"
            tone="ghost"
            disabled={!targetId}
            onPress={() => {
              if (!targetId) return;
              onClose();
              onOpenUser(targetId);
            }}
          />
          {report?.kind === 'post' && !report.postMissing && (
            <PrimaryButton
              label="Delete"
              tone="danger"
              onPress={() => setConfirm('delete')}
            />
          )}
          {report?.kind === 'sound' && !report.soundMissing && (
            <PrimaryButton
              label="Delete"
              tone="danger"
              onPress={() => setConfirm('delete')}
            />
          )}
          <PrimaryButton label="Dismiss" onPress={() => setConfirm('dismiss')} />
        </View>

        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      </View>

      <ConfirmActionModal
        visible={confirm === 'delete'}
        title={report?.kind === 'sound' ? 'Delete this sound?' : 'Delete this content?'}
        subtitle="It comes down for everyone, permanently."
        icon={Delete02Icon}
        consequences={
          report?.kind === 'sound'
            ? [
                'The sound is removed everywhere it appears.',
                'Every post or clip using it goes mute, and its label changes to "Deleted sound".',
                "The takedown is written to the sound owner's log with your name.",
                'The report disappears from every other moderator inbox.',
              ]
            : [
                'The post or clip and its media are deleted permanently.',
                'Every like, comment and bookmark on it goes too.',
                "The takedown is written to the author's log with your name.",
                'The report disappears from every other moderator inbox.',
              ]
        }
        confirmLabel="Delete it"
        onConfirm={async () => {
          if (!reportId || !token) return;
          if (report?.kind === 'sound') {
            await deleteReportedSound({ reportId, modId, token });
          } else {
            await deleteReportedPost({ reportId, modId, token });
          }
          onClose();
        }}
        onClose={() => setConfirm(null)}
      />

      <ConfirmActionModal
        visible={confirm === 'dismiss'}
        title="Dismiss this report?"
        subtitle="Nothing happens to the account or the content."
        icon={UserBlock01Icon}
        tone="primary"
        consequences={[
          'The content stays exactly as it is.',
          'The report disappears from every other moderator inbox.',
          "The dismissal is written to the account's log with your name.",
        ]}
        confirmLabel="Dismiss report"
        onConfirm={async () => {
          if (!reportId || !token) return;
          await dismissReport({ reportId, modId, token });
          onClose();
        }}
        onClose={() => setConfirm(null)}
      />
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 40,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.lg,
      paddingBottom: 14,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      ...typography.h3,
      color: colors.white,
    },
    investigatingChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 11,
      backgroundColor: colors.yellow,
    },
    investigatingText: {
      ...typography.micro,
      color: '#111111',
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: space.lg,
      paddingBottom: space.lg,
      gap: 18,
    },
    loading: {
      marginTop: 40,
      ...typography.callout,
      color: colors.textMuted,
      textAlign: 'center',
    },
    reasonCard: {
      padding: space.md,
      borderRadius: radius.lg,
      gap: space.sm,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reasonHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
    },
    reasonIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.red,
    },
    reasonHeadText: {
      flex: 1,
      gap: 2,
    },
    reasonLabel: {
      fontSize: 13,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: colors.textMuted,
    },
    reasonMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    reasonText: {
      ...typography.body,
      color: colors.white,
    },
    missing: {
      ...typography.footnote,
      lineHeight: 19,
      color: colors.errorText,
    },
    mediaWrap: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: '#000',
    },
    media: {
      ...StyleSheet.absoluteFill,
    },
    captionCard: {
      padding: space.md,
      borderRadius: radius.lg,
      gap: 7,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    postTitle: {
      fontSize: 18,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.white,
    },
    postCaption: {
      ...typography.callout,
      color: colors.textMuted,
    },
    soundCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    soundPicture: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.buttonSecondary,
    },
    soundPictureFallback: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonSecondary,
    },
    soundText: {
      flex: 1,
      gap: 4,
    },
    evidenceBlock: {
      gap: space.xs,
    },
    sectionLabel: {
      fontSize: 13,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    evidence: {
      width: '100%',
      height: 300,
      borderRadius: radius.lg,
      backgroundColor: '#000',
    },
    actions: {
      gap: space.xs,
      paddingHorizontal: space.lg,
      paddingTop: 14,
      paddingBottom: 30,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
