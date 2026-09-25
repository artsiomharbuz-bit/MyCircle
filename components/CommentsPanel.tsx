import AppTextInput from './AppTextInput';
import { useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, FavouriteIcon, SentIcon, StickerIcon } from '@hugeicons/core-free-icons';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import AnimatedPressable from './AnimatedPressable';
import PollCard, { PollData } from './PollCard';
import Skeleton from './Skeleton';
import StoryRing from './StoryRing';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';
import StickerSheet from './StickerSheet';
import NativePopup from './nativepopup';
import VerifiedBadge from './VerifiedBadge';
import { readableError } from '../errorMessage';
import { formatTimeLeft } from '../moderationOptions';
import { formatRelativeTime } from '../formatRelativeTime';

type Comment = {
  _id: Id<'comments'>;
  _creationTime: number;
  text: string;
  sticker?: { _id: Id<'stickers'>; name: string; imageUrl: string | null } | null;
  parentCommentId?: Id<'comments'>;
  likeCount: number;
  isLiked: boolean;
  author: {
    _id: Id<'users'>;
    name?: string;
    username?: string;
    avatarUrl: string | null;
    avatarGradient?: string[];
    isVerified?: boolean;
  } | null;
  replyToUser: {
    _id: Id<'users'>;
    name?: string;
    username?: string;
  } | null;
};

type ReplyTarget = { userId: Id<'users'>; name: string; parentCommentId: Id<'comments'> };

