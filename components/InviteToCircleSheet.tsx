import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Tick02Icon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export default function InviteToCircleSheet({
  visible,
  userId,
  circleId,
  onClose,
}: {
  visible: boolean;
  userId: Id<'users'>;
  circleId: Id<'userCircles'> | null;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [selectedIds, setSelectedIds] = useState<Id<'users'>[]>([]);
  const [sending, setSending] = useState(false);

  const people = useQuery(
    api.follows.listFollowingForNewMessage,
    visible ? { userId } : 'skip'
  );
  const members = useQuery(
    api.userCircles.listCircleMembers,
    visible && circleId ? { circleId, viewerId: userId } : 'skip'
  );
  const inviteToCircle = useMutation(api.userCircles.inviteToCircle);

  const memberIds = new Set(members?.map((m) => m._id) ?? []);
  const invitable = people?.filter((p) => !memberIds.has(p._id));

  const toggle = (id: Id<'users'>) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    );
  };

  const handleClose = () => {
    setSelectedIds([]);
    onClose();
  };

  const handleInvite = async () => {
    if (!circleId || selectedIds.length === 0 || sending) return;
    setSending(true);
    try {
      await Promise.all(
        selectedIds.map((inviteeId) =>
          inviteToCircle({ circleId, inviterId: userId, inviteeId })
        )
      );
      handleClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.heading}>Add to Circle</Text>

        {invitable?.length === 0 && (
          <Text style={styles.emptyText}>Everyone you follow is already in this circle.</Text>
        )}

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {invitable?.map((person) => {
            const id = person._id as Id<'users'>;
            const isSelected = selectedIds.includes(id);
            const displayName = person.name ?? person.username ?? 'Someone';
            const letter = (person.username ?? displayName).charAt(0).toUpperCase();
            const gradient = (person.avatarGradient as [string, string]) ?? [
              colors.red,
              colors.coral,
            ];

            return (
              <Pressable key={person._id} style={styles.row} onPress={() => toggle(id)}>
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

                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <HugeiconsIcon icon={Tick02Icon} size={14} color={colors.black} />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <AnimatedPressable
          style={[
            styles.inviteButton,
            (selectedIds.length === 0 || sending) && styles.inviteButtonDisabled,
          ]}
          onPress={handleInvite}
          disabled={selectedIds.length === 0 || sending}
        >
          <Text style={styles.inviteButtonText}>
            {sending
              ? 'Inviting…'
              : selectedIds.length > 0
                ? `Add ${selectedIds.length}`
                : 'Add'}
          </Text>
        </AnimatedPressable>

        <Pressable onPress={handleClose}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const AVATAR_SIZE = 44;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
      maxHeight: '75%',
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
    emptyText: {
      ...typography.callout,
      color: colors.textMuted,
      paddingVertical: space.sm,
    },
    list: {
      maxHeight: 340,
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
    inviteButton: {
      marginTop: space.md,
      height: 52,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonBackground,
    },
    inviteButtonDisabled: {
      opacity: 0.4,
    },
    inviteButtonText: {
      ...typography.h3,
      color: colors.buttonText,
    },
    skipText: {
      marginTop: space.sm + 2,
      textAlign: 'center',
      ...typography.callout,
      color: colors.textMuted,
    },
  });
