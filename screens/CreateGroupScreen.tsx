import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import Skeleton from '../components/Skeleton';
import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, space, typography } from '../theme';

// "Create Group": name it, pick who to add from people you follow — they're
// added straight in (no invite to accept) and get a plain message in their DM
// with you (see convex/groups.ts createGroup). Anyone can leave later.
export default function CreateGroupScreen({
  userId,
  onBack,
  onCreated,
}: {
  userId: Id<'users'>;
  onBack: () => void;
  onCreated: (groupId: Id<'groupChats'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation(['createGroup', 'common']);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Id<'users'>[]>([]);
  const [creating, setCreating] = useState(false);

  const people = useQuery(api.follows.listFollowingForNewMessage, { userId });
  const createGroup = useMutation(api.groups.createGroup);

  const toggle = (id: Id<'users'>) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]
    );
  };

  const canCreate = name.trim().length > 0 && selectedIds.length > 0 && !creating;

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const groupId = await createGroup({ creatorId: userId, name: name.trim(), memberIds: selectedIds });
      if (groupId) onCreated(groupId);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} accessibilityLabel={t('goBackLabel')}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>{t('title')}</Text>
      </View>

      <TextField
        style={styles.nameInput}
        placeholder={t('groupNamePlaceholder')}
        value={name}
        onChangeText={setName}
        cursorColor={colors.coral}
        maxLength={40}
      />

      <Text style={styles.sectionLabel}>
        {selectedIds.length > 0 ? t('selectedCount', { count: selectedIds.length }) : t('addPeople')}
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {people === undefined &&
          [0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.row}>
              <Skeleton style={styles.avatarSkeleton} />
              <View style={styles.rowText}>
                <Skeleton style={styles.nameSkeleton} />
                <Skeleton style={styles.usernameSkeleton} />
              </View>
            </View>
          ))}

        {people?.length === 0 && (
          <EmptyState message={t('followToAddEmpty')} style={styles.empty} />
        )}

        {people?.map((person) => {
          const displayName = person.name ?? person.username ?? 'Someone';
          const letter = (person.username ?? displayName).charAt(0).toUpperCase();
          const gradient = (person.avatarGradient as [string, string]) ?? [colors.red, colors.coral];
          const selected = selectedIds.includes(person._id as Id<'users'>);

          return (
            <Pressable
              key={person._id}
              style={styles.row}
              onPress={() => toggle(person._id as Id<'users'>)}
            >
              <View style={styles.avatar}>
                {person.avatarUrl ? (
                  <Image source={{ uri: person.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <LinearGradient colors={gradient} style={styles.avatarGradient}>
                    <Text style={styles.avatarLetter}>{letter}</Text>
                  </LinearGradient>
                )}
              </View>

              <View style={styles.rowText}>
                <Text style={styles.name}>{displayName}</Text>
                {person.username && <Text style={styles.username}>@{person.username}</Text>}
              </View>

              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected && <HugeiconsIcon icon={Tick02Icon} size={14} color={colors.black} />}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.createButtonWrap}>
        <PrimaryButton
          label={t('createGroupButton')}
          onPress={handleCreate}
          disabled={!canCreate}
          loading={creating}
        />
      </View>

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
      gap: space.md,
      paddingHorizontal: space.xl,
      paddingBottom: space.md,
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
    nameInput: {
      marginHorizontal: space.lg,
    },
    sectionLabel: {
      marginTop: space.lg,
      marginHorizontal: space.lg,
      ...typography.caption,
      fontFamily: 'Poppins_600SemiBold',
      letterSpacing: 0.5,
      color: colors.textMuted,
    },
    scroll: {
      flex: 1,
      marginTop: space.xxs,
    },
    list: {
      paddingHorizontal: space.lg,
      paddingBottom: space.lg,
    },
    empty: {
      marginTop: space.lg,
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
      ...typography.h3,
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
    avatarSkeleton: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
    },
    nameSkeleton: {
      width: 130,
      height: 15,
      borderRadius: 7,
    },
    usernameSkeleton: {
      marginTop: 6,
      width: 90,
      height: 13,
      borderRadius: 6,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: colors.white,
      borderColor: colors.white,
    },
    createButtonWrap: {
      marginHorizontal: space.lg,
      marginBottom: space.xl,
    },
  });
