import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { CreditCardIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { AdKind, adDailyPrice, adMonthlyPrice, formatUsd } from '../adPricing';
import { readableError } from '../errorMessage';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

// Stripe isn't wired in yet — this activates the ad the moment "Pay" is
// tapped, exactly as a successful charge would (see ads.payAd). Swapping in
// real billing later only touches that one mutation, not this UI.
export default function AdPaymentSheet({
  visible,
  adId,
  kind,
  userId,
  onClose,
  onPaid,
}: {
  visible: boolean;
  adId: Id<'ads'> | null;
  kind: AdKind;
  userId: Id<'users'>;
  onClose: () => void;
  onPaid: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [plan, setPlan] = useState<'daily' | 'monthly'>('daily');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const payAd = useMutation(api.ads.payAd);

  const close = () => {
    setError('');
    setPlan('daily');
    onClose();
  };

  const pay = async () => {
    if (!adId || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await payAd({ adId, creatorId: userId, plan });
      onPaid();
      close();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.anchor} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Launch this ad</Text>
          <Text style={styles.subtitle}>Choose how you'd like to pay.</Text>

          <PlanRow
            label="Daily"
            price={`${formatUsd(adDailyPrice(kind))}/day`}
            selected={plan === 'daily'}
            onPress={() => setPlan('daily')}
          />
          <PlanRow
            label="Monthly"
            price={`${formatUsd(adMonthlyPrice(kind))}/mo`}
            badge="-10%"
            selected={plan === 'monthly'}
            onPress={() => setPlan('monthly')}
          />

          <View style={styles.stubNote}>
            <HugeiconsIcon icon={CreditCardIcon} size={16} color={colors.textMuted} />
            <Text style={styles.stubNoteText}>
              Card payments through Stripe are coming soon — tapping Pay activates your ad right
              away for now.
            </Text>
          </View>

          {error !== '' && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.payButton} onPress={pay} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={colors.accentText} />
            ) : (
              <Text style={styles.payButtonText}>
                Pay {plan === 'daily' ? formatUsd(adDailyPrice(kind)) : formatUsd(adMonthlyPrice(kind))}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function PlanRow({
  label,
  price,
  badge,
  selected,
  onPress,
}: {
  label: string;
  price: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <Pressable style={[styles.planRow, selected && styles.planRowSelected]} onPress={onPress}>
      <View style={styles.planText}>
        <View style={styles.planLabelRow}>
          <Text style={styles.planLabel}>{label}</Text>
          {badge && (
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.planPrice}>{price}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <HugeiconsIcon icon={Tick02Icon} size={13} color="#ffffff" />}
      </View>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'transparent',
    },
    anchor: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      paddingTop: space.xs,
      paddingHorizontal: space.lg,
      paddingBottom: space.xxl + 4,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.buttonSecondary,
      marginBottom: space.lg - 2,
    },
    title: {
      ...typography.h2,
      color: colors.white,
    },
    subtitle: {
      marginTop: space.xxs + 2,
      ...typography.footnote,
      color: colors.textMuted,
      marginBottom: space.lg - 2,
    },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      padding: space.sm + 2,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: space.sm - 2,
    },
    planRowSelected: {
      borderColor: colors.coral,
    },
    planText: {
      flex: 1,
      gap: 3,
    },
    planLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
    },
    planLabel: {
      ...typography.bodyBold,
      color: colors.white,
    },
    planBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: colors.yellow,
    },
    planBadgeText: {
      fontSize: 10,
      fontFamily: 'Poppins_600SemiBold',
      color: '#111111',
    },
    planPrice: {
      ...typography.footnote,
      color: colors.textMuted,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      backgroundColor: colors.coral,
      borderColor: colors.coral,
    },
    stubNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.xs + 2,
      marginTop: space.xxs + 2,
      marginBottom: space.xxs,
    },
    stubNoteText: {
      flex: 1,
      ...typography.caption,
      lineHeight: 17,
      color: colors.textMuted,
    },
    error: {
      marginTop: space.sm - 2,
      ...typography.footnote,
      color: colors.errorText,
    },
    payButton: {
      marginTop: space.lg - 2,
      height: 52,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.coral,
    },
    payButtonText: {
      ...typography.h3,
      color: colors.accentText,
    },
  });
