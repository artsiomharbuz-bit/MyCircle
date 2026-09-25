import AppTextInput from './AppTextInput';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from './AppText';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  Image02Icon,
  Tick02Icon,
  UserStoryIcon,
  VideoReplayIcon,
} from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { circles as BUILT_IN_CIRCLES, Colors, radius, space, typography } from '../theme';
import { getDominantColor } from '../dominantColor';
import { readableError } from '../errorMessage';

type RemixKind = 'post' | 'clip' | 'story';
type Step = 'kind' | 'circles' | 'caption';

export default function RemixSheet({
  visible,
  userId,
  post,
  onClose,
  onPosted,
}: {
  visible: boolean;
  userId: Id<'users'>;
  post: { _id: Id<'posts'>; mediaUrl: string | null; mediaType: 'photo' | 'video' } | null;
  onClose: () => void;
  onPosted: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [step, setStep] = useState<Step>('kind');
  const [kind, setKind] = useState<RemixKind | null>(null);
  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>(['best-friends']);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myCircles = useQuery(api.userCircles.listMyCircles, visible ? { userId } : 'skip');
  const createRemix = useMutation(api.posts.createRemix);
  const allColor = colors[BUILT_IN_CIRCLES.find((c) => c.id === 'best-friends')!.colorKey];

  const reset = () => {
    setStep('kind');
    setKind(null);
    setSelectedCircleIds(['best-friends']);
    setTitle('');
    setCaption('');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const selectKind = (value: RemixKind) => {
    setKind(value);
    setStep('circles');
  };

  const selectAllFriends = () => setSelectedCircleIds(['best-friends']);
  const toggleCircle = (id: string) => {
    setSelectedCircleIds((current) => {
      const withoutAll = current.filter((c) => c !== 'best-friends');
      return withoutAll.includes(id)
        ? withoutAll.filter((c) => c !== id)
        : [...withoutAll, id];
    });
  };

  const handleSubmit = async () => {
    if (!post || !kind || selectedCircleIds.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const remixColor = post.mediaUrl
        ? await getDominantColor(post.mediaUrl, post.mediaType)
        : '#3a3a3a';
      await createRemix({
        authorId: userId,
        sourcePostId: post._id,
        targetKind: kind,
        circleIds: selectedCircleIds,
        title: kind !== 'story' ? title.trim() || undefined : undefined,
        caption: kind !== 'story' ? caption.trim() || undefined : undefined,
        remixColor,
      });
      reset();
      onPosted();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const circleOptions = (myCircles ?? []).map((circle) => ({
    id: circle._id as string,
    label: circle.name,
    color: circle.color,
  }));
  const isAllSelected = selectedCircleIds.length === 1 && selectedCircleIds[0] === 'best-friends';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          {step !== 'kind' && (
            <AnimatedPressable
              style={styles.backButton}
              onPress={() => setStep(step === 'caption' ? 'circles' : 'kind')}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.white} />
            </AnimatedPressable>
          )}
          <Text style={styles.heading}>
            {step === 'kind' ? 'Remix as…' : step === 'circles' ? 'Pick circles' : 'Add a caption'}
          </Text>
        </View>

        {step === 'kind' && (
          <View style={styles.kindList}>
            <Pressable style={styles.kindRow} onPress={() => selectKind('post')}>
              <View style={styles.kindIcon}>
                <HugeiconsIcon icon={Image02Icon} size={20} color={colors.white} />
              </View>
              <Text style={styles.kindLabel}>Post</Text>
            </Pressable>
            <Pressable style={styles.kindRow} onPress={() => selectKind('clip')}>
              <View style={styles.kindIcon}>
                <HugeiconsIcon icon={VideoReplayIcon} size={20} color={colors.white} />
              </View>
              <Text style={styles.kindLabel}>Clip</Text>
            </Pressable>
            <Pressable style={styles.kindRow} onPress={() => selectKind('story')}>
              <View style={styles.kindIcon}>
                <HugeiconsIcon icon={UserStoryIcon} size={20} color={colors.white} />
              </View>
              <Text style={styles.kindLabel}>Story</Text>
            </Pressable>
          </View>
        )}

        {step === 'circles' && (
          <>
            <Text style={styles.subheading}>Remixes can only be shared to circles.</Text>
            <ScrollView style={styles.circleScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.circleList}>
                <Pressable style={styles.circleRow} onPress={selectAllFriends}>
                  <View style={[styles.circleDot, { backgroundColor: allColor }]} />
                  <Text style={styles.circleRowLabel}>All (your friends)</Text>
                  <View style={[styles.check, isAllSelected && styles.checkSelected]}>
                    {isAllSelected && <HugeiconsIcon icon={Tick02Icon} size={15} color="#ffffff" />}
                  </View>
                </Pressable>

                {circleOptions.map((circle) => {
                  const isSelected = selectedCircleIds.includes(circle.id);
                  return (
                    <Pressable
                      key={circle.id}
                      onPress={() => toggleCircle(circle.id)}
                      style={styles.circleRow}
                    >
                      <View style={[styles.circleDot, { backgroundColor: circle.color }]} />
                      <Text style={styles.circleRowLabel}>{circle.label}</Text>
                      <View style={[styles.check, isSelected && styles.checkSelected]}>
                        {isSelected && <HugeiconsIcon icon={Tick02Icon} size={15} color="#ffffff" />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <AnimatedPressable
              style={[
                styles.primaryButton,
                (selectedCircleIds.length === 0 || submitting) && styles.primaryButtonDisabled,
              ]}
              onPress={kind === 'story' ? handleSubmit : () => setStep('caption')}
              disabled={selectedCircleIds.length === 0 || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {kind === 'story' ? 'Remix to Story' : 'Next'}
                </Text>
              )}
            </AnimatedPressable>
          </>
        )}

        {step === 'caption' && (
          <>
            <AppTextInput
              style={styles.input}
              placeholder="Title (optional)"
              placeholderTextColor={colors.placeholder}
              value={title}
              onChangeText={setTitle}
              cursorColor={colors.coral}
            />
            <AppTextInput
              style={[styles.input, styles.captionInput]}
              placeholder="Caption (optional)"
              placeholderTextColor={colors.placeholder}
              value={caption}
              onChangeText={setCaption}
              multiline
              cursorColor={colors.coral}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <AnimatedPressable
              style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {kind === 'clip' ? 'Remix to Clip' : 'Remix to Post'}
                </Text>
              )}
            </AnimatedPressable>
          </>
        )}

        {step === 'circles' && error && <Text style={styles.error}>{error}</Text>}
      </View>
    </Modal>
  );
}

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
      maxHeight: '80%',
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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      marginBottom: space.md,
    },
    backButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heading: {
      ...typography.h2,
      color: colors.white,
    },
    kindList: {
      gap: 10,
    },
    kindRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    kindIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    kindLabel: {
      ...typography.bodyBold,
      color: colors.white,
    },
    subheading: {
      marginTop: -8,
      marginBottom: space.sm,
      ...typography.footnote,
      color: colors.textMuted,
    },
    circleScroll: {
      maxHeight: 320,
    },
    circleList: {
      gap: 10,
      paddingBottom: 4,
    },
    circleRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    circleDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    circleRowLabel: {
      flex: 1,
      ...typography.calloutBold,
      color: colors.white,
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkSelected: {
      backgroundColor: colors.buttonBackground,
      borderColor: colors.buttonBackground,
    },
    input: {
      fontFamily: 'Poppins_400Regular',
      minHeight: 48,
      paddingHorizontal: space.md,
      borderRadius: radius.input,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.white,
      fontSize: 15,
      marginBottom: 10,
    },
    captionInput: {
      minHeight: 90,
      textAlignVertical: 'top',
      paddingTop: 14,
    },
    error: {
      marginTop: space.xxs,
      marginBottom: space.xs,
      color: colors.errorText,
      ...typography.footnote,
      textAlign: 'center',
    },
    primaryButton: {
      marginTop: space.md,
      height: 52,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonBackground,
    },
    primaryButtonDisabled: {
      opacity: 0.4,
    },
    primaryButtonText: {
      ...typography.h3,
      color: colors.buttonText,
    },
  });
