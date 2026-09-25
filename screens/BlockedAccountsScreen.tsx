import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import FadeInView from '../components/FadeInView';
import EmptyState from '../components/EmptyState';
import { HEADER_HEIGHT } from '../components/CollapsibleHeader';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';
import { UserBlock01Icon } from '@hugeicons/core-free-icons';

export default function BlockedAccountsScreen({
  userId,
  onBack,
}: {
  userId: Id<'users'>;
  onBack: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const blocked = useQuery(api.blocks.listBlockedUsers, { userId });
  const unblockUser = useMutation(api.blocks.unblockUser);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {blocked?.map((user) => {
          const letter = (user.username ?? '?').charAt(0).toUpperCase();
          const gradient = (user.avatarGradient as [string, string]) ?? [colors.red, colors.coral];

          return (
            <FadeInView key={user._id}>
              <View style={styles.userRow}>
                <View style={styles.avatar}>
                  {user.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <LinearGradient colors={gradient} style={styles.avatarGradient}>
                      <Text style={styles.avatarLetter}>{letter}</Text>
                    </LinearGradient>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userUsername}>@{user.username}</Text>
                </View>
                <Pressable
                  style={styles.unblockButton}
                  onPress={() => unblockUser({ blockerId: userId, blockedId: user._id as Id<'users'> })}
                >
                  <Text style={styles.unblockButtonText}>Unblock</Text>
                </Pressable>
              </View>
            </FadeInView>
          );
        })}

        {blocked && blocked.length === 0 && (
          <EmptyState
            icon={UserBlock01Icon}
            message="You haven't blocked anyone."
            style={styles.emptyState}
          />
        )}
      </ScrollView>

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>Blocked accounts</Text>
      </View>

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
      ...typography.h2,
      color: colors.white,
    },
    list: {
      paddingHorizontal: space.xl,
      paddingTop: HEADER_HEIGHT + space.md,
      paddingBottom: space.xl,
      gap: space.md,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
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
      ...typography.bodyBold,
      color: '#ffffff',
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      ...typography.bodyBold,
      color: colors.white,
    },
    userUsername: {
      marginTop: 2,
      ...typography.footnote,
      color: colors.textMuted,
    },
    unblockButton: {
      height: 36,
      paddingHorizontal: space.md,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonSecondary,
    },
    unblockButtonText: {
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.white,
    },
    emptyState: {
      marginTop: space.xxxl,
    },
  });
