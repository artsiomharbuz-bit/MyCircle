import AppTextInput from '../components/AppTextInput';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  ImageAdd01Icon,
  MoreVerticalIcon,
  SentIcon,
  StickerIcon,
} from '@hugeicons/core-free-icons';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import AnimatedPressable from '../components/AnimatedPressable';
import FadeInView from '../components/FadeInView';
import GroupAvatarStack from '../components/GroupAvatarStack';
import MediaMessageBubble from '../components/MediaMessageBubble';
import MediaViewerModal, { ViewerMedia } from '../components/MediaViewerModal';
import StickerSheet from '../components/StickerSheet';
import NativePopup from '../components/nativepopup';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, gradientPalette, radius, space, typography } from '../theme';
import { ChatBackground, getChatBackground } from '../chatBackgrounds';
import { BubbleStyleKey, DEFAULT_BUBBLE_STYLE, bubbleStylePresets, getChatBubbleStyle } from '../chatBubbleStyle';
import { getGroupClearedAt } from '../groupClear';
import { compressMedia } from '../compressMedia';
import { uploadFileToConvex } from '../uploadMedia';

const CHAT_HEADER_HEIGHT = 96;
const SENDER_AVATAR = 28;

// Same design as the 1:1 ChatScreen: same bubble styles, sticker + picture
// buttons, composer and 3-dot options page. The differences are a
// stacked-avatar header (no single "other person"), group messages and
// membership, and every incoming message showing who sent it (profile
// picture and name) since "them" isn't one fixed person here.
export default function GroupChatScreen({
  groupId,
  currentUserId,
  onBack,
  onOpenInfo,
}: {
  groupId: Id<'groupChats'>;
  currentUserId: Id<'users'>;
  onBack: () => void;
  onOpenInfo: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation(['groupChat', 'common']);
  const [text, setText] = useState('');
  const [stickersOpen, setStickersOpen] = useState(false);
  const [stickerToSave, setStickerToSave] = useState<{ _id: Id<'stickers'>; name: string } | null>(null);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [viewerMedia, setViewerMedia] = useState<ViewerMedia | null>(null);
  const [background, setBackground] = useState<ChatBackground | null>(null);
  const [bubbleStyleKey, setBubbleStyleKey] = useState<BubbleStyleKey>(DEFAULT_BUBBLE_STYLE);
  const [clearedAt, setClearedAt] = useState(0);
  const bubblePreset = bubbleStylePresets[bubbleStyleKey];
  const scrollRef = useRef<ScrollView>(null);

  const localKey = `group-${groupId}`;

  const group = useQuery(api.groups.getGroupInviteInfo, { groupId, viewerId: currentUserId });
  const members = useQuery(api.groups.listGroupMembers, { groupId, viewerId: currentUserId });
  const allMessages = useQuery(api.groups.listGroupMessages, { groupId, viewerId: currentUserId });
  const messages = allMessages?.filter((m) => m._creationTime > clearedAt);
  const sendMessage = useMutation(api.groups.sendGroupMessage);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const markRead = useMutation(api.groups.markGroupRead);
  const saveSticker = useMutation(api.stickers.save);

  // Local, per-viewer preferences — edited on the info page, reloaded here
  // every time this screen is shown again.
  const loadPrefs = useCallback(() => {
    getChatBackground(currentUserId, localKey).then(setBackground);
    getChatBubbleStyle(currentUserId, localKey).then(setBubbleStyleKey);
    getGroupClearedAt(currentUserId, groupId).then(setClearedAt);
  }, [currentUserId, localKey, groupId]);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  useEffect(() => {
    markRead({ groupId, userId: currentUserId });
  }, [groupId, currentUserId, messages?.length]);

  useEffect(() => {
    if (messages) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages?.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    setIsSending(true);
    sendMessage({ groupId, senderId: currentUserId, text: trimmed }).finally(() =>
      setIsSending(false)
    );
  };

  const pickAndSendMedia = async () => {
    setMediaError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMediaError(t('photoAccessDenied'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const mediaType = asset.type === 'video' ? 'video' : 'photo';

    setSendingMedia(true);
    try {
      const compressedUri = await compressMedia(asset.uri, mediaType);
      const uploadUrl = await generateUploadUrl({ userId: currentUserId });
      const storageId = await uploadFileToConvex(
        compressedUri,
        uploadUrl,
        mediaType === 'photo' ? 'image/jpeg' : 'video/mp4'
      );
      await sendMessage({
        groupId,
        senderId: currentUserId,
        text: '',
        mediaStorageId: storageId as Id<'_storage'>,
        mediaType,
      });
    } catch {
      setMediaError(t('sendFailedError'));
    } finally {
      setSendingMedia(false);
    }
  };

  // Over a custom background the bars go translucent and the text white so
  // it stays legible on any photo or gradient.
  const isThemed = background !== null;

  return (
    <View style={styles.container}>
      {background?.type === 'gradient' && (
        <LinearGradient colors={gradientPalette[background.index]} style={StyleSheet.absoluteFill} />
      )}
      {background?.type === 'photo' && (
        <Image source={{ uri: background.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages?.length === 0 && (
          <Text variant="callout" style={[styles.emptyText, isThemed && styles.themedText]}>
            {t('startOfGroup', { name: group?.name ? `"${group.name}"` : t('theGroupFallback') })}
          </Text>
        )}

        {messages?.map((message) => {
          const senderName = message.isMine
            ? null
            : message.sender?.name ?? message.sender?.username ?? 'Someone';
          const letter = (message.sender?.username ?? senderName ?? '?').charAt(0).toUpperCase();
          const gradient = (message.sender?.avatarGradient as [string, string]) ?? [
            colors.red,
            colors.coral,
          ];

          return (
            <FadeInView key={message._id}>
              <View style={[styles.bubbleRow, message.isMine && styles.bubbleRowMine]}>
                {!message.isMine && (
                  <View style={styles.senderAvatar}>
                    {message.sender?.avatarUrl ? (
                      <Image source={{ uri: message.sender.avatarUrl }} style={styles.senderAvatarImage} />
                    ) : (
                      <LinearGradient colors={gradient} style={styles.senderAvatarGradient}>
                        <Text style={styles.senderAvatarLetter}>{letter}</Text>
                      </LinearGradient>
                    )}
                  </View>
                )}

                <View style={message.isMine ? styles.bubbleColumnMine : styles.bubbleColumn}>
                  {senderName && (
                    <Text variant="micro" style={[styles.senderName, isThemed && styles.themedText]}>
                      {senderName}
                    </Text>
                  )}
                  {message.sticker ? (
                    <Pressable onLongPress={() => setStickerToSave(message.sticker!)}>
                      <Image source={{ uri: message.sticker.imageUrl! }} style={styles.sticker} />
                    </Pressable>
                  ) : message.mediaUrl ? (
                    <MediaMessageBubble
                      uri={message.mediaUrl}
                      type={message.mediaType!}
                      onOpen={() => setViewerMedia({ uri: message.mediaUrl!, type: message.mediaType! })}
                    />
                  ) : (
                    <View
                      style={[
                        styles.bubble,
                        message.isMine ? styles.bubbleMine : styles.bubbleTheirs,
                        {
                          borderRadius: bubblePreset.radius,
                          paddingHorizontal: bubblePreset.paddingHorizontal,
                          paddingVertical: bubblePreset.paddingVertical,
                          ...(message.isMine
                            ? { borderBottomRightRadius: bubblePreset.tailRadius }
                            : { borderBottomLeftRadius: bubblePreset.tailRadius }),
                        },
                      ]}
                    >
                      <Text
                        variant="body"
                        style={[styles.bubbleText, message.isMine && styles.bubbleTextMine]}
                      >
                        {message.text}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </FadeInView>
          );
        })}
      </ScrollView>

      <View style={[styles.header, isThemed && styles.barThemed]}>
        <AnimatedPressable style={styles.backButton} onPress={onBack}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </AnimatedPressable>

        <Pressable style={styles.headerIdentity} onPress={onOpenInfo}>
          <GroupAvatarStack members={members ?? []} size={36} />

          <View style={styles.headerText}>
            <Text
              variant="h3"
              style={[styles.headerName, isThemed && styles.themedText]}
              numberOfLines={1}
            >
              {group?.name ?? t('groupFallbackName')}
            </Text>
            <Text variant="caption" style={styles.headerMeta} numberOfLines={1}>
              {members ? t('membersCount', { count: members.length }) : ''}
            </Text>
          </View>
        </Pressable>

        <AnimatedPressable
          style={styles.optionsButton}
          onPress={onOpenInfo}
          accessibilityLabel={t('groupOptionsLabel')}
        >
          <HugeiconsIcon icon={MoreVerticalIcon} size={19} color={colors.white} />
        </AnimatedPressable>
      </View>

      <KeyboardStickyView>
        {mediaError && (
          <View style={styles.mediaErrorBanner}>
            <Text variant="caption" style={styles.mediaErrorText}>{mediaError}</Text>
          </View>
        )}
        <View style={[styles.inputRow, isThemed && styles.barThemed]}>
          <Pressable style={styles.iconButton} onPress={() => setStickersOpen(true)}>
            <HugeiconsIcon icon={StickerIcon} size={22} color={colors.white} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={pickAndSendMedia} disabled={sendingMedia}>
            <HugeiconsIcon icon={ImageAdd01Icon} size={22} color={colors.white} />
          </Pressable>
          <AppTextInput
            style={styles.input}
            placeholder={sendingMedia ? t('sendingEllipsis') : t('messagePlaceholder')}
            placeholderTextColor={colors.placeholder}
            value={text}
            onChangeText={setText}
            multiline
            cursorColor={colors.coral}
          />
          <AnimatedPressable
            style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || isSending}
          >
            <HugeiconsIcon icon={SentIcon} size={18} color={colors.black} />
          </AnimatedPressable>
        </View>
      </KeyboardStickyView>

      <StickerSheet
        visible={stickersOpen}
        userId={currentUserId}
        onClose={() => setStickersOpen(false)}
        onSelect={(sticker) => sendMessage({ groupId, senderId: currentUserId, text: '', stickerId: sticker._id })}
      />
      <NativePopup
        visible={stickerToSave !== null}
        title={t('saveStickerTitle')}
        message={stickerToSave ? t('saveStickerMessage', { name: stickerToSave.name }) : ''}
        onClose={() => setStickerToSave(null)}
        onConfirm={async () => {
          if (!stickerToSave) return;
          const result = await saveSticker({ userId: currentUserId, stickerId: stickerToSave._id });
          if (result.alreadySaved) setAlreadySaved(true);
        }}
      />
      <NativePopup
        visible={alreadySaved}
        title={t('alreadySavedTitle')}
        message={t('alreadySavedMessage')}
        confirmLabel={t('gotItButton')}
        showCancel={false}
        onClose={() => setAlreadySaved(false)}
        onConfirm={() => {}}
      />

      <MediaViewerModal media={viewerMedia} onClose={() => setViewerMedia(null)} />

      <StatusBar style={isThemed || scheme !== 'light' ? 'light' : 'dark'} />
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
      height: CHAT_HEADER_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.xl,
      paddingTop: 40,
      paddingBottom: space.md,
      overflow: 'hidden',
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      zIndex: 10,
    },
    barThemed: {
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    themedText: {
      color: '#ffffff',
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIdentity: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      minWidth: 0,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    headerName: {
      color: colors.white,
    },
    headerMeta: {
      marginTop: 1,
      color: colors.textMuted,
    },
    optionsButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messages: {
      flex: 1,
    },
    messagesContent: {
      paddingHorizontal: space.md,
      paddingTop: CHAT_HEADER_HEIGHT + space.md,
      paddingBottom: space.md,
      gap: space.xs,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textMuted,
      marginTop: 40,
      paddingHorizontal: space.xl,
    },
    bubbleRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'flex-start',
      gap: space.xs,
    },
    bubbleRowMine: {
      justifyContent: 'flex-end',
    },
    senderAvatar: {
      width: SENDER_AVATAR,
      height: SENDER_AVATAR,
      borderRadius: SENDER_AVATAR / 2,
      overflow: 'hidden',
    },
    senderAvatarImage: {
      flex: 1,
    },
    senderAvatarGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    senderAvatarLetter: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 12,
      color: '#ffffff',
    },
    bubbleColumn: {
      alignItems: 'flex-start',
      maxWidth: '72%',
    },
    bubbleColumnMine: {
      alignItems: 'flex-end',
      maxWidth: '78%',
    },
    senderName: {
      marginBottom: 3,
      marginLeft: space.xxs,
      color: colors.textMuted,
    },
    bubble: {
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      borderRadius: radius.lg,
    },
    bubbleTheirs: {
      backgroundColor: colors.inputBackground,
      borderBottomLeftRadius: radius.xs,
    },
    bubbleMine: {
      backgroundColor: colors.white,
      borderBottomRightRadius: radius.xs,
    },
    bubbleText: {
      color: colors.white,
    },
    bubbleTextMine: {
      color: colors.black,
    },
    sticker: { width: 128, height: 128, borderRadius: radius.md },
    mediaErrorBanner: {
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      backgroundColor: colors.background,
    },
    mediaErrorText: {
      color: colors.errorText,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: space.xs,
      paddingHorizontal: space.md,
      paddingTop: space.xs,
      paddingBottom: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    iconButton: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
    input: {
      fontFamily: typography.body.fontFamily,
      flex: 1,
      maxHeight: 120,
      minHeight: 44,
      borderRadius: radius.input,
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.white,
      fontSize: typography.body.fontSize,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white,
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
