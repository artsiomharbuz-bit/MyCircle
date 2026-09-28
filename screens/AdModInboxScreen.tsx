import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, CheckmarkCircle02Icon, Megaphone01Icon, PlayIcon } from '@hugeicons/core-free-icons';
import AdReviewModal from '../components/AdReviewModal';
import AnimatedPressable from '../components/AnimatedPressable';
import { HEADER_HEIGHT } from '../components/CollapsibleHeader';
import EmptyState from '../components/EmptyState';
import FadeInView from '../components/FadeInView';
import Skeleton from '../components/Skeleton';
import { useModGate } from '../components/ModGate';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { AD_KIND_LABEL } from '../adPricing';
import { formatRelativeTime } from '../formatRelativeTime';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

// Every moderator's shared ad-review queue — same "claim by opening" idea
// isn't needed here (unlike reports there's no risk of two mods disagreeing
// mid-review), just a plain pending list.
export default function AdModInboxScreen({
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
  const { t } = useTranslation(['adModInbox', 'common']);

  const ads = useQuery(api.ads.listPendingAds, { modId: userId });
  const [openAdId, setOpenAdId] = useState<Id<'ads'> | null>(null);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {ads === undefined &&
          [0, 1, 2].map((i) => (
            <View key={i} style={styles.row}>
              <Skeleton style={styles.avatar} />
              <View style={styles.rowText}>
                <Skeleton style={styles.titleSkeleton} />
                <Skeleton style={styles.previewSkeleton} />
              </View>
            </View>
          ))}

        {ads && ads.length === 0 && (
          <EmptyState icon={CheckmarkCircle02Icon} message={t('emptyStateMessage')} style={styles.emptyState} />
        )}

        {ads?.map((ad) => (
          <FadeInView key={ad._id}>
            <AnimatedPressable onPress={() => run(() => setOpenAdId(ad._id as Id<'ads'>))}>
              <View style={styles.row}>
                <View style={styles.avatarWrap}>
                  {ad.mediaUrl ? (
                    <Image source={{ uri: ad.mediaUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.center]}>
                      <HugeiconsIcon icon={Megaphone01Icon} size={20} color={colors.white} />
                    </View>
                  )}
                  {ad.mediaType === 'video' && (
                    <View style={styles.playBadge}>
                      <HugeiconsIcon icon={PlayIcon} size={10} color="#ffffff" />
                    </View>
                  )}
                </View>

                <View style={styles.rowText}>
                  <View style={styles.titleLine}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {AD_KIND_LABEL[ad.kind]}: {ad.displayName}
                    </Text>
                    <Text style={styles.rowTime}>{formatRelativeTime(ad.createdAt)}</Text>
                  </View>

                  <View style={styles.targetLine}>
                    {ad.creator?.avatarUrl ? (
                      <Image source={{ uri: ad.creator.avatarUrl }} style={styles.creatorAvatar} />
                    ) : (
                      <LinearGradient
                        colors={[colors.red, colors.coral]}
                        style={styles.creatorAvatar}
                      />
                    )}
                    <Text style={styles.rowTarget} numberOfLines={1}>
                      @{ad.creator?.username ?? t('unknownUsername')}
                    </Text>
                  </View>
                </View>
              </View>
            </AnimatedPressable>
          </FadeInView>
        ))}
      </ScrollView>

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} accessibilityLabel={t('common:back')}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>{t('headerTitle')}</Text>
        {ads && ads.length > 0 && <Text style={styles.count}>{ads.length}</Text>}
      </View>

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
    playBadge: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      width: 21,
      height: 21,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.coral,
      borderWidth: 2,
      borderColor: colors.inputBackground,
    },
    rowText: {
      flex: 1,
      gap: 5,
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
      gap: 6,
    },
    creatorAvatar: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    rowTarget: {
      ...typography.footnote,
      color: colors.textMuted,
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
  });
