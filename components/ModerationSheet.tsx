import AppTextInput from './AppTextInput';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Text from './AppText';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Alert02Icon,
  BanIcon,
  CheckmarkBadge01Icon,
  CheckmarkCircle01Icon,
  LegalHammerIcon,
  UserBlock01Icon,
} from '@hugeicons/core-free-icons';
import ActionSheet, { SheetAction } from './ActionSheet';
import ConfirmActionModal from './ConfirmActionModal';
import FormModal from './FormModal';
import NativePopup from './nativepopup';
import PrimaryButton from './PrimaryButton';
import { VERIFIED_BLACK } from './VerifiedBadge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useModToken } from '../modSession';
import {
  DURATIONS,
  DurationKey,
  MAX_STRIKES,
  durationLabel,
  formatTimeLeft,
} from '../moderationOptions';
import { readableError } from '../errorMessage';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

type ModerationView =
  | 'menu'
  | 'restrict-duration'
  | 'ban-duration'
  | 'warn'
  | 'strike'
  | 'confirm-ban'
  | 'confirm-verify'
  | 'confirm-lift-restriction'
  | 'confirm-lift-ban';

// Everything a moderator can do to an account, behind one popup. Every action
// writes an entry to the account's log.
//
// The caller opens this only after the password gate has passed (see
// useModGate), so the unlock token is already in hand — which is what lets
// each action here be awaited properly and report its own errors.
export default function ModerationSheet({
  visible,
  targetUserId,
  modId,
  onClose,
}: {
  visible: boolean;
  targetUserId: Id<'users'>;
  modId: Id<'users'>;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const token = useModToken(modId);

  const target = useQuery(
    api.moderation.getModerationTarget,
    visible ? { targetUserId, modId } : 'skip'
  );

  const restrictUser = useMutation(api.moderation.restrictUser);
  const banUser = useMutation(api.moderation.banUser);
  const liftSanction = useMutation(api.moderation.liftSanction);
  const warnUser = useMutation(api.moderation.warnUser);
  const setVerified = useMutation(api.moderation.setVerified);
  const giveStrike = useMutation(api.moderation.giveStrike);

  const [view, setView] = useState<ModerationView>('menu');
  const [pendingDuration, setPendingDuration] = useState<DurationKey>('1d');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ title: string; message: string } | null>(null);

  const username = target?.username ? `@${target.username}` : 'this account';

  const reset = () => {
    setView('menu');
    setMessage('');
    setError('');
    setBusy(false);
  };

  const closeAll = () => {
    reset();
    onClose();
  };

  // Runs a moderation mutation, then closes the sheet and swaps in a popup
  // describing what actually happened. Throws on failure so the confirmation
  // screens that call it can surface the error in place.
  const perform = async (
    action: (token: string) => Promise<unknown>,
    success:
      | { title: string; message: string }
      | ((outcome: unknown) => { title: string; message: string })
  ) => {
    if (!token) {
      throw new Error('Your moderator session has expired. Close this and unlock again.');
    }

    setBusy(true);
    setError('');
    try {
      const outcome = await action(token);
      setResult(typeof success === 'function' ? success(outcome) : success);
      reset();
      onClose();
    } catch (err) {
      setError(readableError(err));
      throw err;
    } finally {
      setBusy(false);
    }
  };

  // The text-entry flows (warn, strike) have no confirmation screen of their
  // own, so they swallow the error after `perform` has shown it inline.
  const performInline = (
    action: (token: string) => Promise<unknown>,
    success:
      | { title: string; message: string }
      | ((outcome: unknown) => { title: string; message: string })
  ) => {
    perform(action, success).catch(() => {});
  };

  // Restrict/Ban and their Lift counterparts are always both shown, rather
  // than swapping one for the other — the Lift row just disables itself when
  // there's nothing active to lift, so it's never a hidden or guessable
  // action, and its description doubles as the live countdown.
  const menuActions: SheetAction[] = target
    ? [
        {
          key: 'restrict',
          label: 'Restrict',
          description: target.isRestricted
            ? `Blocks commenting and posting — currently active, ${formatTimeLeft(target.restrictedUntil)}`
            : 'Blocks commenting and posting posts and clips',
          icon: UserBlock01Icon,
          onPress: () => setView('restrict-duration'),
        },
        {
          key: 'lift-restriction',
          label: 'Lift restriction',
          description: target.isRestricted
            ? `Restores commenting and posting immediately — ${formatTimeLeft(target.restrictedUntil)}`
            : 'No active restriction right now',
          icon: CheckmarkCircle01Icon,
          disabled: !target.isRestricted,
          onPress: () => setView('confirm-lift-restriction'),
        },
        {
          key: 'warn',
          label: 'Warn',
          description: 'Sends a written warning that pops up when they open the app',
          icon: Alert02Icon,
          onPress: () => setView('warn'),
        },
        {
          key: 'ban',
          label: 'Ban',
          description: target.isBanned
            ? `Locks them out of the app — currently active, ${formatTimeLeft(target.bannedUntil)}`
            : 'Locks them out of the app entirely',
          icon: BanIcon,
          tone: 'danger',
          onPress: () => setView('ban-duration'),
        },
        {
          key: 'unban',
          label: 'Lift ban',
          description: target.isBanned
            ? `Restores access immediately — ${formatTimeLeft(target.bannedUntil)}`
            : 'No active ban right now',
          icon: CheckmarkCircle01Icon,
          disabled: !target.isBanned,
          onPress: () => setView('confirm-lift-ban'),
        },
        {
          key: 'verify',
          label: target.isVerified ? 'Remove verification' : 'Verify',
          description: target.isVerified
            ? 'Takes the blue check off their name'
            : 'Puts a blue check next to their name everywhere',
          icon: CheckmarkBadge01Icon,
          onPress: () => setView('confirm-verify'),
        },
        {
          key: 'strike',
          label: 'Give a strike',
          description: `Currently ${target.strikeCount} of ${MAX_STRIKES} — ${MAX_STRIKES} strikes is a permanent ban`,
          icon: LegalHammerIcon,
          tone: 'danger',
          onPress: () => setView('strike'),
        },
      ]
    : [];

  const durationActions = (onPick: (key: DurationKey) => void): SheetAction[] =>
    DURATIONS.map((duration) => ({
      key: duration.key,
      label: duration.label,
      icon: duration.key === 'forever' ? BanIcon : Alert02Icon,
      tone: duration.key === 'forever' ? ('danger' as const) : ('default' as const),
      onPress: () => onPick(duration.key),
    }));

  return (
    <>
      {/* Main menu */}
      <ActionSheet
        visible={visible && view === 'menu'}
        title="Moderation"
        subtitle={
          target?.isMainAdmin
            ? 'This is the Main Admin account and cannot be moderated.'
            : `Choose what happens to ${username}. Every action is logged with your name.`
        }
        actions={target?.isMainAdmin ? [] : menuActions}
        onClose={closeAll}
      >
        {target && !target.isMainAdmin && (
          <View style={styles.statusRow}>
            <StatusChip
              label={`${target.strikeCount}/${MAX_STRIKES} strikes`}
              tone={target.strikeCount > 0 ? 'warn' : 'neutral'}
            />
            {target.isRestricted && (
              <StatusChip label={`Restricted · ${formatTimeLeft(target.restrictedUntil)}`} tone="warn" />
            )}
            {target.isBanned && (
              <StatusChip label={`Banned · ${formatTimeLeft(target.bannedUntil)}`} tone="danger" />
            )}
            {target.isVerified && <StatusChip label="Verified" tone="verified" />}
            {target.isMod && <StatusChip label="Moderator" tone="neutral" />}
          </View>
        )}
        {error !== '' && <Text style={styles.sheetError}>{error}</Text>}
      </ActionSheet>

      {/* Restrict: how long? */}
      <ActionSheet
        visible={visible && view === 'restrict-duration'}
        title="Restrict for how long?"
        subtitle={
          target?.isRestricted
            ? `${username} is already restricted (${formatTimeLeft(target.restrictedUntil)}). Picking a length below replaces it.`
            : `${username} won't be able to comment or post posts and clips until it expires.`
        }
        actions={durationActions((key) =>
          performInline(
            (token) => restrictUser({ targetUserId, modId, token, duration: key }),
            {
              title: 'Account restricted',
              message: `${username} can no longer comment or post for ${durationLabel(key).toLowerCase()}.`,
            }
          )
        )}
        onClose={() => setView('menu')}
      />

      {/* Ban: how long? */}
      <ActionSheet
        visible={visible && view === 'ban-duration'}
        title="Ban for how long?"
        subtitle={
          target?.isBanned
            ? `${username} is already banned (${formatTimeLeft(target.bannedUntil)}). Picking a length below replaces it. Forever is meant for severe cases only.`
            : 'Forever is meant for severe cases only.'
        }
        actions={durationActions((key) => {
          setPendingDuration(key);
          setView('confirm-ban');
        })}
        onClose={() => setView('menu')}
      />

      <ConfirmActionModal
        visible={visible && view === 'confirm-ban'}
        title={`Ban ${username}?`}
        subtitle={`This ban lasts ${durationLabel(pendingDuration).toLowerCase()}.`}
        icon={BanIcon}
        consequences={[
          'They are signed out of the app and cannot use this account.',
          'Their posts, clips and comments stay up unless removed separately.',
          'The ban is written to their log with your name and the time.',
        ]}
        confirmLabel={`Ban ${durationLabel(pendingDuration).toLowerCase()}`}
        onConfirm={() =>
          perform(
            (token) => banUser({ targetUserId, modId, token, duration: pendingDuration }),
            {
              title: 'Account banned',
              message: `${username} has been banned ${durationLabel(pendingDuration).toLowerCase()}.`,
            }
          )
        }
        onClose={() => setView('menu')}
      />

      {/* Warn */}
      <FormModal
        visible={visible && view === 'warn'}
        title={`Warn ${username}`}
        subtitle="Write the warning they'll see. It pops up the next time they open the app and stays in their notifications."
        icon={Alert02Icon}
        onClose={() => {
          setMessage('');
          setView('menu');
        }}
        footer={
          <PrimaryButton
            label="Send warning"
            loading={busy}
            disabled={message.trim().length === 0}
            onPress={() =>
              performInline((token) => warnUser({ targetUserId, modId, token, message }), {
                title: 'Warning sent',
                message: `${username} will see your warning the next time they open the app.`,
              })
            }
          />
        }
      >
        <AppTextInput
          style={styles.textArea}
          placeholder="Explain what they did and what needs to change."
          placeholderTextColor={colors.placeholder}
          multiline
          textAlignVertical="top"
          maxLength={600}
          value={message}
          onChangeText={setMessage}
        />
        <Text style={styles.counter}>{message.length}/600</Text>

        {message.trim().length > 0 && (
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>What {username} will see</Text>
            <View style={styles.previewCard}>
              <View style={styles.previewIcon}>
                <HugeiconsIcon icon={Alert02Icon} size={16} color={colors.accentText} />
              </View>
              <View style={styles.previewText}>
                <Text style={styles.previewTitle}>You've received a warning</Text>
                <Text style={styles.previewMessage}>{message.trim()}</Text>
              </View>
            </View>
          </View>
        )}

        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </FormModal>

      {/* Strike */}
      <FormModal
        visible={visible && view === 'strike'}
        title="Give a strike"
        subtitle="They get a notification and a popup explaining why."
        icon={LegalHammerIcon}
        onClose={() => {
          setMessage('');
          setView('menu');
        }}
        footer={
          <PrimaryButton
            label="Give strike"
            tone="danger"
            loading={busy}
            disabled={message.trim().length === 0}
            onPress={() =>
              performInline(
                (token) => giveStrike({ targetUserId, modId, token, reason: message }),
                (outcome) => {
                  const data = outcome as { strikeCount: number; banned: boolean } | null;
                  return data?.banned
                    ? {
                        title: 'Third strike — banned',
                        message: `${username} reached ${MAX_STRIKES} strikes and has been permanently banned.`,
                      }
                    : {
                        title: 'Strike given',
                        message: `${username} now has ${data?.strikeCount ?? '?'} of ${MAX_STRIKES} strikes.`,
                      };
                }
              )
            }
          />
        }
      >
        {target && (
          <View style={styles.strikeBlock}>
            <View style={styles.strikeRow}>
              {Array.from({ length: MAX_STRIKES }).map((_, index) => {
                const filled = index < target.strikeCount;
                const pending = index === target.strikeCount;
                return (
                  <View
                    key={index}
                    style={[
                      styles.strikePip,
                      filled && styles.strikePipFilled,
                      pending && styles.strikePipPending,
                    ]}
                  />
                );
              })}
              <Text style={styles.strikeCaption}>
                {target.strikeCount} → {Math.min(target.strikeCount + 1, MAX_STRIKES)} of{' '}
                {MAX_STRIKES}
              </Text>
            </View>
            {target.strikeCount + 1 >= MAX_STRIKES && (
              <Text style={styles.strikeWarning}>
                This is their third strike — the account will be banned forever automatically.
              </Text>
            )}
          </View>
        )}

        <Text style={styles.label}>Why is this strike being given?</Text>
        <AppTextInput
          style={styles.textArea}
          placeholder="This reason is shown to the user."
          placeholderTextColor={colors.placeholder}
          multiline
          textAlignVertical="top"
          maxLength={600}
          value={message}
          onChangeText={setMessage}
        />
        <Text style={styles.counter}>{message.length}/600</Text>
        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </FormModal>

      {/* Verify toggle */}
      <ConfirmActionModal
        visible={visible && view === 'confirm-verify'}
        title={target?.isVerified ? `Remove verification?` : `Verify ${username}?`}
        subtitle={
          target?.isVerified
            ? 'The blue check disappears from their name everywhere in the app.'
            : 'A blue check appears next to their name everywhere in the app.'
        }
        icon={CheckmarkBadge01Icon}
        tone={target?.isVerified ? 'danger' : 'primary'}
        confirmLabel={target?.isVerified ? 'Remove verification' : 'Verify account'}
        onConfirm={() =>
          perform(
            (token) =>
              setVerified({ targetUserId, modId, token, verified: !target?.isVerified }),
            {
              title: target?.isVerified ? 'Verification removed' : 'Account verified',
              message: target?.isVerified
                ? `${username} no longer has a blue check.`
                : `${username} now has a blue check next to their name.`,
            }
          )
        }
        onClose={() => setView('menu')}
      />

      {/* Lifting sanctions */}
      <ConfirmActionModal
        visible={visible && view === 'confirm-lift-restriction'}
        title="Lift this restriction?"
        subtitle={
          target?.isRestricted
            ? `Currently restricted, ${formatTimeLeft(target.restrictedUntil)}. ${username} will be able to comment and post again straight away.`
            : `${username} will be able to comment and post again straight away.`
        }
        icon={CheckmarkCircle01Icon}
        tone="primary"
        confirmLabel="Lift restriction"
        onConfirm={() =>
          perform(
            (token) => liftSanction({ targetUserId, modId, token, sanction: 'restriction' }),
            {
              title: 'Restriction lifted',
              message: `${username} can comment and post again.`,
            }
          )
        }
        onClose={() => setView('menu')}
      />

      <ConfirmActionModal
        visible={visible && view === 'confirm-lift-ban'}
        title="Lift this ban?"
        subtitle={
          target?.isBanned
            ? `Currently banned, ${formatTimeLeft(target.bannedUntil)}. ${username} will be able to use the app again straight away.`
            : `${username} will be able to use the app again straight away.`
        }
        icon={CheckmarkCircle01Icon}
        tone="primary"
        confirmLabel="Lift ban"
        onConfirm={() =>
          perform((token) => liftSanction({ targetUserId, modId, token, sanction: 'ban' }), {
            title: 'Ban lifted',
            message: `${username} can use the app again.`,
          })
        }
        onClose={() => setView('menu')}
      />

      <NativePopup
        visible={result !== null}
        title={result?.title ?? ''}
        message={result?.message ?? ''}
        confirmLabel="Done"
        showCancel={false}
        onClose={() => setResult(null)}
        onConfirm={() => setResult(null)}
      />
    </>
  );
}

