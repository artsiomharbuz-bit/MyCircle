import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  Delete02Icon,
  Image02Icon,
  Logout01Icon,
  NotificationOff01Icon,
  PaletteIcon,
  PlayIcon,
} from '@hugeicons/core-free-icons';
import AnimatedPressable from '../components/AnimatedPressable';
import ChatBackgroundSheet from '../components/ChatBackgroundSheet';
import GroupAvatarStack from '../components/GroupAvatarStack';
import MediaViewerModal, { ViewerMedia } from '../components/MediaViewerModal';
import NativePopup from '../components/nativepopup';
import VerifiedBadge from '../components/VerifiedBadge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space } from '../theme';
import { ChatBackground, getChatBackground, setChatBackground } from '../chatBackgrounds';
import { BubbleStyleKey, DEFAULT_BUBBLE_STYLE, getChatBubbleStyle, setChatBubbleStyle } from '../chatBubbleStyle';
import { getChatMuted, setChatMuted } from '../chatMute';
import { setGroupClearedAt } from '../groupClear';

// The group's counterpart of ChatInfoScreen — reached from the 3-dot button
// in the group chat header. Mute, background/bubble customization and clear
// chat are per-viewer and local to this device, like in a 1:1 chat.
export default function GroupInfoScreen({
  groupId,
  currentUserId,
  onBack,
  onChatCleared,
  onLeft,
}: {
  groupId: Id<'groupChats'>;
  currentUserId: Id<'users'>;
  onBack: () => void;
  onChatCleared: () => void;
  onLeft: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const localKey = `group-${groupId}`;

  const group = useQuery(api.groups.getGroupInviteInfo, { groupId, viewerId: currentUserId });
  const members = useQuery(api.groups.listGroupMembers, { groupId, viewerId: currentUserId });
  const messages = useQuery(api.groups.listGroupMessages, { groupId, viewerId: currentUserId });
  const leaveGroup = useMutation(api.groups.leaveGroup);

  const media = messages?.filter((m) => !!m.mediaUrl) ?? [];

  const [muted, setMuted] = useState(false);
  const [background, setBackground] = useState<ChatBackground | null>(null);
  const [bubbleStyle, setBubbleStyle] = useState<BubbleStyleKey>(DEFAULT_BUBBLE_STYLE);
  const [backgroundSheetVisible, setBackgroundSheetVisible] = useState(false);
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<ViewerMedia | null>(null);

  useEffect(() => {
    getChatMuted(currentUserId, localKey).then(setMuted);
    getChatBackground(currentUserId, localKey).then(setBackground);
    getChatBubbleStyle(currentUserId, localKey).then(setBubbleStyle);
  }, [currentUserId, localKey]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setChatMuted(currentUserId, localKey, next);
  };

  const selectBackground = (next: ChatBackground | null) => {
    setBackground(next);
    setChatBackground(currentUserId, localKey, next);
  };

  const selectBubbleStyle = (next: BubbleStyleKey) => {
    setBubbleStyle(next);
    setChatBubbleStyle(currentUserId, localKey, next);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AnimatedPressable style={styles.backButton} onPress={onBack}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </AnimatedPressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileBlock}>
          <GroupAvatarStack members={members ?? []} size={96} />
          <Text variant="h2" style={styles.name}>{group?.name ?? 'Group'}</Text>
          <Text variant="callout" style={styles.meta}>
            {members ? `${members.length} member${members.length === 1 ? '' : 's'}` : ''}
          </Text>
        </View>

        <View style={styles.optionsCard}>
          <Pressable style={styles.optionRow} onPress={toggleMute}>
            <View style={styles.optionIcon}>
              <HugeiconsIcon icon={NotificationOff01Icon} size={19} color={colors.white} />
            </View>
            <Text variant="body" style={styles.optionLabel}>Mute notifications</Text>
            <View style={[styles.toggle, muted && styles.toggleOn]}>
              <View style={[styles.toggleKnob, muted && styles.toggleKnobOn]} />
            </View>
          </Pressable>

          <View style={styles.optionDivider} />

          <Pressable style={styles.optionRow} onPress={() => setBackgroundSheetVisible(true)}>
            <View style={styles.optionIcon}>
              <HugeiconsIcon icon={PaletteIcon} size={19} color={colors.white} />
            </View>
            <Text variant="body" style={styles.optionLabel}>Customize chat</Text>
          </Pressable>

          <View style={styles.optionDivider} />

          <Pressable style={styles.optionRow} onPress={() => setClearConfirmVisible(true)}>
            <View style={styles.optionIcon}>
              <HugeiconsIcon icon={Delete02Icon} size={19} color={colors.errorText} />
            </View>
            <Text variant="body" style={[styles.optionLabel, styles.optionLabelDanger]}>Clear chat</Text>
          </Pressable>

          <View style={styles.optionDivider} />

          <Pressable style={styles.optionRow} onPress={() => setLeaveConfirmVisible(true)}>
            <View style={styles.optionIcon}>
              <HugeiconsIcon icon={Logout01Icon} size={19} color={colors.errorText} />
            </View>
            <Text variant="body" style={[styles.optionLabel, styles.optionLabelDanger]}>Leave group</Text>
          </Pressable>
        </View>

        <Text variant="calloutBold" style={styles.sectionTitle}>Members</Text>
        {members?.map((member) => {
          const displayName = member.name ?? member.username ?? 'Someone';
          const letter = (member.username ?? displayName).charAt(0).toUpperCase();
          const gradient = (member.avatarGradient as [string, string]) ?? [colors.red, colors.coral];
          return (
            <View key={member._id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                {member.avatarUrl ? (
                  <Image source={{ uri: member.avatarUrl }} style={styles.memberAvatarImage} />
                ) : (
                  <LinearGradient colors={gradient} style={styles.memberAvatarGradient}>
                    <Text style={styles.memberAvatarLetter}>{letter}</Text>
                  </LinearGradient>
                )}
              </View>
              <View style={styles.memberText}>
                <View style={styles.memberNameRow}>
                  <Text variant="bodyBold" style={styles.memberName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <VerifiedBadge verified={member.isVerified} size={14} />
                </View>
                {member.username && (
                  <Text variant="footnote" style={styles.meta}>@{member.username}</Text>
                )}
              </View>
            </View>
          );
        })}

        <Text variant="calloutBold" style={styles.sectionTitle}>Media in this chat</Text>

        {messages && media.length === 0 && (
          <View style={styles.emptyMedia}>
            <HugeiconsIcon icon={Image02Icon} size={26} color={colors.textMuted} />
            <Text variant="footnote" style={styles.meta}>No photos or videos yet</Text>
          </View>
        )}

        <FlatList
          data={media}
          scrollEnabled={false}
          keyExtractor={(item) => item._id}
          numColumns={3}
          columnWrapperStyle={styles.mediaRow}
          contentContainerStyle={styles.mediaGrid}
          renderItem={({ item }) => (
            <Pressable
              style={styles.mediaTile}
              onPress={() =>
                item.mediaUrl && setPreviewMedia({ uri: item.mediaUrl, type: item.mediaType! })
              }
            >
              {item.mediaUrl && item.mediaType === 'photo' && (
                <Image source={{ uri: item.mediaUrl }} style={styles.mediaTileImage} />
              )}
              {item.mediaType === 'video' && (
                <View style={styles.mediaPlayOverlay}>
                  <HugeiconsIcon icon={PlayIcon} size={18} color="#ffffff" />
                </View>
              )}
            </Pressable>
          )}
        />
      </ScrollView>

      <ChatBackgroundSheet
        visible={backgroundSheetVisible}
        selected={background}
        bubbleStyle={bubbleStyle}
        viewerId={currentUserId}
        otherUserId={localKey}
        onSelect={selectBackground}
        onSelectBubbleStyle={selectBubbleStyle}
        onClose={() => setBackgroundSheetVisible(false)}
      />

      <NativePopup
        visible={clearConfirmVisible}
        title="Clear this chat?"
        message="This removes the messages from your view. It won't delete them for anyone else."
        confirmLabel="Clear chat"
        onClose={() => setClearConfirmVisible(false)}
        onConfirm={async () => {
          await setGroupClearedAt(currentUserId, groupId, Date.now());
          onChatCleared();
        }}
      />

      <NativePopup
        visible={leaveConfirmVisible}
        title="Leave this group?"
        message="You'll stop seeing this group and its messages. You can only rejoin if someone invites you again."
        confirmLabel="Leave group"
        onClose={() => setLeaveConfirmVisible(false)}
        onConfirm={async () => {
          await leaveGroup({ groupId, userId: currentUserId });
          onLeft();
        }}
      />

      <MediaViewerModal media={previewMedia} onClose={() => setPreviewMedia(null)} />
    </View>
  );
}

const TILE_GAP = 3;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.lg,
      paddingTop: 56,
      paddingBottom: space.xs,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingBottom: space.xxxl,
    },
    profileBlock: {
      alignItems: 'center',
      paddingVertical: space.lg,
    },
    name: {
      color: colors.white,
      marginTop: space.md,
      textAlign: 'center',
      paddingHorizontal: space.xl,
    },
    meta: {
      color: colors.textMuted,
      marginTop: 2,
    },
    optionsCard: {
      marginHorizontal: space.lg,
      backgroundColor: colors.inputBackground,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.md,
      minHeight: 56,
    },
    optionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 60,
    },
    optionIcon: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionLabel: {
      flex: 1,
      color: colors.white,
    },
    optionLabelDanger: {
      color: colors.errorText,
    },
    toggle: {
      width: 44,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.buttonSecondary,
      padding: 3,
    },
    toggleOn: {
      backgroundColor: colors.coral,
    },
    toggleKnob: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#ffffff',
    },
    toggleKnobOn: {
      transform: [{ translateX: 18 }],
    },
    sectionTitle: {
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: space.xl,
      marginBottom: space.xs,
      marginHorizontal: space.lg,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.lg,
      paddingVertical: space.xs,
    },
    memberAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: 'hidden',
    },
    memberAvatarImage: {
      flex: 1,
    },
    memberAvatarGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberAvatarLetter: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 17,
      color: '#ffffff',
    },
    memberText: {
      flex: 1,
    },
    memberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    memberName: {
      color: colors.white,
      flexShrink: 1,
    },
    emptyMedia: {
      alignItems: 'center',
      gap: space.xs,
      paddingVertical: space.xl,
    },
    mediaGrid: {
      paddingHorizontal: space.lg,
      gap: TILE_GAP,
    },
    mediaRow: {
      gap: TILE_GAP,
    },
    mediaTile: {
      flex: 1 / 3,
      aspectRatio: 1,
      borderRadius: radius.xs,
      overflow: 'hidden',
      backgroundColor: colors.inputBackground,
    },
    mediaTileImage: {
      flex: 1,
    },
    mediaPlayOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
  });
