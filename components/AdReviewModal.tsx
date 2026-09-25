import AppTextInput from './AppTextInput';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from './AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, Flag02Icon } from '@hugeicons/core-free-icons';
import FormModal from './FormModal';
import PrimaryButton from './PrimaryButton';
import VerifiedBadge from './VerifiedBadge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useModToken } from '../modSession';
import { readableError } from '../errorMessage';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

// A moderator's view of one pending ad: how it will actually render (the
// advertiser's chosen persona), plus who they really are underneath it, side
// by side — so a reviewer can judge both the creative and the account behind
// it before approving.
export default function AdReviewModal({
  visible,
  adId,
  modId,
  onClose,
  onOpenUser,
}: {
  visible: boolean;
  adId: Id<'ads'> | null;
  modId: Id<'users'>;
  onClose: () => void;
  onOpenUser: (userId: Id<'users'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const token = useModToken(modId);

  const ad = useQuery(
    api.ads.getAdForReview,
    visible && adId && token ? { adId, modId, token } : 'skip'
  );

  const approveAd = useMutation(api.ads.approveAd);
  const rejectAd = useMutation(api.ads.rejectAd);

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isVideo = ad?.mediaType === 'video';
  const player = useVideoPlayer(visible && isVideo && ad?.mediaUrl ? { uri: ad.mediaUrl } : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const gradient = (ad?.displayAvatarGradient as [string, string]) ?? [colors.red, colors.coral];
  const letter = (ad?.displayName ?? '?').charAt(0).toUpperCase();

  const approve = async () => {
    if (!adId || !token || busy) return;
    setBusy(true);
    setError('');
    try {
      await approveAd({ adId, modId, token });
      onClose();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitReject = async () => {
    if (!adId || !token || busy || !reason.trim()) return;
    setBusy(true);
    setError('');
    try {
      await rejectAd({ adId, modId, token, reason });
      setRejecting(false);
      setReason('');
      onClose();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel="Go back">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Ad review</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {ad === undefined && <Text style={styles.loading}>Loading ad…</Text>}
          {ad === null && <Text style={styles.loading}>This ad is no longer available.</Text>}

          {ad && (
            <>
              <Text style={styles.sectionLabel}>How it will look</Text>
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <View style={styles.previewAvatar}>
                    {ad.displayAvatarUrl ? (
                      <Image source={{ uri: ad.displayAvatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <LinearGradient colors={gradient} style={styles.avatarGradient}>
                        <Text style={styles.avatarLetter}>{letter}</Text>
                      </LinearGradient>
                    )}
                  </View>
                  <View>
                    <Text style={styles.previewName}>{ad.displayName}</Text>
                    <Text style={styles.previewSponsored}>Sponsored</Text>
                  </View>
                </View>

                {ad.title && <Text style={styles.previewTitle}>{ad.title}</Text>}

                {ad.mediaUrl && (
                  <View style={styles.mediaWrap}>
                    {ad.mediaType === 'photo' ? (
                      <Image source={{ uri: ad.mediaUrl }} style={styles.media} resizeMode="cover" />
                    ) : (
                      <VideoView
                        style={styles.media}
                        player={player}
                        nativeControls={false}
                        contentFit="cover"
                      />
                    )}
                  </View>
                )}

                {ad.caption && <Text style={styles.previewCaption}>{ad.caption}</Text>}

                <View style={[styles.ctaButton, { backgroundColor: ad.buttonColor }]}>
                  <Text style={styles.ctaButtonText}>{ad.buttonText}</Text>
                </View>
                <Text style={styles.linkText} numberOfLines={1}>{ad.link}</Text>
              </View>

              <Text style={styles.sectionLabel}>Who's really behind it</Text>
              <Pressable
                style={styles.advertiserCard}
                onPress={() => {
                  onClose();
                  onOpenUser(ad.creatorId as Id<'users'>);
                }}
              >
                <View style={styles.advertiserAvatar}>
                  {ad.creator?.avatarUrl ? (
                    <Image source={{ uri: ad.creator.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <LinearGradient colors={[colors.red, colors.coral]} style={styles.avatarGradient}>
                      <Text style={styles.avatarLetter}>
                        {(ad.creator?.username ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
                <View style={styles.advertiserText}>
                  <View style={styles.advertiserNameRow}>
                    <Text style={styles.advertiserName}>@{ad.creator?.username ?? 'unknown'}</Text>
                    <VerifiedBadge verified={ad.creator?.isVerified} size={14} />
                  </View>
                  <Text style={styles.advertiserSubname}>{ad.creator?.name ?? 'View profile'}</Text>
                </View>
              </Pressable>

              {error !== '' && <Text style={styles.error}>{error}</Text>}
            </>
          )}
        </ScrollView>

        {ad && (
          <View style={styles.actions}>
            <PrimaryButton label="Approve ad" loading={busy} onPress={approve} />
            <PrimaryButton label="Reject" tone="danger" onPress={() => setRejecting(true)} />
          </View>
        )}

        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      </View>

      <FormModal
        visible={rejecting}
        title="Reject this ad"
        subtitle="Write why — the advertiser sees this and can edit and resubmit."
        icon={Flag02Icon}
        onClose={() => {
          setRejecting(false);
          setReason('');
        }}
        footer={
          <PrimaryButton
            label="Send rejection"
            tone="danger"
            loading={busy}
            disabled={reason.trim().length === 0}
            onPress={submitReject}
          />
        }
      >
        <AppTextInput
          style={styles.textArea}
          placeholder="Explain what needs to change."
          placeholderTextColor={colors.placeholder}
          multiline
          textAlignVertical="top"
          maxLength={600}
          value={reason}
          onChangeText={setReason}
        />
        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </FormModal>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: space.xxxl - 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.lg,
      paddingBottom: space.sm + 2,
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
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: space.lg,
      paddingBottom: space.lg,
      gap: space.sm - 2,
    },
    loading: {
      marginTop: space.xxxl - 8,
      ...typography.callout,
      color: colors.textMuted,
      textAlign: 'center',
    },
    sectionLabel: {
      marginTop: space.sm + 2,
      marginBottom: space.sm - 2,
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    previewCard: {
      padding: space.md,
      borderRadius: radius.xl,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      gap: space.sm,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    previewAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
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
      fontSize: 15,
      color: '#ffffff',
    },
    previewName: {
      ...typography.bodyBold,
      color: colors.white,
    },
    previewSponsored: {
      ...typography.caption,
      color: colors.textMuted,
    },
    previewTitle: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 18,
      color: colors.white,
    },
    mediaWrap: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: '#000',
    },
    media: {
      flex: 1,
    },
    previewCaption: {
      ...typography.callout,
      color: colors.textMuted,
    },
    ctaButton: {
      height: 46,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaButtonText: {
      ...typography.bodyBold,
      color: '#ffffff',
    },
    linkText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    advertiserCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      padding: space.sm + 2,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    advertiserAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: colors.border,
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
    error: {
      marginTop: space.xxs,
      ...typography.footnote,
      color: colors.errorText,
    },
    actions: {
      gap: space.sm - 2,
      paddingHorizontal: space.lg,
      paddingTop: space.sm + 2,
      paddingBottom: space.xxl - 2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    textArea: {
      minHeight: 140,
      borderRadius: radius.input,
      padding: space.lg - 2,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.white,
      ...typography.body,
    },
  });
