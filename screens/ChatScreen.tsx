import AppTextInput from '../components/AppTextInput';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Keyboard, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, ImageAdd01Icon, MoreVerticalIcon, PlayIcon, SentIcon, StickerIcon } from '@hugeicons/core-free-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import AnimatedPressable from '../components/AnimatedPressable';
import CircleInviteBubble from '../components/CircleInviteBubble';
import GroupInviteBubble from '../components/GroupInviteBubble';
import FadeInView from '../components/FadeInView';
import SharedPostBubble from '../components/SharedPostBubble';
import MediaMessageBubble from '../components/MediaMessageBubble';
import MediaViewerModal, { ViewerMedia } from '../components/MediaViewerModal';
import TypingDots from '../components/TypingDots';
import VerifiedBadge from '../components/VerifiedBadge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, gradientPalette, radius, space, typography } from '../theme';
import { ChatBackground, getChatBackground } from '../chatBackgrounds';
import { BubbleStyleKey, DEFAULT_BUBBLE_STYLE, bubbleStylePresets, getChatBubbleStyle } from '../chatBubbleStyle';
import { compressMedia } from '../compressMedia';
import { uploadFileToConvex } from '../uploadMedia';
import StickerSheet from '../components/StickerSheet';
import NativePopup from '../components/nativepopup';

const TYPING_STOP_DELAY = 1500;
const CHAT_HEADER_HEIGHT = 80;

