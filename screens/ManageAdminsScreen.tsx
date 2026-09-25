import AppTextInput from '../components/AppTextInput';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useAction } from 'convex/react';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  Search01Icon,
  ShieldUserIcon,
  SquareLock01Icon,
  ViewIcon,
  ViewOffSlashIcon,
} from '@hugeicons/core-free-icons';
import AnimatedPressable from '../components/AnimatedPressable';
import FormModal from '../components/FormModal';
import NativePopup from '../components/nativepopup';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import VerifiedBadge from '../components/VerifiedBadge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { readableError } from '../errorMessage';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

type PendingChange = {
  userId: Id<'users'>;
  username: string;
  makeMod: boolean;
};

// The Main Admin's roster page. Search anyone up, grant or revoke moderator
// access — and confirm each individual change with the account password,
// every time. No session shortcut here: appointing a moderator is the one
// action that can hand someone else the rest of these tools.
export default function ManageAdminsScreen({
  adminId,
  onBack,
}: {
  adminId: Id<'users'>;
  onBack: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const setModRole = useAction(api.moderationAuth.setModRole);

  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ title: string; message: string } | null>(null);

  const users = useQuery(api.moderation.searchUsersForAdmin, { adminId, search });

  const closeConfirm = () => {
    setPending(null);
    setPassword('');
    setShowPassword(false);
    setError('');
  };

  const confirmChange = async () => {
    if (!pending || !password || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const outcome = await setModRole({
        adminId,
        targetUserId: pending.userId,
        makeMod: pending.makeMod,
        password,
      });
      closeConfirm();
      setResult({
        title: outcome.isMod ? 'Moderator added' : 'Moderator removed',
        message: outcome.isMod
          ? `@${outcome.username} can now review reports and use the moderation tools.`
          : `@${outcome.username} no longer has any moderator access, and any unlocked session they had is now closed.`,
      });
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const showingRoster = search.trim().length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} accessibilityLabel="Go back">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>Manage Admins</Text>
      </View>

      <View style={styles.searchWrap}>
        <HugeiconsIcon icon={Search01Icon} size={19} color={colors.textMuted} />
        <AppTextInput
          style={styles.searchInput}
          placeholder="Search a username"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>
          {showingRoster ? 'Current moderators' : 'Search results'}
        </Text>

        {users && users.length === 0 && (
          <EmptyState
            icon={ShieldUserIcon}
            message={
              showingRoster
                ? 'No moderators yet. Search a username to appoint one.'
                : 'Nobody matches that username.'
            }
            style={styles.emptyState}
          />
        )}

        {users?.map((user) => {
          const displayName = user.name ?? user.username ?? 'Someone';
          const letter = (user.username ?? displayName).charAt(0).toUpperCase();
          const gradient = (user.avatarGradient as [string, string]) ?? [
            colors.red,
            colors.coral,
          ];

          return (
            <View key={user._id} style={styles.row}>
              <View style={styles.avatar}>
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <LinearGradient colors={gradient} style={styles.avatarGradient}>
                    <Text style={styles.avatarLetter}>{letter}</Text>
                  </LinearGradient>
                )}
              </View>

              <View style={styles.rowText}>
                <View style={styles.nameLine}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <VerifiedBadge verified={user.isVerified} size={14} />
                </View>
                <Text style={styles.rowUsername} numberOfLines={1}>
                  @{user.username}
                  {user.isMod ? ' · Moderator' : ''}
                </Text>
              </View>

              <AnimatedPressable
                onPress={() =>
                  setPending({
                    userId: user._id as Id<'users'>,
                    username: user.username ?? 'this account',
                    makeMod: !user.isMod,
                  })
                }
              >
                <View style={[styles.roleButton, user.isMod && styles.roleButtonRevoke]}>
                  <Text
                    style={[styles.roleLabel, user.isMod && styles.roleLabelRevoke]}
                  >
                    {user.isMod ? 'Revoke' : 'Make mod'}
                  </Text>
                </View>
              </AnimatedPressable>
            </View>
          );
        })}
      </ScrollView>

      {/* Every single change is re-authorised with the password. */}
      <FormModal
        visible={pending !== null}
        title={pending?.makeMod ? 'Confirm new moderator' : 'Confirm revoking access'}
        subtitle={
          pending
            ? pending.makeMod
              ? `@${pending.username} will be able to review reports, take content down, and restrict, warn, ban, verify and strike accounts.`
              : `@${pending.username} will immediately lose every moderator tool, and any unlocked session they hold is closed.`
            : ''
        }
        icon={SquareLock01Icon}
        onClose={closeConfirm}
        footer={
          <PrimaryButton
            label={pending?.makeMod ? 'Make moderator' : 'Revoke access'}
            tone={pending?.makeMod ? 'primary' : 'danger'}
            loading={submitting}
            disabled={password.length === 0}
            onPress={confirmChange}
          />
        }
      >
        <Text style={styles.confirmLabel}>Your Main Admin password</Text>
        <View style={styles.passwordWrap}>
          <AppTextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Password"
            placeholderTextColor={colors.placeholder}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (error) setError('');
            }}
            onSubmitEditing={confirmChange}
            returnKeyType="go"
          />
          <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
            <HugeiconsIcon
              icon={showPassword ? ViewOffSlashIcon : ViewIcon}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        </View>
        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </FormModal>

      <NativePopup
        visible={result !== null}
        title={result?.title ?? ''}
        message={result?.message ?? ''}
        confirmLabel="Done"
        showCancel={false}
        onClose={() => setResult(null)}
        onConfirm={() => setResult(null)}
      />

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const AVATAR_SIZE = 46;

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
      paddingHorizontal: space.xl,
      gap: space.md,
      paddingBottom: space.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...typography.h1,
      color: colors.white,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      marginHorizontal: space.lg,
      paddingHorizontal: space.md,
      height: 50,
      borderRadius: radius.input,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.white,
    },
    scroll: {
      flex: 1,
    },
    list: {
      paddingHorizontal: space.lg,
      paddingTop: space.lg,
      paddingBottom: space.xxl,
    },
    sectionTitle: {
      marginBottom: space.md,
      ...typography.caption,
      fontFamily: 'Poppins_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    emptyState: {
      marginTop: space.xl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingVertical: space.xs,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    avatarGradient: {
      flex: 1,
      borderRadius: AVATAR_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImage: {
      flex: 1,
      borderRadius: AVATAR_SIZE / 2,
    },
    avatarLetter: {
      ...typography.h3,
      color: '#ffffff',
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    nameLine: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rowName: {
      ...typography.bodyBold,
      color: colors.white,
      flexShrink: 1,
    },
    rowUsername: {
      ...typography.footnote,
      color: colors.textMuted,
    },
    roleButton: {
      paddingHorizontal: space.md,
      height: 36,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white,
    },
    roleButtonRevoke: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.red,
    },
    roleLabel: {
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.black,
    },
    roleLabelRevoke: {
      color: colors.red,
    },
    confirmLabel: {
      marginBottom: space.xs,
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    passwordWrap: {
      justifyContent: 'center',
    },
    input: {
      fontFamily: 'Poppins_400Regular',
      height: 56,
      borderRadius: radius.input,
      paddingHorizontal: 22,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.white,
      fontSize: 16,
    },
    passwordInput: {
      paddingRight: 52,
    },
    eyeButton: {
      position: 'absolute',
      right: 18,
      height: 56,
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    error: {
      marginTop: space.md,
      ...typography.footnote,
      color: colors.errorText,
    },
  });
