import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Add01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export default function AccountSwitcherSheet({
  visible,
  currentUserId,
  accountIds,
  onClose,
  onSelectAccount,
  onAddAccount,
  unreadByAccount,
}: {
  visible: boolean;
  currentUserId: Id<'users'>;
  accountIds: Id<'users'>[];
  onClose: () => void;
  onSelectAccount: (userId: Id<'users'>) => void;
  onAddAccount: () => void;
  // Unread message count per other saved account.
  unreadByAccount?: Record<string, number>;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const accounts = useQuery(
    api.users.getUsersByIds,
    visible && accountIds.length > 0 ? { userIds: accountIds } : 'skip'
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.heading}>Accounts</Text>

        {accounts?.map((account) => {
          const isCurrent = account._id === currentUserId;
          const displayName = account.name ?? account.username ?? 'Someone';
          const letter = (account.username ?? displayName).charAt(0).toUpperCase();
          const gradient = (account.avatarGradient as [string, string]) ?? [
            colors.red,
            colors.coral,
          ];

          return (
            <AnimatedPressable
              key={account._id}
              onPress={() => onSelectAccount(account._id)}
              disabled={isCurrent}
            >
              <View style={styles.row}>
                <View style={styles.avatar}>
                  {account.avatarUrl ? (
                    <Image source={{ uri: account.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <LinearGradient colors={gradient} style={styles.avatarGradient}>
                      <Text style={styles.avatarLetter}>{letter}</Text>
                    </LinearGradient>
                  )}
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.name}>{displayName}</Text>
                  {account.username && <Text style={styles.username}>@{account.username}</Text>}
                </View>

                {!isCurrent && (unreadByAccount?.[account._id] ?? 0) > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text variant="micro" style={styles.unreadText}>
                      {unreadByAccount![account._id] > 99 ? '99+' : unreadByAccount![account._id]}
                    </Text>
                  </View>
                )}

                {isCurrent && (
                  <HugeiconsIcon icon={Tick02Icon} size={20} color={colors.coral} />
                )}
              </View>
            </AnimatedPressable>
          );
        })}

        <AnimatedPressable onPress={onAddAccount}>
          <View style={styles.addRow}>
            <View style={styles.addIcon}>
              <HugeiconsIcon icon={Add01Icon} size={18} color={colors.white} />
            </View>
            <Text style={styles.addText}>Add Account</Text>
          </View>
        </AnimatedPressable>
      </View>
    </Modal>
  );
}

const AVATAR_SIZE = 44;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red,
  },
  unreadText: {
    color: '#ffffff',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.xxxl - 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.buttonSecondary,
    marginBottom: space.lg,
  },
  heading: {
    ...typography.h2,
    color: colors.white,
    marginBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs + 2,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.border,
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
    fontSize: 17,
    // Always literal white, not the theme-flipped `colors.white` — the letter
    // sits on a colorful/dark gradient regardless of app theme.
    color: '#ffffff',
  },
  rowText: {
    flex: 1,
  },
  name: {
    ...typography.bodyBold,
    color: colors.white,
  },
  username: {
    marginTop: 2,
    ...typography.footnote,
    color: colors.textMuted,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md - 2,
    marginTop: space.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addIcon: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.buttonBackground,
  },
  addText: {
    ...typography.bodyBold,
    color: colors.white,
  },
});
