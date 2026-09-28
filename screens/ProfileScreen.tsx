import { useEffect, useState } from 'react';
import { Animated, Dimensions, Image, Pressable, Share, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  BookmarkIcon,
  FavouriteIcon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  PlayIcon,
  Settings02Icon,
  Share08Icon,
  UserBlock01Icon,
} from '@hugeicons/core-free-icons';
import AccountSwitcherSheet from '../components/AccountSwitcherSheet';
import ProfileOptionsSheet from '../components/ProfileOptionsSheet';
import VerifiedBadge from '../components/VerifiedBadge';
import { NAV_BAR_HEIGHT } from '../components/BottomNavBar';
import CollapsibleHeader, { HEADER_HEIGHT } from '../components/CollapsibleHeader';
import FadeInView from '../components/FadeInView';
import FollowButton from '../components/FollowButton';
import FollowCounts from '../components/FollowCounts';
import FormModal from '../components/FormModal';
import PostAudienceSwitch, { PostAudienceFilter } from '../components/PostAudienceSwitch';
import PrimaryButton from '../components/PrimaryButton';
import ProfileContentSwitch, { ProfileContentTab } from '../components/ProfileContentSwitch';
import PostCard from '../components/PostCard';
import PostCardSkeleton from '../components/PostCardSkeleton';
import Skeleton from '../components/Skeleton';
import StoryRing from '../components/StoryRing';
import TextField from '../components/TextField';
import EmptyState from '../components/EmptyState';
import HighlightsRow from '../components/HighlightsRow';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { readableError } from '../errorMessage';
import { uploadFileToConvex } from '../uploadMedia';
import useOtherAccountUnread from '../useOtherAccountUnread';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

