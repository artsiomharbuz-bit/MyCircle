import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  Delete02Icon,
  Image02Icon,
  NotificationOff01Icon,
  PaletteIcon,
  PlayIcon,
} from '@hugeicons/core-free-icons';
import AnimatedPressable from '../components/AnimatedPressable';
import ChatBackgroundSheet from '../components/ChatBackgroundSheet';
import NativePopup from '../components/nativepopup';
import MediaViewerModal from '../components/MediaViewerModal';
import VerifiedBadge from '../components/VerifiedBadge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space } from '../theme';
import { ChatBackground, getChatBackground, setChatBackground } from '../chatBackgrounds';
import { BubbleStyleKey, DEFAULT_BUBBLE_STYLE, getChatBubbleStyle, setChatBubbleStyle } from '../chatBubbleStyle';
import { getChatMuted, setChatMuted } from '../chatMute';

export default function ChatInfoScreen({
  currentUserId,
  otherUserId,
  onBack,
  onChatCleared,
}: {
  currentUserId: Id<'users'>;
  otherUserId: Id<'users'>;
  onBack: () => void;
  onChatCleared: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const otherUser = useQuery(api.users.getUser, { userId: otherUserId, viewerId: currentUserId });
  const media = useQuery(api.messages.listChatMedia, { userId: currentUserId, otherUserId });
  const clearConversation = useMutation(api.messages.clearConversation);

  const [muted, setMuted] = useState(false);
  const [background, setBackground] = useState<ChatBackground | null>(null);
  const [bubbleStyle, setBubbleStyle] = useState<BubbleStyleKey>(DEFAULT_BUBBLE_STYLE);
  const [backgroundSheetVisible, setBackgroundSheetVisible] = useState(false);
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ uri: string; type: 'photo' | 'video' } | null>(null);

  useEffect(() => {
    getChatMuted(currentUserId, otherUserId).then(setMuted);
    getChatBackground(currentUserId, otherUserId).then(setBackground);
    getChatBubbleStyle(currentUserId, otherUserId).then(setBubbleStyle);
  }, [currentUserId, otherUserId]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setChatMuted(currentUserId, otherUserId, next);
  };

  const selectBackground = (next: ChatBackground | null) => {
    setBackground(next);
    setChatBackground(currentUserId, otherUserId, next);
  };

  const selectBubbleStyle = (next: BubbleStyleKey) => {
    setBubbleStyle(next);
    setChatBubbleStyle(currentUserId, otherUserId, next);
  };

  const displayName = otherUser?.name ?? otherUser?.username ?? 'Someone';
  const letter = (otherUser?.username ?? displayName).charAt(0).toUpperCase();
  const gradient = (otherUser?.avatarGradient as [string, string]) ?? [colors.red, colors.coral];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AnimatedPressable style={styles.backButton} onPress={onBack}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </AnimatedPressable>
      </View>

      <View style={styles.profileBlock}>
        <View style={styles.avatarLarge}>
          {otherUser?.avatarUrl ? (
            <Image source={{ uri: otherUser.avatarUrl }} style={styles.avatarLargeImage} />
          ) : (
            <LinearGradient colors={gradient} style={styles.avatarLargeGradient}>
              <Text style={styles.avatarLargeLetter}>{letter}</Text>
            </LinearGradient>
          )}
        </View>
        <View style={styles.nameRow}>
          <Text variant="h2" style={styles.name}>{displayName}</Text>
          <VerifiedBadge verified={otherUser?.isVerified} size={18} />
        </View>
        {otherUser?.username && (
          <Text variant="callout" style={styles.username}>@{otherUser.username}</Text>
        )}
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
          <View style={[styles.optionIcon, styles.optionIconDanger]}>
            <HugeiconsIcon icon={Delete02Icon} size={19} color={colors.errorText} />
          </View>
          <Text variant="body" style={[styles.optionLabel, styles.optionLabelDanger]}>Clear chat</Text>
        </Pressable>
      </View>

      <Text variant="calloutBold" style={styles.sectionTitle}>Media in this chat</Text>

      {media?.length === 0 && (
        <View style={styles.emptyMedia}>
          <HugeiconsIcon icon={Image02Icon} size={26} color={colors.textMuted} />
          <Text variant="footnote" style={styles.emptyMediaText}>No photos or videos yet</Text>
        </View>
      )}

      <FlatList
        data={media ?? []}
        keyExtractor={(item) => item._id}
        numColumns={3}
        columnWrapperStyle={styles.mediaRow}
        contentContainerStyle={styles.mediaGrid}
        renderItem={({ item }) => (
          <Pressable
            style={styles.mediaTile}
            onPress={() => item.mediaUrl && setPreviewMedia({ uri: item.mediaUrl, type: item.mediaType })}
          >
            {item.mediaUrl && <Image source={{ uri: item.mediaUrl }} style={styles.mediaTileImage} />}
            {item.mediaType === 'video' && (
              <View style={styles.mediaPlayOverlay}>
                <HugeiconsIcon icon={PlayIcon} size={18} color="#ffffff" />
              </View>
            )}
          </Pressable>
        )}
      />

      <ChatBackgroundSheet
        visible={backgroundSheetVisible}
        selected={background}
        bubbleStyle={bubbleStyle}
        viewerId={currentUserId}
        otherUserId={otherUserId}
        onSelect={selectBackground}
        onSelectBubbleStyle={selectBubbleStyle}
        onClose={() => setBackgroundSheetVisible(false)}
      />

      <NativePopup
        visible={clearConfirmVisible}
        title="Clear this chat?"
        message="This removes the messages from your view. It won't delete them for the other person."
        confirmLabel="Clear chat"
        onClose={() => setClearConfirmVisible(false)}
        onConfirm={async () => {
          await clearConversation({ userId: currentUserId, otherUserId });
          onChatCleared();
        }}
      />

      <MediaViewerModal media={previewMedia} onClose={() => setPreviewMedia(null)} />
    </View>
  );
}

const AVATAR_LARGE = 96;
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
    profileBlock: {
      alignItems: 'center',
      paddingVertical: space.lg,
    },
    avatarLarge: {
      width: AVATAR_LARGE,
      height: AVATAR_LARGE,
      borderRadius: AVATAR_LARGE / 2,
      overflow: 'hidden',
    },
    avatarLargeImage: {
      flex: 1,
    },
    avatarLargeGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLargeLetter: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 36,
      color: '#ffffff',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xxs,
      marginTop: space.md,
    },
    name: {
      color: colors.white,
    },
    username: {
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
      paddingVertical: space.sm,
    },
    optionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 60,
    },
    optionIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionIconDanger: {
      backgroundColor: 'transparent',
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
    emptyMedia: {
      alignItems: 'center',
      gap: space.xs,
      paddingVertical: space.xl,
    },
    emptyMediaText: {
      color: colors.textMuted,
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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
  });
