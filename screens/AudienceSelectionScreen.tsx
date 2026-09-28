import { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import PostAudienceSwitch from '../components/PostAudienceSwitch';
import PrimaryButton from '../components/PrimaryButton';
import WheelPicker from '../components/WheelPicker';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { circles, Colors, radius, space, typography } from '../theme';
import { compressMedia, getMediaAspect } from '../compressMedia';
import { readableError } from '../errorMessage';
import { uploadFileToConvex } from '../uploadMedia';
import useEntranceAnimation from '../useEntranceAnimation';
import type { DraftPoll } from '../components/CreationOptionsMenu';
import {
  clampExpiryMs,
  customExpiryMs,
  EXPIRY_PRESETS,
  ExpiryPresetKey,
} from '../postExpiry';
import type { CapturedMedia, PostKind } from './CameraScreen';
import type { PersistedSound, PersistedTextOverlay } from './EditMediaScreen';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CUSTOM_DAYS = Array.from({ length: 61 }, (_, i) => String(i));
const CUSTOM_HOURS = Array.from({ length: 24 }, (_, i) => String(i));
const CUSTOM_MINUTES = Array.from({ length: 60 }, (_, i) => String(i));

export type Audience = 'circles' | 'global';

export default function AudienceSelectionScreen({
  userId,
  media,
  extraMedia,
  kind,
  title,
  caption,
  containsAi,
  creatorLanguage,
  poll,
  textOverlay,
  sound,
  onBack,
  onPosted,
}: {
  userId: Id<'users'>;
  media: CapturedMedia;
  // More pictures posted together with `media` as one swipeable post.
  extraMedia?: CapturedMedia[];
  // Stories never reach this screen — they go through StoryAudienceScreen
  // and createStory instead, hence the narrower type than PostKind.
  kind: Exclude<PostKind, 'story'>;
  title: string;
  caption: string;
  containsAi: boolean;
  creatorLanguage: string | null;
  poll: DraftPoll | null;
  textOverlay: PersistedTextOverlay | null;
  sound: PersistedSound;
  onBack: () => void;
  onPosted: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation(['audienceSelection', 'common']);
  const entrance = useEntranceAnimation();
  // Clips are TikTok-style public content, so default them to Global instead
  // of Circles — still switchable, just a saner starting point.
  const [audience, setAudience] = useState<Audience>(kind === 'clip' ? 'global' : 'circles');
  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>(['best-friends']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-delete — only ever offered for circles-audience content (see
  // convex/posts.ts createPost, which also enforces this server-side).
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(false);
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPresetKey>('7d');
  const [customDays, setCustomDays] = useState(1);
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(0);

  // Switching away from Circles isn't a valid state for auto-delete —
  // turn it back off so a stale selection can't sneak into the request.
  useEffect(() => {
    if (audience !== 'circles') setAutoDeleteEnabled(false);
  }, [audience]);

  const expiresInMs =
    audience === 'circles' && autoDeleteEnabled
      ? expiryPreset === 'custom'
        ? clampExpiryMs(customExpiryMs(customDays, customHours, customMinutes))
        : (EXPIRY_PRESETS.find((p) => p.key === expiryPreset)?.ms ?? undefined)
      : undefined;

  const myCircles = useQuery(api.userCircles.listMyCircles, { userId });
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
  const createPost = useMutation(api.posts.createPost);

  // "All" is its own audience — every one of your friends — not a shortcut
  // that also selects every custom circle you own. Selecting it clears any
  // custom circles so the post doesn't also reach non-friend circle members;
  // picking a custom circle clears "All" the same way, so the two audiences
  // stay distinct instead of silently combining.
  const allColor = colors[circles.find((c) => c.id === 'all')!.colorKey];
  const isAllSelected = selectedCircleIds.length === 1 && selectedCircleIds[0] === 'best-friends';

  const selectAll = () => setSelectedCircleIds(['best-friends']);

  const circleOptions = (myCircles ?? []).map((circle) => ({
    id: circle._id as string,
    label: circle.name,
    color: circle.color,
  }));

  const toggleCustomCircle = (id: string) => {
    setSelectedCircleIds((current) => {
      const withoutAll = current.filter((c) => c !== 'best-friends');
      return withoutAll.includes(id)
        ? withoutAll.filter((c) => c !== id)
        : [...withoutAll, id];
    });
  };

  const canShare = audience === 'global' || selectedCircleIds.length > 0;

  const handleShare = async () => {
    if (!canShare || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const compressedUri = await compressMedia(media.uri, media.type);
      const mediaAspect = await getMediaAspect(
        media.type === 'photo' ? compressedUri : media.uri,
        media.type,
        media.previewAspect
      );
      const uploadUrl = await generateUploadUrl({ userId });
      const storageId = await uploadFileToConvex(
        compressedUri,
        uploadUrl,
        media.type === 'photo' ? 'image/jpeg' : 'video/mp4'
      );

      const extraMediaStorageIds: Id<'_storage'>[] = [];
      for (const extra of extraMedia ?? []) {
        const extraUri = await compressMedia(extra.uri, 'photo');
        const extraUploadUrl = await generateUploadUrl({ userId });
        extraMediaStorageIds.push(
          (await uploadFileToConvex(extraUri, extraUploadUrl, 'image/jpeg')) as Id<'_storage'>
        );
      }

      await createPost({
        authorId: userId,
        title: title || undefined,
        caption: caption || undefined,
        containsAi,
        creatorLanguage: creatorLanguage ?? undefined,
        poll: poll ?? undefined,
        expiresInMs,
        mediaStorageId: storageId as Id<'_storage'>,
        mediaType: media.type,
        mediaAspect,
        extraMediaStorageIds: extraMediaStorageIds.length > 0 ? extraMediaStorageIds : undefined,
        audience,
        circleIds: audience === 'circles' ? selectedCircleIds : undefined,
        kind,
        textOverlay: textOverlay ?? undefined,
        soundId: sound?.kind === 'picked' ? sound.soundId : undefined,
        soundVolume: sound?.kind === 'picked' ? sound.soundVolume : undefined,
        originalVolume: sound?.kind === 'picked' ? sound.originalVolume : undefined,
        audioMode: sound?.kind === 'picked' ? sound.audioMode : undefined,
        useOwnAudioAsSound: sound?.kind === 'own',
      });

      onPosted();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
      </Pressable>

      <Animated.View style={[styles.titleWrap, entrance]}>
        <Text style={styles.title}>{t('titleText')}</Text>
        <Text style={styles.subtitle}>{t('subtitleText')}</Text>
      </Animated.View>

      <Animated.View style={[styles.options, entrance]}>
        <PostAudienceSwitch value={audience} onChange={setAudience} />

        <Text style={styles.audienceDescription}>
          {audience === 'circles'
            ? t('circlesDescription')
            : t('globalDescription')}
        </Text>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {audience === 'circles' && (
            <View style={styles.circleList}>
              <Pressable
                style={styles.circleRow}
                onPress={selectAll}
              >
                <View style={[styles.circleDot, { backgroundColor: allColor }]} />
                <Text style={styles.circleRowLabel}>{t('allCirclesLabel')}</Text>
                <View style={[styles.check, isAllSelected && styles.checkSelected]}>
                  {isAllSelected && <HugeiconsIcon icon={Tick02Icon} size={15} color="#ffffff" />}
                </View>
              </Pressable>

              {circleOptions.map((circle) => {
                const isSelected = selectedCircleIds.includes(circle.id);
                return (
                  <Pressable
                    key={circle.id}
                    onPress={() => toggleCustomCircle(circle.id)}
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
          )}

          {audience === 'circles' && (
            <View style={styles.expirySection}>
              <View style={styles.expiryHeaderRow}>
                <View style={styles.expiryHeaderText}>
                  <Text style={styles.expiryTitle}>{t('autoDeleteTitle')}</Text>
                  <Text style={styles.expirySubtitle}>
                    {t('autoDeleteDescription', {
                      kind: kind === 'clip' ? t('clipWord') : t('postWord'),
                    })}
                  </Text>
                </View>
                <Switch
                  value={autoDeleteEnabled}
                  onValueChange={setAutoDeleteEnabled}
                  trackColor={{ false: colors.buttonSecondary, true: colors.buttonBackground }}
                  thumbColor={colors.white}
                />
              </View>

              {autoDeleteEnabled && (
                <>
                  <View style={styles.expiryPresetRow}>
                    {EXPIRY_PRESETS.map((preset) => {
                      const isSelected = expiryPreset === preset.key;
                      return (
                        <Pressable
                          key={preset.key}
                          style={[styles.expiryChip, isSelected && styles.expiryChipActive]}
                          onPress={() => setExpiryPreset(preset.key)}
                        >
                          <Text
                            style={[styles.expiryChipText, isSelected && styles.expiryChipTextActive]}
                          >
                            {preset.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {expiryPreset === 'custom' && (
                    <View style={styles.customPickerWrap}>
                      <View style={styles.customPickerColumn}>
                        <Text style={styles.customPickerLabel}>{t('daysLabel')}</Text>
                        <WheelPicker
                          data={CUSTOM_DAYS}
                          selectedIndex={customDays}
                          onChange={setCustomDays}
                        />
                      </View>
                      <View style={styles.customPickerColumn}>
                        <Text style={styles.customPickerLabel}>{t('hoursLabel')}</Text>
                        <WheelPicker
                          data={CUSTOM_HOURS}
                          selectedIndex={customHours}
                          onChange={setCustomHours}
                        />
                      </View>
                      <View style={styles.customPickerColumn}>
                        <Text style={styles.customPickerLabel}>{t('minutesLabel')}</Text>
                        <WheelPicker
                          data={CUSTOM_MINUTES}
                          selectedIndex={customMinutes}
                          onChange={setCustomMinutes}
                        />
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.shareButtonWrap}>
        <PrimaryButton label={t('common:share')} onPress={handleShare} disabled={!canShare} loading={submitting} />
      </View>

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
    paddingTop: space.xxl,
    paddingBottom: space.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    marginTop: space.xxl,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    color: colors.white,
  },
  subtitle: {
    marginTop: space.xs,
    ...typography.body,
    color: colors.textMuted,
  },
  options: {
    marginTop: space.xxl,
    alignItems: 'center',
  },
  audienceDescription: {
    marginTop: -8,
    marginBottom: space.lg,
    ...typography.footnote,
    color: colors.textMuted,
    textAlign: 'center',
  },
  scroll: {
    width: '100%',
    alignSelf: 'stretch',
    maxHeight: SCREEN_HEIGHT * 0.42,
  },
  circleList: {
    width: '100%',
    gap: space.sm,
  },
  expirySection: {
    width: '100%',
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  expiryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  expiryHeaderText: {
    flex: 1,
    gap: 3,
  },
  expiryTitle: {
    ...typography.bodyBold,
    color: colors.white,
  },
  expirySubtitle: {
    ...typography.caption,
    lineHeight: 16,
    color: colors.textMuted,
  },
  expiryPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.md,
  },
  expiryChip: {
    paddingHorizontal: space.md,
    height: 34,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.buttonSecondary,
  },
  expiryChipActive: {
    backgroundColor: colors.coral,
  },
  expiryChipText: {
    ...typography.footnote,
    fontFamily: 'Poppins_600SemiBold',
    color: colors.white,
  },
  expiryChipTextActive: {
    color: colors.accentText,
  },
  customPickerWrap: {
    flexDirection: 'row',
    marginTop: space.md,
  },
  customPickerColumn: {
    flex: 1,
  },
  customPickerLabel: {
    ...typography.caption,
    fontFamily: 'Poppins_600SemiBold',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: space.xxs,
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
    ...typography.callout,
    fontFamily: 'Poppins_600SemiBold',
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
  error: {
    marginTop: space.md,
    color: colors.errorText,
    ...typography.footnote,
    textAlign: 'center',
  },
  shareButtonWrap: {
    marginTop: space.md,
  },
});
