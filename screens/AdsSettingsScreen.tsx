import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  EyeIcon,
  Megaphone01Icon,
  MouseLeftClick01Icon,
  PlayIcon,
  PlusSignIcon,
} from '@hugeicons/core-free-icons';
import AdPaymentSheet from '../components/AdPaymentSheet';
import EmptyState from '../components/EmptyState';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { AD_KIND_LABEL } from '../adPricing';
import { formatTimeLeft } from '../moderationOptions';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';
import type { MyAd } from './CreateAdScreen';

export default function AdsSettingsScreen({
  userId,
  onBack,
  onCreateAd,
  onEditAd,
}: {
  userId: Id<'users'>;
  onBack: () => void;
  onCreateAd: () => void;
  onEditAd: (ad: MyAd) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const ads = useQuery(api.ads.listMyAds, { creatorId: userId });
  const [payingAd, setPayingAd] = useState<{ _id: Id<'ads'>; kind: 'post' | 'clip' } | null>(null);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.createButton} onPress={onCreateAd}>
          <HugeiconsIcon icon={PlusSignIcon} size={18} color={colors.accentText} />
          <Text style={styles.createButtonText}>Create an ad</Text>
        </Pressable>

        {ads && ads.length === 0 && (
          <EmptyState
            icon={Megaphone01Icon}
            message="You haven't created any ads yet."
            style={styles.emptyState}
          />
        )}

        {ads?.map((ad) => (
          <AdRow
            key={ad._id}
            ad={ad}
            onEdit={() => onEditAd(ad as MyAd)}
            onPay={() => setPayingAd({ _id: ad._id, kind: ad.kind })}
          />
        ))}
      </ScrollView>

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>Ads</Text>
      </View>

      <AdPaymentSheet
        visible={payingAd !== null}
        adId={payingAd?._id ?? null}
        kind={payingAd?.kind ?? 'post'}
        userId={userId}
        onClose={() => setPayingAd(null)}
        onPaid={() => setPayingAd(null)}
      />

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

type AdStatus = 'pending_review' | 'rejected' | 'approved' | 'active' | 'expired';

function statusMeta(colors: Colors, status: AdStatus) {
  switch (status) {
    case 'pending_review':
      return { label: 'Pending review', color: colors.yellow, textColor: '#111111' };
    case 'rejected':
      return { label: 'Rejected', color: colors.red, textColor: colors.accentText };
    case 'approved':
      return { label: 'Approved — needs payment', color: colors.coral, textColor: colors.accentText };
    case 'active':
      return { label: 'Active', color: '#22c55e', textColor: '#0b1a10' };
    case 'expired':
      return { label: 'Expired', color: colors.buttonSecondary, textColor: colors.white };
  }
}

function AdRow({
  ad,
  onEdit,
  onPay,
}: {
  ad: {
    _id: Id<'ads'>;
    kind: 'post' | 'clip';
    status: AdStatus;
    rejectionReason: string | null;
    activeUntil: number | null;
    title: string;
    mediaType: 'photo' | 'video';
    mediaUrl: string | null;
    displayName: string;
    views: number;
    clicks: number;
  };
  onEdit: () => void;
  onPay: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const meta = statusMeta(colors, ad.status);
  const player = useVideoPlayer(
    ad.mediaType === 'video' && ad.mediaUrl ? { uri: ad.mediaUrl } : null,
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    }
  );

  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {ad.mediaUrl ? (
          ad.mediaType === 'photo' ? (
            <Image source={{ uri: ad.mediaUrl }} style={styles.thumbMedia} />
          ) : (
            <>
              <VideoView style={styles.thumbMedia} player={player} nativeControls={false} contentFit="cover" />
              <View style={styles.playBadge}>
                <HugeiconsIcon icon={PlayIcon} size={11} color="#ffffff" />
              </View>
            </>
          )
        ) : (
          <LinearGradient colors={[colors.red, colors.coral]} style={styles.thumbMedia} />
        )}
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowKind}>{AD_KIND_LABEL[ad.kind]}</Text>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {ad.title || ad.displayName}
        </Text>

        <View style={[styles.statusChip, { backgroundColor: meta?.color }]}>
          <Text style={[styles.statusChipText, { color: meta?.textColor }]}>{meta?.label}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <HugeiconsIcon icon={EyeIcon} size={13} color={colors.textMuted} />
            <Text style={styles.statText}>{ad.views.toLocaleString()} views</Text>
          </View>
          <View style={styles.statItem}>
            <HugeiconsIcon icon={MouseLeftClick01Icon} size={13} color={colors.textMuted} />
            <Text style={styles.statText}>{ad.clicks.toLocaleString()} clicks</Text>
          </View>
        </View>

        {ad.status === 'rejected' && ad.rejectionReason && (
          <Text style={styles.rejectionReason}>"{ad.rejectionReason}"</Text>
        )}

        {ad.status === 'active' && ad.activeUntil && (
          <Text style={styles.expiryText}>Runs {formatTimeLeft(ad.activeUntil)}</Text>
        )}

        {ad.status === 'rejected' && (
          <Pressable style={styles.actionButton} onPress={onEdit}>
            <Text style={styles.actionButtonText}>Edit & resubmit</Text>
          </Pressable>
        )}

        {(ad.status === 'approved' || ad.status === 'expired') && (
          <Pressable style={styles.actionButton} onPress={onPay}>
            <Text style={styles.actionButtonText}>
              {ad.status === 'expired' ? 'Renew' : 'Pay to launch'}
            </Text>
          </Pressable>
        )}
      </View>
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
      height: 100,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.xl,
      paddingTop: space.xxl,
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
      ...typography.h2,
      color: colors.white,
    },
    list: {
      paddingHorizontal: space.lg,
      paddingTop: 116,
      paddingBottom: space.xxl,
      gap: space.md,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs,
      height: 52,
      borderRadius: radius.button,
      backgroundColor: colors.coral,
      marginBottom: space.xxs,
    },
    createButtonText: {
      ...typography.bodyBold,
      color: colors.accentText,
    },
    emptyState: {
      marginTop: space.xxl,
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
    thumb: {
      width: 64,
      height: 84,
      borderRadius: radius.sm,
      overflow: 'hidden',
      backgroundColor: '#111',
    },
    thumbMedia: {
      flex: 1,
    },
    playBadge: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    rowText: {
      flex: 1,
      gap: 4,
    },
    rowKind: {
      ...typography.micro,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    rowTitle: {
      ...typography.bodyBold,
      color: colors.white,
    },
    statusChip: {
      alignSelf: 'flex-start',
      marginTop: 2,
      paddingHorizontal: space.xs,
      paddingVertical: 4,
      borderRadius: radius.xs,
    },
    statusChipText: {
      ...typography.micro,
    },
    statsRow: {
      flexDirection: 'row',
      gap: space.md,
      marginTop: 2,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    rejectionReason: {
      ...typography.caption,
      lineHeight: 17,
      color: colors.errorText,
    },
    expiryText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    actionButton: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: space.sm,
      height: 32,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonSecondary,
    },
    actionButtonText: {
      ...typography.caption,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.white,
    },
  });
