import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AddTeamIcon, ArrowRight01Icon, GroupIcon, Logout01Icon, Sorting05Icon } from '@hugeicons/core-free-icons';
import NativePopup from './nativepopup';
import Text from './AppText';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export default function CircleActionsSheet({
  visible,
  circle,
  userId,
  onClose,
  onReorder,
  onOpenGroupChat,
  onLeft,
}: {
  visible: boolean;
  circle: { id: Id<'userCircles'>; label: string; color: string; ownerId: Id<'users'> } | null;
  userId: Id<'users'>;
  onClose: () => void;
  onReorder: () => void;
  // Only the circle's owner gets the "Create group chat" option below.
  onOpenGroupChat: (groupId: Id<'groupChats'>) => void;
  // Called after the viewer leaves this circle.
  onLeft?: (circleId: Id<'userCircles'>) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [showMembers, setShowMembers] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const members = useQuery(
    api.userCircles.listCircleMembers,
    visible && showMembers && circle ? { circleId: circle.id, viewerId: userId } : 'skip'
  );
  const createGroupFromCircle = useMutation(api.groups.createGroupFromCircle);
  const leaveCircle = useMutation(api.userCircles.leaveCircle);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const close = () => {
    setShowMembers(false);
    onClose();
  };

  const createGroup = async () => {
    if (!circle || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const groupId = await createGroupFromCircle({
        circleId: circle.id,
        creatorId: userId,
        name: circle.label,
      });
      if (groupId) {
        close();
        onOpenGroupChat(groupId);
      }
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: circle?.color ?? colors.coral }]} />
          <View style={styles.titleText}>
            <Text style={styles.eyebrow}>CIRCLE SETTINGS</Text>
            <Text style={styles.title}>{circle?.label ?? 'Circle'}</Text>
          </View>
        </View>

        {showMembers ? (
          <>
            <Pressable onPress={() => setShowMembers(false)}>
              <Text style={styles.back}>Back</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>Members</Text>
            <ScrollView style={styles.members}>
              {members === undefined ? (
                <Text style={styles.muted}>Loading members...</Text>
              ) : members.length === 0 ? (
                <Text style={styles.muted}>No members yet.</Text>
              ) : (
                members.map((member) => (
                  <View key={member._id} style={styles.memberRow}>
                    <View style={styles.avatar}>
                      {member.avatarUrl ? (
                        <Image source={{ uri: member.avatarUrl }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarLetter}>
                          {(member.username ?? member.name ?? '?').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.memberName}>
                      {member.name ?? member.username ?? 'Someone'}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </>
        ) : (
          <>
            <Pressable style={styles.option} onPress={() => setShowMembers(true)}>
              <View style={styles.optionIcon}>
                <HugeiconsIcon icon={GroupIcon} size={19} color={colors.white} />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionText}>View members</Text>
                <Text style={styles.optionHint}>See everyone in this circle</Text>
              </View>
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable
              style={styles.option}
              onPress={() => {
                onReorder();
                close();
              }}
            >
              <View style={styles.optionIcon}>
                <HugeiconsIcon icon={Sorting05Icon} size={19} color={colors.white} />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionText}>Reorder circles</Text>
                <Text style={styles.optionHint}>Change where circles appear on Home</Text>
              </View>
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.textMuted} />
            </Pressable>
            {circle?.ownerId === userId && (
              <Pressable style={styles.option} onPress={createGroup} disabled={creatingGroup}>
                <View style={styles.optionIcon}>
                  <HugeiconsIcon icon={AddTeamIcon} size={19} color={colors.white} />
                </View>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionText}>
                    {creatingGroup ? 'Creating group…' : 'Create group chat'}
                  </Text>
                  <Text style={styles.optionHint}>Add everyone in this circle to a group</Text>
                </View>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.textMuted} />
              </Pressable>
            )}
            {circle && circle.ownerId !== userId && (
              <Pressable style={styles.option} onPress={() => setConfirmLeave(true)}>
                <View style={styles.optionIcon}>
                  <HugeiconsIcon icon={Logout01Icon} size={19} color={colors.errorText} />
                </View>
                <View style={styles.optionTextWrap}>
                  <Text style={[styles.optionText, { color: colors.errorText }]}>Leave circle</Text>
                  <Text style={styles.optionHint}>You'll stop seeing this circle's posts</Text>
                </View>
              </Pressable>
            )}
            <Pressable style={styles.cancel} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </>
        )}
      </View>
      <NativePopup
        visible={confirmLeave}
        title="Leave this circle?"
        message="You'll stop seeing this circle's posts. Someone in it can add you back."
        confirmLabel="Leave circle"
        onClose={() => setConfirmLeave(false)}
        onConfirm={async () => {
          if (!circle) return;
          await leaveCircle({ circleId: circle.id, userId });
          onLeft?.(circle.id);
          close();
        }}
      />
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'transparent' },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      padding: space.xl,
      paddingBottom: space.xxxl - 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.buttonSecondary, marginBottom: space.lg },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg + 2 },
    dot: { width: 14, height: 14, borderRadius: 7 },
    titleText: { flex: 1, gap: 3 },
    eyebrow: { color: colors.textMuted, ...typography.micro, letterSpacing: 1 },
    title: { color: colors.white, ...typography.h2 },
    option: { minHeight: 78, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm + 2, paddingVertical: space.sm, backgroundColor: colors.inputBackground, marginTop: space.xs + 2, borderWidth: 1, borderColor: colors.border },
    optionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
    optionTextWrap: { flex: 1, minWidth: 0, gap: 3 },
    optionText: { color: colors.white, ...typography.bodyBold, lineHeight: 20 },
    optionHint: { color: colors.textMuted, ...typography.caption, lineHeight: 17, flexShrink: 1 },
    cancel: { alignItems: 'center', marginTop: space.md },
    cancelText: { color: colors.textMuted, ...typography.callout },
    back: { color: colors.textMuted, marginBottom: space.sm },
    sectionTitle: { color: colors.white, ...typography.h3, marginBottom: space.xs },
    members: { maxHeight: 300 },
    muted: { color: colors.textMuted, paddingVertical: space.md },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, paddingVertical: space.xs },
    avatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.buttonSecondary, alignItems: 'center', justifyContent: 'center' },
    avatarImage: { flex: 1, width: '100%' },
    avatarLetter: { color: colors.white, fontFamily: 'Poppins_600SemiBold' },
    memberName: { color: colors.white, ...typography.callout },
  });
