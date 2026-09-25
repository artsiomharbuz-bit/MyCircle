import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { RepeatIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import RemixSheet from './RemixSheet';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export default function SharePostSheet({
  visible,
  userId,
  postId,
  mediaUrl,
  mediaType,
  canRemix = false,
  onClose,
}: {
  visible: boolean;
  userId: Id<'users'>;
  postId: Id<'posts'> | null;
  // Only needed for the "Remix to a Circle" shortcut below — everything
  // else here (sending to a DM) only needs the postId.
  mediaUrl?: string | null;
  mediaType?: 'photo' | 'video';
  // Only global clips (i.e. seen via Explore) can be remixed — never posts,
  // and never anything that lives inside a circle.
  canRemix?: boolean;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [selectedIds, setSelectedIds] = useState<Id<'users'>[]>([]);
  const [sending, setSending] = useState(false);
  const [remixVisible, setRemixVisible] = useState(false);

  const people = useQuery(
    api.follows.listFollowingForNewMessage,
    visible ? { userId } : 'skip'
  );
  const sendMessage = useMutation(api.messages.sendMessage);

  const toggle = (id: Id<'users'>) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    );
  };

  const handleClose = () => {
    setSelectedIds([]);
    onClose();
  };

  const handleSend = async () => {
    if (!postId || selectedIds.length === 0 || sending) return;
    setSending(true);
    try {
      await Promise.all(
        selectedIds.map((recipientId) =>
          sendMessage({ senderId: userId, recipientId, text: '', sharedPostId: postId })
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
        <Text style={styles.heading}>Send to</Text>

        {canRemix && mediaType && (
          <Pressable style={styles.remixRow} onPress={() => setRemixVisible(true)}>
            <View style={styles.remixIcon}>
              <HugeiconsIcon icon={RepeatIcon} size={18} color={colors.white} />
            </View>
            <Text style={styles.remixLabel}>Remix to a Circle</Text>
          </Pressable>
        )}

        {people?.length === 0 && (
          <Text style={styles.emptyText}>Follow people to share with them.</Text>
        )}

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {people?.map((person) => {
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
            styles.sendButton,
            (selectedIds.length === 0 || sending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={selectedIds.length === 0 || sending}
        >
          <Text style={styles.sendButtonText}>
            {sending
              ? 'Sending…'
              : selectedIds.length > 0
                ? `Send to ${selectedIds.length}`
                : 'Send'}
          </Text>
        </AnimatedPressable>
      </View>

      <RemixSheet
        visible={remixVisible}
        userId={userId}
        post={postId && mediaType ? { _id: postId, mediaUrl: mediaUrl ?? null, mediaType } : null}
        onClose={() => setRemixVisible(false)}
        onPosted={() => {
          setRemixVisible(false);
          handleClose();
        }}
      />
    </Modal>
  );
}

const AVATAR_SIZE = 44;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'transparent',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingHorizontal: space.xl,
      paddingTop: 12,
      paddingBottom: 40,
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
    remixRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 52,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    remixIcon: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    remixLabel: {
      ...typography.bodyBold,
      color: colors.white,
    },
    list: {
      maxHeight: 360,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
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
    sendButton: {
      marginTop: space.md,
      height: 52,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonBackground,
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
    sendButtonText: {
      ...typography.h3,
      color: colors.buttonText,
    },
  });