export default function ChatScreen({
  currentUserId,
  otherUserId,
  onBack,
  onOpenInfo,
}: {
  currentUserId: Id<'users'>;
  otherUserId: Id<'users'>;
  onBack: () => void;
  onOpenInfo: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation(['chat', 'common']);
  const [text, setText] = useState('');
  const [stickersOpen, setStickersOpen] = useState(false);
  const [stickerToSave, setStickerToSave] = useState<{ _id: Id<'stickers'>; name: string } | null>(null);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [background, setBackground] = useState<ChatBackground | null>(null);
  const [bubbleStyleKey, setBubbleStyleKey] = useState<BubbleStyleKey>(DEFAULT_BUBBLE_STYLE);
  const bubblePreset = bubbleStylePresets[bubbleStyleKey];
  const [sendingMedia, setSendingMedia] = useState(false);
  const [viewerMedia, setViewerMedia] = useState<ViewerMedia | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  // The header and input bar each show a "window" onto the exact same
  // full-bleed background image/gradient behind the messages, rather than
  // their own independently-scaled copy — otherwise each bar's picture gets
  // its own "cover" crop relative to its own tiny box and visibly doesn't
  // line up with (or match the zoom level of) the one big picture showing
  // through everywhere else. Measuring the real container size and the
  // input row's live Y position (it moves as the keyboard opens/closes and
  // the multiline input grows) lets both bars render that same full-size
  // image, just clipped to their own bounds — so it reads as one continuous
  // photo with two opaque strips over it, not three separate pictures.
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [inputRowY, setInputRowY] = useState(0);
  const onContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  };
  const onInputRowLayout = (e: LayoutChangeEvent) => {
    setInputRowY(e.nativeEvent.layout.y);
  };
  const scrollRef = useRef<ScrollView>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const [isSending, setIsSending] = useState(false);

  const otherUser = useQuery(api.users.getUser, { userId: otherUserId });
  const messages = useQuery(api.messages.listMessages, {
    userId: currentUserId,
    otherUserId,
  });
  const otherIsTyping = useQuery(api.typing.getTypingStatus, {
    userId: currentUserId,
    otherUserId,
  });
  const otherLastRead = useQuery(api.messages.getOtherLastRead, {
    userId: currentUserId,
    otherUserId,
  });
  const sendMessage = useMutation(api.messages.sendMessage);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const setTyping = useMutation(api.typing.setTyping);
  const markRead = useMutation(api.messages.markRead);
  const toggleSavedSticker = useMutation(api.stickers.toggleSaved);
  const saveSticker = useMutation(api.stickers.save);

  // Mark the thread read whenever we have it open and new messages land.
  useEffect(() => {
    markRead({ userId: currentUserId, otherUserId });
  }, [currentUserId, otherUserId, messages?.length]);

  // Local-only, per-viewer preference — see chatBackgrounds.ts. Editing it
  // happens on the full-screen chat-info page (onOpenInfo); this screen just
  // reflects whatever's currently set, reloading it every time we come back.
  useEffect(() => {
    getChatBackground(currentUserId, otherUserId).then(setBackground);
    getChatBubbleStyle(currentUserId, otherUserId).then(setBubbleStyleKey);
  }, [currentUserId, otherUserId]);

  const stopTyping = () => {
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      setTyping({ senderId: currentUserId, recipientId: otherUserId, isTyping: false });
    }
  };

  // Clear our typing flag if we leave the chat mid-type.
  useEffect(() => stopTyping, [otherUserId]);

  useEffect(() => {
    if (messages) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages?.length, otherIsTyping]);

  // The message list shrinks (via KeyboardAvoidingView's bottom padding)
  // when the keyboard opens, same as the rest of the screen going up — keep
  // the latest message in view through that resize instead of leaving it
  // wherever the old, taller scroll position happened to land.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  const handleChangeText = (value: string) => {
    setText(value);

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    if (value.trim().length === 0) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      setTyping({ senderId: currentUserId, recipientId: otherUserId, isTyping: true });
    }
    typingTimeout.current = setTimeout(stopTyping, TYPING_STOP_DELAY);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    stopTyping();
    setIsSending(true);
    sendMessage({ senderId: currentUserId, recipientId: otherUserId, text: trimmed }).finally(
      () => setIsSending(false)
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
        senderId: currentUserId,
        recipientId: otherUserId,
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

  const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : undefined;
  let lastMessageStatus: string | null = null;
  if (lastMessage?.isMine) {
    if (isSending) {
      lastMessageStatus = t('sendingEllipsis');
    } else if (otherLastRead != null && otherLastRead >= lastMessage._creationTime) {
      lastMessageStatus = t('seenStatus');
    } else {
      lastMessageStatus = t('sentStatus');
    }
  }

  const displayName = otherUser?.name ?? otherUser?.username ?? 'Someone';
  const letter = (otherUser?.username ?? displayName).charAt(0).toUpperCase();
  const gradient = (otherUser?.avatarGradient as [string, string]) ?? [colors.red, colors.coral];
  // A custom background is drawn full-bleed and the header/input bars stay
  // transparent over it (see their styles) — this only controls the one
  // thing that still needs to react to it: forcing header/name text to
  // white so it stays legible over an arbitrary photo or gradient,
  // regardless of the app's own light/dark theme.
  const isThemed = background !== null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding" onLayout={onContainerLayout}>
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
        {messages?.length === 0 && !otherIsTyping && (
          <Text variant="callout" style={styles.emptyText}>
            {t('startConversation', { name: otherUser?.name ?? t('themFallback') })}
          </Text>
        )}

        {messages?.map((message) => (
          <FadeInView key={message._id}>
            <View style={[styles.bubbleRow, message.isMine && styles.bubbleRowMine]}>
              {message.sharedPostId ? (
                <SharedPostBubble
                  postId={message.sharedPostId as Id<'posts'>}
                  viewerId={currentUserId}
                  isMine={message.isMine}
                />
              ) : message.circleInviteId ? (
                <CircleInviteBubble
                  circleId={message.circleInviteId as Id<'userCircles'>}
                  userId={currentUserId}
                  isMine={message.isMine}
                    circleInfo={message.circleInvite ?? undefined}
                />
              ) : message.groupInviteId ? (
                <GroupInviteBubble
                  groupId={message.groupInviteId as Id<'groupChats'>}
                  userId={currentUserId}
                  isMine={message.isMine}
                  groupInfo={message.groupInvite ?? undefined}
                />
              ) : message.sticker ? (
                <Pressable onLongPress={() => setStickerToSave(message.sticker!)}><Image source={{ uri: message.sticker.imageUrl! }} style={styles.sticker} /></Pressable>
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

            {message._id === lastMessage?._id && lastMessageStatus && (
              <Text variant="caption" style={styles.statusLabel}>{lastMessageStatus}</Text>
            )}
          </FadeInView>
        ))}

        {otherIsTyping && (
          <FadeInView style={styles.bubbleRow}>
            <TypingDots />
          </FadeInView>
        )}
      </ScrollView>

      <View style={[styles.header, isThemed && styles.headerThemed]}>
        {isThemed && containerSize.height > 0 && (
          <>
            {background?.type === 'gradient' ? (
              <LinearGradient
                colors={gradientPalette[background.index]}
                style={[styles.backgroundWindow, { top: 0, width: containerSize.width, height: containerSize.height }]}
              />
            ) : background?.type === 'photo' ? (
              <Image
                source={{ uri: background.uri }}
                style={[styles.backgroundWindow, { top: 0, width: containerSize.width, height: containerSize.height }]}
                resizeMode="cover"
              />
            ) : null}
          </>
        )}
        <AnimatedPressable style={styles.backButton} onPress={onBack}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </AnimatedPressable>

        <Pressable style={styles.headerIdentity} onPress={onOpenInfo}>
          <View style={styles.avatar}>
            {otherUser?.avatarUrl ? (
              <Image source={{ uri: otherUser.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <LinearGradient colors={gradient} style={styles.avatarGradient}>
                <Text variant="calloutBold" style={styles.avatarLetter}>{letter}</Text>
              </LinearGradient>
            )}
          </View>

          <Text
            variant="h3"
            style={[styles.headerName, isThemed && styles.themedText]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <VerifiedBadge verified={otherUser?.isVerified} size={16} />
        </Pressable>

        <AnimatedPressable
          style={styles.backgroundButton}
          onPress={onOpenInfo}
          accessibilityLabel={t('chatOptionsLabel')}
        >
          <HugeiconsIcon icon={MoreVerticalIcon} size={19} color={colors.white} />
        </AnimatedPressable>
      </View>

      {mediaError && (
        <View style={styles.mediaErrorBanner}>
          <Text variant="caption" style={styles.mediaErrorText}>{mediaError}</Text>
        </View>
      )}
      <View style={[styles.inputRow, isThemed && styles.inputRowThemed]} onLayout={onInputRowLayout}>
        {isThemed && containerSize.height > 0 && (
          <>
            {background?.type === 'gradient' ? (
              <LinearGradient
                colors={gradientPalette[background.index]}
                style={[
                  styles.backgroundWindow,
                  { top: -inputRowY, width: containerSize.width, height: containerSize.height },
                ]}
              />
            ) : background?.type === 'photo' ? (
              <Image
                source={{ uri: background.uri }}
                style={[
                  styles.backgroundWindow,
                  { top: -inputRowY, width: containerSize.width, height: containerSize.height },
                ]}
                resizeMode="cover"
              />
            ) : null}
          </>
        )}
        <Pressable style={styles.stickerButton} onPress={() => setStickersOpen(true)}>
          <HugeiconsIcon icon={StickerIcon} size={22} color={colors.white} />
        </Pressable>
        <Pressable style={styles.stickerButton} onPress={pickAndSendMedia} disabled={sendingMedia}>
          <HugeiconsIcon icon={ImageAdd01Icon} size={22} color={colors.white} />
        </Pressable>
        <AppTextInput
          style={styles.input}
          placeholder={sendingMedia ? t('sendingEllipsis') : t('messagePlaceholder')}
          placeholderTextColor={colors.placeholder}
          value={text}
          onChangeText={handleChangeText}
          onBlur={stopTyping}
          multiline
          cursorColor={colors.coral}
        />
        <AnimatedPressable
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <HugeiconsIcon icon={SentIcon} size={18} color={colors.black} />
        </AnimatedPressable>
      </View>
      <StickerSheet visible={stickersOpen} userId={currentUserId} onClose={() => setStickersOpen(false)} onSelect={(sticker) => sendMessage({ senderId: currentUserId, recipientId: otherUserId, text: '', stickerId: sticker._id })} />
      <NativePopup visible={stickerToSave !== null} title={t('saveStickerTitle')} message={stickerToSave ? t('saveStickerMessage', { name: stickerToSave.name }) : ''} onClose={() => setStickerToSave(null)} onConfirm={async () => { if (!stickerToSave) return; const result = await saveSticker({ userId: currentUserId, stickerId: stickerToSave._id }); if (result.alreadySaved) setAlreadySaved(true); }} />
      <NativePopup visible={alreadySaved} title={t('alreadySavedTitle')} message={t('alreadySavedMessage')} confirmLabel={t('gotItButton')} showCancel={false} onClose={() => setAlreadySaved(false)} onConfirm={() => {}} />

      <MediaViewerModal media={viewerMedia} onClose={() => setViewerMedia(null)} />

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </KeyboardAvoidingView>
  );
}

const AVATAR_SIZE = 36;

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
      paddingTop: 36,
      paddingBottom: space.xs,
      overflow: 'hidden',
      // Opaque — a message scrolled up behind the header must disappear
      // behind it, not show through. When a custom background is set, its
      // own gradient/photo layer (rendered as this View's first child,
      // cropped to the header) is what actually shows here instead of this
      // flat color; either way nothing behind ever bleeds through.
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      zIndex: 10,
    },
    // The hairline border reads as a stray dark stripe cutting across a
    // custom photo/gradient — it only earns its keep as a seam against the
    // flat app background, so a themed chat drops it entirely.
    headerThemed: {
      borderBottomWidth: 0,
    },
    themedText: {
      color: '#ffffff',
    },
    // Base for the header/input-row "window" onto the full-bleed background
    // — width/height/top are filled in per-bar at render time so it lines up
    // with the same picture showing through the rest of the screen.
    backgroundWindow: {
      position: 'absolute',
      left: 0,
    },
    headerIdentity: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      overflow: 'hidden',
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
      color: '#ffffff',
    },
    headerName: {
      flexShrink: 1,
      color: colors.white,
    },
    backgroundButton: {
      marginLeft: 'auto',
      width: 36,
      height: 36,
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
      justifyContent: 'flex-start',
    },
    bubbleRowMine: {
      justifyContent: 'flex-end',
    },
    bubble: {
      maxWidth: '78%',
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
    statusLabel: {
      alignSelf: 'flex-end',
      marginTop: space.xxs,
      marginRight: space.xxs,
      color: colors.textMuted,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: space.xs,
      paddingHorizontal: space.md,
      paddingTop: space.xs,
      paddingBottom: space.xs,
      // Same as the header — opaque, either the flat app color or (when
      // themed) the background's own gradient/photo cropped to this bar.
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      overflow: 'hidden',
    },
    // Same reasoning as headerThemed above.
    inputRowThemed: {
      borderTopWidth: 0,
    },
    mediaErrorBanner: {
      paddingHorizontal: space.md,
      paddingVertical: space.xxs,
      backgroundColor: colors.background,
    },
    mediaErrorText: {
      color: colors.errorText,
    },
    // Bare icon, no chip behind it — same as the header's back/⋮ buttons.
    // Only the text input pill (below) and the send button stay solid.
    stickerButton: {
      width: 36,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // The input pill stays solid too — only the bar it sits on (and the
    // header) actually goes transparent.
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
