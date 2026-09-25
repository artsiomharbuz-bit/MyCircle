import AppTextInput from '../components/AppTextInput';
import { useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, MoreHorizontalIcon } from '@hugeicons/core-free-icons';
import CreationOptionsMenu, { DraftPoll } from '../components/CreationOptionsMenu';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import useEntranceAnimation from '../useEntranceAnimation';
import { MIN_POLL_OPTIONS } from '../pollOptions';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';
import type { CapturedMedia, PostKind } from './CameraScreen';

export type PostDetails = {
  title: string;
  caption: string;
  containsAi: boolean;
  language: string | null;
  poll: DraftPoll | null;
};

// A poll with a blank question or fewer than MIN_POLL_OPTIONS filled-in
// options isn't submittable — treated as "no poll" rather than blocking
// the whole post, so toggling the switch on and immediately continuing
// doesn't trap the user.
function validPoll(poll: DraftPoll | null): DraftPoll | null {
  if (!poll) return null;
  const question = poll.question.trim();
  const options = poll.options.map((o) => o.trim()).filter(Boolean);
  if (!question || options.length < MIN_POLL_OPTIONS) return null;
  return { question, options };
}

export default function PostDetailsScreen({
  userId,
  media,
  kind,
  onBack,
  onNext,
}: {
  userId: Id<'users'>;
  media: CapturedMedia;
  // Stories never reach this screen — they go through StoryAudienceScreen
  // instead, hence the narrower type than PostKind.
  kind: Exclude<PostKind, 'story'>;
  onBack: () => void;
  onNext: (details: PostDetails) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [containsAi, setContainsAi] = useState(false);
  const [language, setLanguage] = useState<string | null>(null);
  const [poll, setPoll] = useState<DraftPoll | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const entrance = useEntranceAnimation();
  const languageOptions = useQuery(api.users.listCommonLanguages, {}) ?? [];

  const player = useVideoPlayer(media.type === 'video' ? { uri: media.uri } : null, (p) => {
    if (media.type === 'video') {
      p.loop = true;
      p.play();
    }
  });

  const toggleVideoPlayback = () => {
    if (media.type !== 'video') return;
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
      </Pressable>

      <Animated.View style={[styles.postForm, entrance]}>
        <AppTextInput
          style={styles.input}
          placeholder="Title (optional)"
          placeholderTextColor={colors.placeholder}
          value={title}
          onChangeText={setTitle}
          cursorColor={colors.coral}
        />

        <View style={styles.divider} />

        <AppTextInput
          style={[styles.input, styles.captionInput]}
          placeholder="Caption (optional)"
          placeholderTextColor={colors.placeholder}
          value={caption}
          onChangeText={setCaption}
          multiline
          cursorColor={colors.coral}
        />

        <Pressable style={styles.postMediaWrap} onPress={toggleVideoPlayback}>
          {media.type === 'photo' ? (
            <Image source={{ uri: media.uri }} style={styles.postMedia} resizeMode="cover" />
          ) : (
            <VideoView
              style={styles.postMedia}
              player={player}
              nativeControls={false}
              contentFit="cover"
            />
          )}
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.bottomSection, entrance]}>
        <Pressable style={styles.optionsRow} onPress={() => setOptionsVisible(true)}>
          <HugeiconsIcon icon={MoreHorizontalIcon} size={18} color={colors.textMuted} />
          <Text variant="bodyBold" style={styles.optionsLabel}>Options</Text>
          <View style={styles.optionsBadgeRow}>
            {containsAi && (
              <Text variant="micro" style={styles.optionsBadge}>Contains AI</Text>
            )}
            {validPoll(poll) && (
              <Text variant="micro" style={styles.optionsBadge}>Poll</Text>
            )}
          </View>
        </Pressable>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.nextButton}
            onPress={() =>
              onNext({
                title: title.trim(),
                caption: caption.trim(),
                containsAi,
                language,
                poll: validPoll(poll),
              })
            }
          >
            <Text variant="h3" style={styles.nextButtonText}>Next</Text>
          </Pressable>
        </View>
      </Animated.View>

      <CreationOptionsMenu
        visible={optionsVisible}
        containsAi={containsAi}
        onChangeContainsAi={setContainsAi}
        language={language}
        onChangeLanguage={setLanguage}
        languageOptions={languageOptions}
        poll={poll}
        onChangePoll={setPoll}
        onClose={() => setOptionsVisible(false)}
      />

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: space.xl,
    paddingTop: 40,
    paddingBottom: space.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    fontFamily: 'Poppins_400Regular',
    minHeight: 44,
    paddingHorizontal: 2,
    color: colors.white,
    fontSize: 17,
  },
  captionInput: {
    marginTop: space.xxs,
    minHeight: 90,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlignVertical: 'top',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },

  // ---- Shared field layout: title -> divider -> caption -> media preview ----
  postForm: {
    marginTop: space.xl,
    gap: space.sm,
  },
  postMediaWrap: {
    width: '100%',
    height: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  postMedia: {
    flex: 1,
  },

  // ---- Bottom section: options + next button, pinned to the screen bottom ----
  bottomSection: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  optionsRow: {
    minHeight: 56,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    backgroundColor: colors.inputBackground,
  },
  optionsLabel: {
    color: colors.white,
  },
  optionsBadgeRow: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: space.xs,
  },
  optionsBadge: {
    color: colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  nextButton: {
    flex: 1,
    height: 56,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.buttonBackground,
  },
  nextButtonText: {
    color: colors.buttonText,
  },
});
