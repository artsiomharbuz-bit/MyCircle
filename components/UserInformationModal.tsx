import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react-native';
import {
  Calendar01Icon,
  GlobalIcon,
  InformationCircleIcon,
  Location01Icon,
  Mail01Icon,
  ShieldUserIcon,
  Time04Icon,
} from '@hugeicons/core-free-icons';
import FormModal from './FormModal';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useModToken } from '../modSession';
import { formatSanctionExpiry, formatTimeLeft, isSanctionActive, MAX_STRIKES } from '../moderationOptions';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, typography } from '../theme';

function formatDateTime(value: number | null | undefined): string {
  if (!value) return 'Never recorded';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// The account details a moderator sees before deciding on a consequence —
// where the account came from and where it last was. Only reachable with an
// unlocked moderator session; the query refuses without a valid token.
export default function UserInformationModal({
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

  const info = useQuery(
    api.moderation.getUserInformation,
    visible && token ? { targetUserId, modId, token } : 'skip'
  );

  return (
    <FormModal
      visible={visible}
      title="Account information"
      subtitle={
        info
          ? `${info.name ?? 'Unnamed'} · @${info.username ?? 'unknown'}`
          : 'Loading account details…'
      }
      icon={InformationCircleIcon}
      onClose={onClose}
    >
      {info && (
        <View style={styles.groups}>
          <Group title="Identity">
            <Row icon={Mail01Icon} label="Email" value={info.email} />
            <Row
              icon={ShieldUserIcon}
              label="Role"
              value={info.role + (info.isVerified ? ' · Verified' : '')}
            />
            <Row
              icon={Calendar01Icon}
              label="Date of birth"
              value={info.dateOfBirth ?? 'Not given'}
            />
          </Group>

          <Group title="Registration">
            <Row
              icon={Time04Icon}
              label="Registered"
              value={formatDateTime(info.registeredAt)}
            />
            <Row
              icon={GlobalIcon}
              label="IP at registration"
              value={info.registrationIp ?? 'Not recorded'}
              mono
            />
          </Group>

          <Group title="Last seen">
            <Row
              icon={Time04Icon}
              label="Last online"
              value={formatDateTime(info.lastSeenAt)}
            />
            <Row
              icon={GlobalIcon}
              label="IP when last online"
              value={info.lastSeenIp ?? 'Not recorded'}
              mono
            />
            <Row
              icon={Location01Icon}
              label="Where they live"
              value={info.location ?? 'Not recorded'}
            />
          </Group>

          <Group title="Standing">
            <Row
              icon={ShieldUserIcon}
              label="Strikes"
              value={`${info.strikeCount} of ${MAX_STRIKES}`}
            />
            <Row
              icon={ShieldUserIcon}
              label="Restriction"
              value={
                info.restrictedUntil === undefined
                  ? 'None'
                  : isSanctionActive(info.restrictedUntil)
                    ? `Active ${formatSanctionExpiry(info.restrictedUntil)} (${formatTimeLeft(info.restrictedUntil)})`
                    : `Expired ${formatSanctionExpiry(info.restrictedUntil)}`
              }
            />
            <Row
              icon={ShieldUserIcon}
              label="Ban"
              value={
                info.bannedUntil === undefined
                  ? 'None'
                  : isSanctionActive(info.bannedUntil)
                    ? `Active ${formatSanctionExpiry(info.bannedUntil)} (${formatTimeLeft(info.bannedUntil)})`
                    : `Expired ${formatSanctionExpiry(info.bannedUntil)}`
              }
            />
          </Group>
        </View>
      )}

      {visible && !token && (
        <Text style={styles.locked}>
          Your moderator session has expired. Close this and unlock again.
        </Text>
      )}
    </FormModal>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon: IconSvgElement;
  label: string;
  value: string;
  // IP addresses read much better in a fixed-pitch face.
  mono?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <HugeiconsIcon icon={icon} size={17} color={colors.white} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, mono && styles.rowValueMono]} selectable>
          {value}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    groups: {
      gap: 26,
    },
    groupTitle: {
      marginBottom: 10,
      fontSize: 13,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    card: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      paddingHorizontal: 15,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    rowText: {
      flex: 1,
      gap: 3,
    },
    rowLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    rowValue: {
      ...typography.bodyBold,
      color: colors.white,
    },
    rowValueMono: {
      fontFamily: 'monospace',
      fontSize: 14,
      letterSpacing: 0.3,
    },
    locked: {
      ...typography.callout,
      color: colors.errorText,
    },
  });