// 'verified' reuses the same blue as the checkmark badge itself, rather than
// the app's coral accent — a status chip about verification should read as
// the same color as verification does everywhere else, not a different one.
function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: 'neutral' | 'verified' | 'warn' | 'danger';
}) {
  const { colors } = useAppTheme();
  const background =
    tone === 'danger'
      ? colors.red
      : tone === 'warn'
        ? colors.yellow
        : tone === 'verified'
          ? VERIFIED_BLACK
          : colors.buttonSecondary;
  const color =
    tone === 'warn' ? '#111111' : tone === 'neutral' ? colors.white : colors.accentText;

  return (
    <View style={[chipStyles.chip, { backgroundColor: background }]}>
      <Text style={[chipStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  label: {
    ...typography.caption,
    fontFamily: 'Poppins_600SemiBold',
    fontWeight: '700',
  },
});

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.xs,
      marginTop: space.md,
    },
    sheetError: {
      marginTop: space.md,
      ...typography.footnote,
      color: colors.errorText,
    },
    label: {
      marginBottom: 10,
      fontSize: 13,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    textArea: {
      ...typography.body,
      minHeight: 140,
      borderRadius: radius.input,
      padding: space.md,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.white,
    },
    counter: {
      marginTop: space.xs,
      textAlign: 'right',
      ...typography.caption,
      color: colors.textMuted,
    },
    error: {
      marginTop: space.md,
      ...typography.footnote,
      color: colors.errorText,
    },
    preview: {
      marginTop: space.lg,
    },
    previewLabel: {
      marginBottom: space.xs,
      fontSize: 12,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    previewCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.yellow,
    },
    previewText: {
      flex: 1,
      gap: 3,
    },
    previewTitle: {
      ...typography.calloutBold,
      color: colors.white,
    },
    previewMessage: {
      ...typography.footnote,
      color: colors.textMuted,
    },
    strikeBlock: {
      marginBottom: 22,
    },
    strikeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    strikePip: {
      width: 30,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.buttonSecondary,
    },
    strikePipFilled: {
      backgroundColor: colors.red,
    },
    strikePipPending: {
      backgroundColor: colors.red,
      opacity: 0.4,
    },
    strikeCaption: {
      marginLeft: 6,
      fontSize: 12,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      color: colors.textMuted,
    },
    strikeWarning: {
      marginTop: 10,
      ...typography.footnote,
      color: colors.errorText,
    },
  });
