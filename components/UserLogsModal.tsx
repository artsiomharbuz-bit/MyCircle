import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react-native';
import {
  AiBrain01Icon,
  Alert02Icon,
  BanIcon,
  CheckmarkBadge01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  Flag02Icon,
  Legal01Icon,
  LegalHammerIcon,
  ShieldUserIcon,
  UserAdd01Icon,
  UserBlock01Icon,
  UserRemove01Icon,
} from '@hugeicons/core-free-icons';
import FormModal from './FormModal';
import { VERIFIED_BLACK } from './VerifiedBadge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useModToken } from '../modSession';
import { useAppTheme } from '../ThemeContext';
import { Colors, space, typography } from '../theme';

type LogAction =
  | 'restrict'
  | 'unrestrict'
  | 'warn'
  | 'ban'
  | 'unban'
  | 'verify'
  | 'unverify'
  | 'strike'
  | 'delete_media'
  | 'dismiss_report'
  | 'promote_mod'
  | 'revoke_mod'
  | 'label_ai';

// How each log action presents itself: a headline, an icon, and whether it
// reads as a sanction (red). Everything else stays neutral gray — the label
// text already says whether it was a reprieve or a punishment, so the dot
// doesn't need its own color-coding for that too. 'verified' is the one
// exception, reusing the exact blue of the checkmark badge itself so a log
// entry about verification always reads as the same color verification does
// everywhere else in the app.
const ACTION_META: Record<
  LogAction,
  { label: string; icon: IconSvgElement; tone: 'danger' | 'neutral' | 'verified' }
> = {
  restrict: { label: 'Restricted', icon: UserBlock01Icon, tone: 'danger' },
  unrestrict: { label: 'Restriction lifted', icon: CheckmarkCircle01Icon, tone: 'neutral' },
  warn: { label: 'Warned', icon: Alert02Icon, tone: 'danger' },
  ban: { label: 'Banned', icon: BanIcon, tone: 'danger' },
  unban: { label: 'Ban lifted', icon: CheckmarkCircle01Icon, tone: 'neutral' },
  verify: { label: 'Verified', icon: CheckmarkBadge01Icon, tone: 'verified' },
  unverify: { label: 'Verification removed', icon: CheckmarkBadge01Icon, tone: 'neutral' },
  strike: { label: 'Strike given', icon: LegalHammerIcon, tone: 'danger' },
  delete_media: { label: 'Media removed', icon: Delete02Icon, tone: 'danger' },
  dismiss_report: { label: 'Report dismissed', icon: Flag02Icon, tone: 'neutral' },
  promote_mod: { label: 'Made a moderator', icon: UserAdd01Icon, tone: 'neutral' },
  revoke_mod: { label: 'Moderator access revoked', icon: UserRemove01Icon, tone: 'neutral' },
  label_ai: { label: 'Labeled Contains AI', icon: AiBrain01Icon, tone: 'neutral' },
};

function formatStamp(value: number): string {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Everything moderators have ever done to this account and its media, newest
// first, each entry naming the moderator responsible and when it happened.
export default function UserLogsModal({
  visible,
  targetUserId,
  targetUsername,
  modId,
  onClose,
}: {
  visible: boolean;
  targetUserId: Id<'users'>;
  targetUsername?: string;
  modId: Id<'users'>;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const token = useModToken(modId);

  const logs = useQuery(
    api.moderation.listUserLogs,
    visible && token ? { targetUserId, modId, token } : 'skip'
  );

  return (
    <FormModal
      visible={visible}
      title="Moderation log"
      subtitle={
        targetUsername
          ? `Every moderator action taken on @${targetUsername}, newest first.`
          : 'Every moderator action taken on this account, newest first.'
      }
      icon={Legal01Icon}
      onClose={onClose}
    >
      {visible && !token && (
        <Text style={styles.notice}>
          Your moderator session has expired. Close this and unlock again.
        </Text>
      )}

      {logs && logs.length === 0 && (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <HugeiconsIcon icon={ShieldUserIcon} size={22} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyText}>
            Nothing here. No moderator has ever acted on this account.
          </Text>
        </View>
      )}

      {logs && logs.length > 0 && (
        <View style={styles.timeline}>
          {logs.map((entry, index) => {
            const meta = ACTION_META[entry.action as LogAction];
            const isLast = index === logs.length - 1;

            return (
              <View key={entry._id} style={styles.entry}>
                <View style={styles.rail}>
                  <View
                    style={[
                      styles.dot,
                      meta.tone === 'danger' && styles.dotDanger,
                      meta.tone === 'verified' && styles.dotVerified,
                    ]}
                  >
                    <HugeiconsIcon
                      icon={meta.icon}
                      size={15}
                      color={meta.tone === 'neutral' ? colors.white : colors.accentText}
                    />
                  </View>
                  {!isLast && <View style={styles.line} />}
                </View>

                <View style={styles.entryBody}>
                  <View style={styles.entryHead}>
                    <Text style={styles.entryTitle}>{meta.label}</Text>
                    {entry.durationLabel && (
                      <View style={styles.durationChip}>
                        <Text style={styles.durationText}>{entry.durationLabel}</Text>
                      </View>
                    )}
                  </View>

                  {entry.detail && <Text style={styles.entryDetail}>{entry.detail}</Text>}

                  <Text style={styles.entryMeta}>
                    {entry.actorName}
                    {entry.actorIsMainAdmin ? ' (Main Admin)' : ''} · {formatStamp(entry.createdAt)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </FormModal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    notice: {
      ...typography.callout,
      color: colors.errorText,
    },
    empty: {
      alignItems: 'center',
      gap: 14,
      paddingVertical: 40,
    },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',


    },
    emptyText: {
      ...typography.callout,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: space.lg,
    },
    timeline: {
      gap: 4,
    },
    entry: {
      flexDirection: 'row',
      gap: 14,
    },
    rail: {
      alignItems: 'center',
      width: 30,
    },
    dot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    dotDanger: {
      backgroundColor: colors.red,
    },
    dotVerified: {
      backgroundColor: VERIFIED_BLACK,
    },
    line: {
      flex: 1,
      width: StyleSheet.hairlineWidth * 2,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    entryBody: {
      flex: 1,
      paddingBottom: 22,
      gap: 5,
    },
    entryHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    entryTitle: {
      ...typography.bodyBold,
      color: colors.white,
    },
    durationChip: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 9,
      backgroundColor: colors.buttonSecondary,
    },
    durationText: {
      ...typography.micro,
      color: colors.white,
    },
    entryDetail: {
      ...typography.callout,
      color: colors.white,
    },
    entryMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
  });