// Just the comment list + composer — no modal/backdrop of its own, so it can
// be hosted either inside a Modal (feed posts) or inline in a screen that
// needs to keep its own layout control (Clips, so the video can shrink and
// stay visible above this panel instead of being covered by it).
export default function CommentsPanel({
  postId,
  userId,
  active,
  poll,
  onOpenUser,
  onOpenStory,
}: {
  postId: Id<'posts'> | null;
  userId: Id<'users'>;
  // Only run the query while this panel is actually visible.
  active: boolean;
  // Pinned above the comment list when present — passed by the caller
  // rather than fetched here (the caller already has the post's full data,
  // e.g. ClipsScreen). Left undefined where a poll shouldn't show at all
  // (feed posts already show their poll inline below the caption — see
  // PostCard — so CommentsSheet doesn't pass one).
  poll?: PollData | null;
  onOpenUser: (userId: Id<'users'>) => void;
  // Tapping an avatar goes to that person's story instead of their profile
  // when they currently have one (the ring is the visual cue) — tapping
  // their name always goes to the profile either way.
  onOpenStory: (userId: Id<'users'>) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [text, setText] = useState('');
  const [stickersOpen, setStickersOpen] = useState(false);
  const [stickerToSave, setStickerToSave] = useState<{ _id: Id<'stickers'>; name: string } | null>(null);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<Id<'comments'>>>(new Set());
  const [highlightedCommentId, setHighlightedCommentId] = useState<Id<'comments'> | null>(null);
  const highlightOpacity = useRef(new Animated.Value(0)).current;
  const listRef = useRef<ScrollView>(null);
  const commentOffsets = useRef(new Map<Id<'comments'>, number>());

  const comments = useQuery(
    api.comments.listComments,
    active && postId ? { postId, viewerId: userId } : 'skip'
  );
  const accountStatus = useQuery(
    api.moderation.getAccountStatus,
    active ? { userId } : 'skip'
  );
  const isRestricted = accountStatus?.isRestricted ?? false;
  const storyAuthorIds = useQuery(
    api.stories.getActiveStoryAuthorIds,
    active ? { viewerId: userId } : 'skip'
  );
  const addComment = useMutation(api.comments.addComment);
  const toggleCommentLike = useMutation(api.comments.toggleCommentLike);
  const toggleSavedSticker = useMutation(api.stickers.toggleSaved);
  const saveSticker = useMutation(api.stickers.save);

  const { topLevel, repliesByParent } = useMemo(() => {
    const topLevel: Comment[] = [];
    const repliesByParent = new Map<Id<'comments'>, Comment[]>();
    (comments ?? []).forEach((c) => {
      if (c.parentCommentId) {
        const list = repliesByParent.get(c.parentCommentId) ?? [];
        list.push(c);
        repliesByParent.set(c.parentCommentId, list);
      } else {
        topLevel.push(c);
      }
    });
    return { topLevel, repliesByParent };
  }, [comments]);

  const toggleExpanded = (id: Id<'comments'>) => {
    setExpandedThreads((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleReply = (comment: Comment, displayName: string) => {
    if (!comment.author) return;
    setReplyTo({
      userId: comment.author._id,
      name: displayName,
      parentCommentId: comment.parentCommentId ?? comment._id,
    });
    if (comment.parentCommentId) {
      setExpandedThreads((current) => new Set(current).add(comment.parentCommentId!));
    }
  };

  const focusComment = (commentId: Id<'comments'>) => {
    const offset = commentOffsets.current.get(commentId);
    if (offset !== undefined) {
      listRef.current?.scrollTo({ y: Math.max(0, offset - 12), animated: true });
    }
    highlightOpacity.setValue(0);
    setHighlightedCommentId(commentId);
    Animated.sequence([
      Animated.timing(highlightOpacity, { toValue: 0.35, duration: 160, useNativeDriver: true }),
      Animated.timing(highlightOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start(() => setHighlightedCommentId(null));
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !postId) return;
    addComment({
      postId,
      authorId: userId,
      text: trimmed,
      parentCommentId: replyTo?.parentCommentId,
      replyToUserId: replyTo?.userId,
    }).catch((err) => {
      // A restriction or ban is refused server-side — put the comment text
      // back so nothing the user typed is lost, and say why.
      setText(trimmed);
      setBlockedMessage(readableError(err));
    });
    setText('');
    setReplyTo(null);
  };

  const renderComment = (comment: Comment, indented: boolean) => {
    if (!comment.author) return null;
    const displayName = comment.author.name ?? comment.author.username ?? 'Someone';
    const letter = (comment.author.username ?? displayName).charAt(0).toUpperCase();
    const gradient = (comment.author.avatarGradient as [string, string]) ?? [
      colors.red,
      colors.coral,
    ];
    const replyToName = comment.replyToUser?.name ?? comment.replyToUser?.username;
    const authorId = comment.author._id;
    const hasStory = storyAuthorIds?.includes(authorId) ?? false;

    return (
      <View
        key={comment._id}
        onLayout={
          indented
            ? undefined
            : (event) => commentOffsets.current.set(comment._id, event.nativeEvent.layout.y)
        }
        style={[
          styles.row,
          indented && styles.rowIndented,
          highlightedCommentId === comment._id && styles.highlightedRow,
        ]}
      >
        {highlightedCommentId === comment._id && (
          <Animated.View
            pointerEvents="none"
            style={[styles.highlightOverlay, { opacity: highlightOpacity }]}
          />
        )}
        <Pressable onPress={() => (hasStory ? onOpenStory(authorId) : onOpenUser(authorId))}>
          <StoryRing hasStory={hasStory} size={indented ? AVATAR_SIZE_SMALL : AVATAR_SIZE} ringWidth={2} gap={1}>
            <View style={[styles.avatar, indented && styles.avatarSmall]}>
              {comment.author.avatarUrl ? (
                <Image source={{ uri: comment.author.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={gradient} style={styles.avatarGradient}>
                  <Text style={styles.avatarLetter}>{letter}</Text>
                </LinearGradient>
              )}
            </View>
          </StoryRing>
        </Pressable>
        <View style={styles.rowText}>
          <View style={styles.commentLine}>
            <Text style={styles.commentName} onPress={() => onOpenUser(authorId)} numberOfLines={1}>
              {displayName}
            </Text>
            {comment.author.isVerified && <VerifiedBadge verified size={13} />}
            <Text style={styles.commentTime}>{formatRelativeTime(comment._creationTime)}</Text>
          </View>
          {(!!comment.text || !!replyToName) && (
            <Text style={styles.commentText}>
              {replyToName && (
                <Text
                  style={styles.replyName}
                  onPress={() => comment.parentCommentId && focusComment(comment.parentCommentId)}
                >
                  @{replyToName}{' '}
                </Text>
              )}
              {comment.text}
            </Text>
          )}
          {comment.sticker?.imageUrl && <Pressable onLongPress={() => setStickerToSave(comment.sticker!)}><Image source={{ uri: comment.sticker.imageUrl }} style={styles.sticker} /></Pressable>}
          <Pressable onPress={() => handleReply(comment, displayName)} hitSlop={6}>
            <Text style={styles.replyButton}>Reply</Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.commentLikeButton}
          onPress={() => toggleCommentLike({ commentId: comment._id, userId })}
        >
          <HugeiconsIcon
            icon={FavouriteIcon}
            size={indented ? 20 : 22}
            color={comment.isLiked ? colors.red : colors.textMuted}
            fill={comment.isLiked ? colors.red : 'none'}
          />
          {comment.likeCount > 0 && (
            <Text style={styles.commentLikeCount}>{comment.likeCount}</Text>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {poll && postId && (
        <View style={styles.pollWrap}>
          <PollCard poll={poll} postId={postId} viewerId={userId} />
        </View>
      )}

      <Text style={styles.heading}>Comments</Text>

      <ScrollView ref={listRef} style={styles.list} showsVerticalScrollIndicator={false}>
        {comments === undefined &&
          [0, 1, 2].map((i) => (
            <View key={i} style={styles.row}>
              <Skeleton style={styles.avatar} />
              <View style={styles.rowText}>
                <Skeleton style={styles.commentNameSkeleton} />
                <Skeleton style={styles.commentTextSkeleton} />
              </View>
            </View>
          ))}

        {comments?.length === 0 && (
          <Text style={styles.emptyText}>Be the first to comment.</Text>
        )}

        {topLevel.map((comment) => {
          const replies = repliesByParent.get(comment._id) ?? [];
          const isExpanded = expandedThreads.has(comment._id);

          return (
            <View key={comment._id}>
              {renderComment(comment, false)}

              {replies.length > 0 && (
                <Pressable
                  style={styles.viewRepliesButton}
                  onPress={() => toggleExpanded(comment._id)}
                >
                  <View style={styles.viewRepliesLine} />
                  <Text style={styles.viewRepliesText}>
                    {isExpanded
                      ? 'Hide replies'
                      : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                  </Text>
                </Pressable>
              )}

              {isExpanded &&
                replies.map((reply) => renderComment(reply, true))}
            </View>
          );
        })}
      </ScrollView>

      <KeyboardStickyView style={styles.stickyFooter}>
        {isRestricted ? (
          <View style={styles.restrictedNotice}>
            <Text style={styles.restrictedNoticeText}>
              You're restricted ({formatTimeLeft(accountStatus?.restrictedUntil)}) — you can't
              comment right now.
            </Text>
          </View>
        ) : (
          <>
            {replyTo && (
              <View style={styles.replyBanner}>
                <Text style={styles.replyBannerText}>Replying to {replyTo.name}</Text>
                <Pressable onPress={() => setReplyTo(null)}>
                  <HugeiconsIcon icon={Cancel01Icon} size={14} color={colors.textMuted} />
                </Pressable>
              </View>
            )}

            <View style={styles.inputRow}>
              <Pressable style={styles.stickerButton} onPress={() => setStickersOpen(true)}>
                <HugeiconsIcon icon={StickerIcon} size={20} color={colors.white} />
              </Pressable>
              <AppTextInput
                style={styles.input}
                placeholder={replyTo ? `Reply to ${replyTo.name}...` : 'Add a comment...'}
                placeholderTextColor={colors.placeholder}
                value={text}
                onChangeText={setText}
                cursorColor={colors.coral}
                multiline
              />
              <AnimatedPressable
                style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!text.trim()}
              >
                <HugeiconsIcon icon={SentIcon} size={16} color={colors.black} />
              </AnimatedPressable>
            </View>
          </>
        )}
      </KeyboardStickyView>
      <StickerSheet visible={stickersOpen} userId={userId} onClose={() => setStickersOpen(false)} onSelect={(sticker) => postId && addComment({ postId, authorId: userId, text: '', stickerId: sticker._id })} />
      <NativePopup visible={stickerToSave !== null} title="Save this sticker?" message={stickerToSave ? `Add “${stickerToSave.name}” to your saved stickers.` : ''} onClose={() => setStickerToSave(null)} onConfirm={async () => { if (!stickerToSave) return; const result = await saveSticker({ userId, stickerId: stickerToSave._id }); if (result.alreadySaved) setAlreadySaved(true); }} />
      <NativePopup visible={alreadySaved} title="Already saved" message="This sticker is already in your Saved collection." confirmLabel="Got it" showCancel={false} onClose={() => setAlreadySaved(false)} onConfirm={() => {}} />
      <NativePopup visible={blockedMessage !== null} title="Can't comment" message={blockedMessage ?? ''} confirmLabel="Got it" showCancel={false} onClose={() => setBlockedMessage(null)} onConfirm={() => {}} />
    </View>
  );
}

const AVATAR_SIZE = 44;
const AVATAR_SIZE_SMALL = 32;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: space.lg,
      paddingTop: space.sm,
    },
    pollWrap: {
      marginBottom: space.md,
      paddingBottom: space.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    heading: {
      ...typography.h3,
      color: colors.white,
      marginBottom: space.sm,
      textAlign: 'center',
    },
    emptyText: {
      ...typography.callout,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: space.lg,
    },
    list: {
      flex: 1,
    },
    stickyFooter: {
      backgroundColor: colors.background,
    },
    row: {
      flexDirection: 'row',
      gap: space.sm,
      paddingVertical: space.xs,
    },
    rowIndented: {
      marginLeft: AVATAR_SIZE + space.sm,
    },
    highlightedRow: {
      borderRadius: radius.sm,
    },
    highlightOverlay: {
      ...StyleSheet.absoluteFill,
      borderRadius: radius.sm,
      backgroundColor: colors.buttonSecondary,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    avatarSmall: {
      width: AVATAR_SIZE_SMALL,
      height: AVATAR_SIZE_SMALL,
      borderRadius: AVATAR_SIZE_SMALL / 2,
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
      fontSize: 14,
      color: '#ffffff',
    },
    rowText: {
      flex: 1,
    },
    commentLine: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    commentName: {
      ...typography.callout,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.white,
      flexShrink: 1,
    },
    commentTime: {
      ...typography.footnote,
      color: colors.textMuted,
      marginLeft: space.xs,
    },
    replyArrow: {
      color: colors.textMuted,
    },
    replyName: {
      color: colors.coral,
    },
    commentText: {
      marginTop: 2,
      ...typography.body,
      color: colors.white,
    },
    commentNameSkeleton: {
      width: 90,
      height: 13,
      borderRadius: 6,
    },
    commentTextSkeleton: {
      marginTop: 6,
      width: 160,
      height: 14,
      borderRadius: 7,
    },
    replyButton: {
      marginTop: 6,
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.textMuted,
    },
    commentLikeButton: {
      alignItems: 'center',
      minWidth: 40,
      paddingLeft: space.xs,
      paddingTop: space.xs,
    },
    commentLikeCount: {
      marginTop: 2,
      ...typography.footnote,
      color: colors.textMuted,
    },
    emojiRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: space.xxs,
      paddingTop: space.sm,
      paddingBottom: space.xxs,
    },
    emoji: {
      fontSize: 26,
      lineHeight: 34,
    },
    meAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      overflow: 'hidden',
      alignSelf: 'center',
    },
    viewRepliesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      marginLeft: AVATAR_SIZE + space.sm,
      marginBottom: space.xs,
    },
    viewRepliesLine: {
      width: 20,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.textMuted,
    },
    viewRepliesText: {
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.textMuted,
    },
    restrictedNotice: {
      paddingVertical: space.md,
      paddingHorizontal: space.xxs,
    },
    restrictedNoticeText: {
      ...typography.footnote,
      textAlign: 'center',
      color: colors.textMuted,
    },
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.xxs,
      paddingVertical: space.xs,
    },
    replyBannerText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: space.sm,
      paddingTop: space.xs,
      paddingBottom: space.xs,
    },
    sticker: { width: 112, height: 112, borderRadius: radius.md, marginTop: 6 },
    stickerButton: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
    input: {
      fontFamily: 'Poppins_400Regular',
      flex: 1,
      maxHeight: 90,
      minHeight: 40,
      borderRadius: radius.input,
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.white,
      fontSize: 14,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white,
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