const AVATAR_SIZE = 84;
const ACTION_HEIGHT = 32;
const GRID_GAP = 3;
const GRID_COLUMNS = 3;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_TILE_SIZE = (SCREEN_WIDTH - 48 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

export default function ProfileScreen({
  viewedUserId,
  currentUserId,
  savedAccountIds,
  scrollY,
  onSwitchAccount,
  onAddAccount,
  onBack,
  onOpenFollowers,
  onOpenFollowing,
  onOpenSettings,
  onOpenClip,
  onOpenStory,
  onOpenUser,
  onOpenSound,
  onOpenLiked,
  onOpenSaved,
  onOpenChat,
  onCreateHighlight,
  onOpenHighlight,
}: {
  viewedUserId: Id<'users'>;
  currentUserId: Id<'users'>;
  savedAccountIds: Id<'users'>[];
  // Shared with the persistent BottomNavBar mounted in App.tsx, so it can
  // hide/show off this same scroll position.
  scrollY: Animated.Value;
  onSwitchAccount: (userId: Id<'users'>) => void;
  onAddAccount: () => void;
  onBack: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  onOpenSettings: () => void;
  onOpenClip: (postId: Id<'posts'>) => void;
  onOpenStory: (authorId: Id<'users'>) => void;
  onOpenUser: (userId: Id<'users'>) => void;
  onOpenSound: (soundId: Id<'sounds'>) => void;
  // Only ever wired up for the signed-in user's own profile — see isSelf
  // below, which is what actually gates whether these render at all.
  onOpenLiked: () => void;
  onOpenSaved: () => void;
  // Only ever called for someone else's profile (see the Message button).
  onOpenChat: (otherUserId: Id<'users'>) => void;
  // Only ever wired up for the signed-in user's own profile — see isSelf.
  onCreateHighlight: () => void;
  onOpenHighlight: (highlightId: Id<'highlights'>) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const { t } = useTranslation(['profile', 'common']);
  const styles = createStyles(colors);
  const isSelf = viewedUserId === currentUserId;
  const [audienceFilter, setAudienceFilter] = useState<PostAudienceFilter>('global');
  const [contentTab, setContentTab] = useState<ProfileContentTab>('posts');
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  const otherUnread = useOtherAccountUnread(currentUserId, savedAccountIds);
  const otherUnreadTotal = Object.values(otherUnread).reduce((sum, n) => sum + n, 0);

  const user = useQuery(api.users.getUser, { userId: viewedUserId, viewerId: currentUserId });
  const counts = useQuery(api.follows.getFollowCounts, { userId: viewedUserId });
  const posts = useQuery(api.posts.listPostsByAuthor, {
    authorId: viewedUserId,
    viewerId: currentUserId,
  });
  const followingIds = useQuery(
    api.follows.getFollowingIds,
    isSelf ? 'skip' : { followerId: currentUserId }
  );
  const follow = useMutation(api.follows.follow);
  const unfollow = useMutation(api.follows.unfollow);
  const unblockUser = useMutation(api.blocks.unblockUser);
  const storyAuthorIds = useQuery(api.stories.getActiveStoryAuthorIds, {
    viewerId: currentUserId,
  });

  const isFollowing = followingIds?.includes(viewedUserId) ?? false;
  const hasStory = storyAuthorIds?.includes(viewedUserId) ?? false;

  // The server (listPostsByAuthor) already only returns posts this viewer
  // can actually see, including proper per-circle membership checks — this
  // just splits that into the two audience tabs.
  const audienceVisiblePosts = posts?.filter((post) =>
    audienceFilter === 'global' ? post.audience === 'global' : post.audience === 'circles'
  );

  const visiblePosts = audienceVisiblePosts?.filter((post) => post.kind !== 'clip');
  const visibleClips = audienceVisiblePosts?.filter((post) => post.kind === 'clip');

  const toggleFollow = () => {
    if (isFollowing) {
      unfollow({ followerId: currentUserId, followingId: viewedUserId });
    } else {
      follow({ followerId: currentUserId, followingId: viewedUserId });
    }
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, styles.scrollContentWithHeader]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {user === undefined ? (
          <>
            <View style={[styles.header, styles.blockedHeader]}>
              <Skeleton
                style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
              />
              <Skeleton style={styles.nameSkeleton} />
              <Skeleton style={styles.usernameSkeleton} />
              <Skeleton style={styles.countsSkeleton} />
            </View>
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        ) : user && user.isBlocked ? (
          <FadeInView style={[styles.header, styles.blockedHeader]}>
            <View style={[styles.avatar, styles.blockedAvatar]}>
              <HugeiconsIcon icon={UserBlock01Icon} size={34} color={colors.textMuted} />
            </View>
            <Text style={[styles.name, styles.blockedTitle]}>
              {user.blockedByMe ? t('blockedByMeTitle') : t('blockedOtherTitle')}
            </Text>
            <Text style={styles.blockedBody}>
              {user.blockedByMe
                ? t('blockedByMeBody', { username: user.username ?? t('thisAccountFallback') })
                : t('blockedOtherBody')}
            </Text>
            {user.blockedByMe && (
              <Pressable
                style={styles.unblockButton}
                onPress={() => unblockUser({ blockerId: currentUserId, blockedId: viewedUserId })}
              >
                <Text style={styles.unblockButtonText}>{t('common:unblock')}</Text>
              </Pressable>
            )}
          </FadeInView>
        ) : user ? (
          <>
            <FadeInView style={styles.header}>
              <View style={styles.headerTop}>
                <Pressable
                  disabled={!hasStory}
                  onPress={() => onOpenStory(viewedUserId)}
                >
                  <StoryRing hasStory={hasStory} size={AVATAR_SIZE}>
                    <View style={styles.avatar}>
                      {user.avatarUrl ? (
                        <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                      ) : (
                        <LinearGradient
                          colors={(user.avatarGradient as [string, string]) ?? [colors.red, colors.coral]}
                          style={styles.avatarGradient}
                        >
                          <Text style={styles.avatarLetter}>
                            {(user.username ?? '?').charAt(0).toUpperCase()}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>
                  </StoryRing>
                </Pressable>

                <View style={styles.headerTopText}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{user.name}</Text>
                    <VerifiedBadge verified={user.isVerified} size={18} />
                  </View>

                  <FollowCounts
                    posts={posts?.length ?? 0}
                    followers={counts?.followers ?? 0}
                    following={counts?.following ?? 0}
                    onPressFollowers={onOpenFollowers}
                    onPressFollowing={onOpenFollowing}
                  />
                </View>
              </View>

              {!!user.bio && <Text style={styles.bio}>{user.bio}</Text>}
              {(!!user.pronouns || !!user.link) && (
                <Text style={styles.metaLine} numberOfLines={1}>
                  {[user.pronouns, user.link].filter(Boolean).join(' · ')}
                </Text>
              )}

              {isSelf ? (
                <View style={styles.actionButtonsRow}>
                  <Pressable style={styles.actionButton} onPress={() => setEditVisible(true)}>
                    <Text style={styles.actionButtonText}>{t('editProfileButton')}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() =>
                      Share.share({
                        message: user.username
                          ? t('shareMessageWithUsername', { username: user.username })
                          : t('shareMessageWithName', { name: user.name ?? t('thisProfileFallback') }),
                      })
                    }
                  >
                    <Text style={styles.actionButtonText}>{t('shareProfileButton')}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actionButtonsRow}>
                  <FollowButton
                    following={isFollowing}
                    onPress={toggleFollow}
                    coral
                    style={styles.actionButtonFlex}
                  />
                  <Pressable style={styles.actionButton} onPress={() => onOpenChat(viewedUserId)}>
                    <Text style={styles.actionButtonText}>{t('messageButton')}</Text>
                  </Pressable>
                </View>
              )}
            </FadeInView>

            <HighlightsRow
              userId={viewedUserId}
              isSelf={isSelf}
              onCreate={onCreateHighlight}
              onOpenHighlight={onOpenHighlight}
            />

            <PostAudienceSwitch value={audienceFilter} onChange={setAudienceFilter} />

            <View style={styles.contentTabRow}>
              <ProfileContentSwitch value={contentTab} onChange={setContentTab} />
              {isSelf && (
                <View style={styles.activityRow}>
                  <Pressable style={styles.activityButton} onPress={onOpenLiked} accessibilityLabel={t('likedPostsLabel')}>
                    <HugeiconsIcon icon={FavouriteIcon} size={20} color={colors.textMuted} />
                  </Pressable>
                  <Pressable style={styles.activityButton} onPress={onOpenSaved} accessibilityLabel={t('savedPostsLabel')}>
                    <HugeiconsIcon icon={BookmarkIcon} size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}
            </View>

            {posts === undefined ? (
              <>
                <PostCardSkeleton />
                <PostCardSkeleton />
              </>
            ) : contentTab === 'posts' ? (
              visiblePosts && visiblePosts.length > 0 ? (
                visiblePosts.map((post) => (
                  <FadeInView key={post._id}>
                    <PostCard
                      post={{
                        ...post,
                        author: {
                          _id: viewedUserId,
                          name: user.name,
                          username: user.username,
                          avatarUrl: user.avatarUrl,
                          avatarGradient: user.avatarGradient,
                          isVerified: user.isVerified,
                        },
                      }}
                      viewerId={currentUserId}
                      onOpenUser={onOpenUser}
                      onOpenStory={onOpenStory}
                      onOpenSound={onOpenSound}
                      onOpenClip={onOpenClip}
                    />
                  </FadeInView>
                ))
              ) : (
                <EmptyState
                  message={isSelf ? t('noPostsSelf') : t('noPostsOther')}
                  style={styles.emptyState}
                />
              )
            ) : visibleClips && visibleClips.length > 0 ? (
              <View style={styles.grid}>
                {visibleClips.map((clip) => (
                  <ProfileClipTile
                    key={clip._id}
                    mediaUrl={clip.mediaUrl}
                    onPress={() => onOpenClip(clip._id)}
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                message={isSelf ? t('noClipsSelf') : t('noClipsOther')}
                style={styles.emptyState}
              />
            )}
          </>
        ) : null}
      </Animated.ScrollView>

      <CollapsibleHeader
        title={user?.username ? `@${user.username}` : ''}
        scrollY={scrollY}
        onPressTitle={isSelf ? () => setSwitcherVisible(true) : undefined}
        titleBadgeCount={isSelf ? otherUnreadTotal : undefined}
        leftIcon={isSelf ? undefined : ArrowLeft01Icon}
        onPressLeft={isSelf ? undefined : onBack}
        rightIcons={
          isSelf
            ? [{ icon: Settings02Icon, onPress: onOpenSettings }]
            : [{ icon: MoreHorizontalIcon, onPress: () => setOptionsVisible(true) }]
        }
      />

      {isSelf && (
        <AccountSwitcherSheet
          visible={switcherVisible}
          currentUserId={currentUserId}
          accountIds={savedAccountIds}
          unreadByAccount={otherUnread}
          onClose={() => setSwitcherVisible(false)}
          onSelectAccount={(id) => {
            setSwitcherVisible(false);
            onSwitchAccount(id);
          }}
          onAddAccount={() => {
            setSwitcherVisible(false);
            onAddAccount();
          }}
        />
      )}

      <ProfileOptionsSheet
        visible={optionsVisible}
        targetUserId={viewedUserId}
        targetUsername={user?.username}
        viewerId={currentUserId}
        onClose={() => setOptionsVisible(false)}
      />

      {isSelf && user && (
        <EditProfileModal
          visible={editVisible}
          userId={currentUserId}
          currentName={user.name ?? ''}
          currentUsername={user.username ?? ''}
          currentAvatarUrl={user.avatarUrl}
          currentBio={user.bio ?? ''}
          currentPronouns={user.pronouns ?? ''}
          currentLink={user.link ?? ''}
          onClose={() => setEditVisible(false)}
        />
      )}

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

// Only ever mounted for the signed-in user's own profile (isSelf) — see
// the "Edit profile" button, which sits where Follow/Message appear on
// anyone else's profile.
function EditProfileModal({
  visible,
  userId,
  currentName,
  currentUsername,
  currentAvatarUrl,
  currentBio,
  currentPronouns,
  currentLink,
  onClose,
}: {
  visible: boolean;
  userId: Id<'users'>;
  currentName: string;
  currentUsername: string;
  currentAvatarUrl: string | null;
  currentBio: string;
  currentPronouns: string;
  currentLink: string;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const { t } = useTranslation(['profile', 'common']);
  const styles = createStyles(colors);
  const updateProfile = useMutation(api.users.updateProfile);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);

  const [name, setName] = useState(currentName);
  const [username, setUsername] = useState(currentUsername);
  const [debouncedUsername, setDebouncedUsername] = useState(currentUsername);
  const [bio, setBio] = useState(currentBio);
  const [pronouns, setPronouns] = useState(currentPronouns);
  const [link, setLink] = useState(currentLink);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(currentName);
    setUsername(currentUsername);
    setDebouncedUsername(currentUsername);
    setBio(currentBio);
    setPronouns(currentPronouns);
    setLink(currentLink);
    setAvatarUri(null);
    setError('');
  }, [visible, currentName, currentUsername, currentBio, currentPronouns, currentLink]);

  useEffect(() => {
    const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const handle = setTimeout(() => setDebouncedUsername(normalized), 300);
    return () => clearTimeout(handle);
  }, [username]);

  const usernameChanged = debouncedUsername !== currentUsername.toLowerCase();
  const usernameAvailable = useQuery(
    api.users.isUsernameAvailable,
    usernameChanged && debouncedUsername.length >= 3 ? { username: debouncedUsername } : 'skip'
  );

  const canSave =
    name.trim().length > 0 &&
    debouncedUsername.length >= 3 &&
    (!usernameChanged || usernameAvailable === true);

  let usernameHint = '';
  if (username.length > 0 && debouncedUsername.length < 3) {
    usernameHint = t('usernameMinLengthHint');
  } else if (usernameChanged && usernameAvailable === false) {
    usernameHint = t('usernameTakenHint');
  }

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('photoAccessDeniedError'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const save = async () => {
    if (!canSave || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      let avatarStorageId: Id<'_storage'> | undefined;
      if (avatarUri) {
        const uploadUrl = await generateUploadUrl({ userId });
        avatarStorageId = (await uploadFileToConvex(
          avatarUri,
          uploadUrl,
          'image/jpeg'
        )) as Id<'_storage'>;
      }
      await updateProfile({
        userId,
        name: name.trim(),
        username: debouncedUsername,
        avatarStorageId,
        bio,
        pronouns,
        link,
      });
      onClose();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const displayAvatar = avatarUri ?? currentAvatarUrl;

  return (
    <FormModal
      visible={visible}
      title={t('editProfileTitle')}
      subtitle={t('editProfileSubtitle')}
      icon={PencilEdit01Icon}
      onClose={onClose}
      footer={<PrimaryButton label={t('saveChangesButton')} loading={submitting} disabled={!canSave} onPress={save} />}
    >
      <Pressable style={styles.editAvatarButton} onPress={pickAvatar}>
        {displayAvatar ? (
          <Image source={{ uri: displayAvatar }} style={styles.editAvatarImage} />
        ) : (
          <View style={styles.editAvatarFallback}>
            <HugeiconsIcon icon={PencilEdit01Icon} size={22} color={colors.white} />
          </View>
        )}
        <View style={styles.editAvatarBadge}>
          <HugeiconsIcon icon={PencilEdit01Icon} size={12} color="#ffffff" />
        </View>
      </Pressable>

      <View style={styles.editFieldGroup}>
        <TextField placeholder={t('namePlaceholder')} value={name} onChangeText={setName} maxLength={40} />
        <TextField
          placeholder={t('usernamePlaceholder')}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          maxLength={30}
          error={usernameHint || undefined}
        />
        <TextField
          placeholder={t('bioPlaceholder')}
          value={bio}
          onChangeText={setBio}
          maxLength={150}
          multiline
          style={styles.bioInput}
        />
        <TextField
          placeholder={t('pronounsPlaceholder')}
          value={pronouns}
          onChangeText={setPronouns}
          autoCapitalize="none"
          maxLength={30}
        />
        <TextField
          placeholder={t('linkPlaceholder')}
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          keyboardType="url"
          maxLength={100}
        />
      </View>

      {error !== '' && <Text variant="footnote" style={styles.editError}>{error}</Text>}
    </FormModal>
  );
}

function ProfileClipTile({
  mediaUrl,
  onPress,
}: {
  mediaUrl: string | null;
  onPress: () => void;
}) {
  const player = useVideoPlayer(mediaUrl ? { uri: mediaUrl } : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <Pressable style={tileStyles.tile} onPress={onPress}>
      {mediaUrl && (
        // surfaceType="textureView" — see ClipTile.tsx: the default
        // SurfaceView composites above everything else on Android and can
        // swallow touches meant for this Pressable regardless of
        // pointerEvents/z-order.
        <VideoView
          style={tileStyles.media}
          player={player}
          nativeControls={false}
          contentFit="cover"
          surfaceType="textureView"
          pointerEvents="none"
        />
      )}
      <View style={tileStyles.playBadge}>
        <HugeiconsIcon icon={PlayIcon} size={11} color="#ffffff" />
      </View>
    </Pressable>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    width: GRID_TILE_SIZE,
    height: GRID_TILE_SIZE * 1.4,
    borderRadius: radius.xs,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  media: {
    ...StyleSheet.absoluteFill,
  },
  playBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});

const createStyles = (colors: Colors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: space.xxl,
    paddingBottom: NAV_BAR_HEIGHT + space.xl,
  },
  scrollContentWithHeader: {
    paddingTop: HEADER_HEIGHT + space.md,
  },
  header: {
    paddingHorizontal: space.xl,
    marginBottom: space.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  headerTopText: {
    flex: 1,
    gap: space.sm,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
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
    ...typography.display,
    fontFamily: 'Poppins_600SemiBold',
    color: '#ffffff',
  },
  blockedHeader: {
    alignItems: 'center',
  },
  blockedAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBackground,
  },
  blockedTitle: {
    marginTop: space.lg,
    ...typography.h2,
    textAlign: 'center',
  },
  blockedBody: {
    marginTop: space.xs,
    ...typography.body,
    textAlign: 'center',
    color: colors.textMuted,
    paddingHorizontal: space.sm,
  },
  unblockButton: {
    marginTop: space.lg,
    height: 46,
    paddingHorizontal: space.xl,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.buttonBackground,
  },
  unblockButtonText: {
    color: colors.buttonText,
    ...typography.bodyBold,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
  },
  // A confident but not oversized name — it now shares a row with the
  // avatar and stats rather than standing alone as the page's biggest
  // element, so h2 (not h1) keeps it from crowding the stat row beside it.
  name: {
    ...typography.h2,
    color: colors.white,
    flexShrink: 1,
  },
  nameSkeleton: {
    width: 140,
    height: 22,
    borderRadius: radius.xs,
  },
  usernameSkeleton: {
    marginTop: space.xs,
    width: 100,
    height: 15,
    borderRadius: 6,
  },
  countsSkeleton: {
    marginTop: space.sm,
    width: 180,
    height: 20,
    borderRadius: 6,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.md,
  },
  // Every profile action (Edit/Share profile, Follow, Message) shares one
  // compact size, radius and type so the row reads as a single control set.
  actionButtonFlex: {
    flex: 1,
    height: ACTION_HEIGHT,
    borderRadius: radius.xs,
    paddingHorizontal: space.sm,
  },
  actionButton: {
    flex: 1,
    height: ACTION_HEIGHT,
    borderRadius: radius.xs,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.buttonSecondary,
  },
  actionButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
    color: colors.white,
  },
  bio: {
    ...typography.callout,
    color: colors.white,
    marginTop: space.md,
  },
  metaLine: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: space.xxs,
  },
  editAvatarButton: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    marginBottom: space.xl,
  },
  editAvatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.buttonSecondary,
  },
  editAvatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.buttonSecondary,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coral,
    borderWidth: 3,
    borderColor: colors.background,
  },
  bioInput: {
    height: 88,
    paddingTop: space.sm,
    textAlignVertical: 'top',
  },
  editFieldGroup: {
    gap: space.sm,
  },
  editError: {
    marginTop: space.md,
    color: colors.errorText,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
  },
  activityButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    marginBottom: space.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: space.xl,
    gap: GRID_GAP,
  },
  emptyState: {
    marginTop: space.sm,
  },
});
