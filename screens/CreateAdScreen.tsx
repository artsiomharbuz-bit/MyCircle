import AppTextInput from '../components/AppTextInput';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  Image02Icon,
  PlayIcon,
  Video01Icon,
} from '@hugeicons/core-free-icons';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, textToolColors, typography } from '../theme';
import { AdKind, adDailyPrice, formatUsd } from '../adPricing';
import { compressMedia, compressPhoto } from '../compressMedia';
import { readableError } from '../errorMessage';
import { uploadFileToConvex } from '../uploadMedia';
import { cityNameForCoordinates, coordinatesForCity, normalizeLocationName } from '../convex/lib/locations';
import { useTranslation } from 'react-i18next';

const RADIUS_PRESETS_KM = [10, 25, 50, 100];

export type MyAd = {
  _id: Id<'ads'>;
  postId: Id<'posts'>;
  kind: AdKind;
  status: 'pending_review' | 'rejected' | 'approved' | 'active' | 'expired';
  rejectionReason: string | null;
  billingPlan: 'daily' | 'monthly' | null;
  activeUntil: number | null;
  createdAt: number;
  title: string;
  caption: string;
  mediaType: 'photo' | 'video';
  mediaUrl: string | null;
  link: string;
  buttonText: string;
  buttonColor: string;
  displayName: string;
  displayAvatarUrl: string | null;
  displayAvatarGradient: string[] | null;
  targetLocations?: string[];
  targetGeo?: { lat: number; lng: number; radiusKm: number } | null;
  targetLanguages?: string[];
};

type Step = 'type' | 'media' | 'details' | 'destination' | 'targeting' | 'persona' | 'review';

const CTA_COLORS = textToolColors.filter((c) => c !== '#ffffff' && c !== '#000000');

export default function CreateAdScreen({
  userId,
  editingAd,
  onBack,
  onDone,
}: {
  userId: Id<'users'>;
  // null creates a new ad; a rejected ad passed here edits + resubmits it.
  editingAd: MyAd | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation(['createAd', 'common']);

  const steps: Step[] = editingAd
    ? ['media', 'details', 'destination', 'targeting', 'persona', 'review']
    : ['type', 'media', 'details', 'destination', 'targeting', 'persona', 'review'];
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  const [kind, setKind] = useState<AdKind>(editingAd?.kind ?? 'post');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>(editingAd?.mediaType ?? 'photo');
  const [title, setTitle] = useState(editingAd?.title ?? '');
  const [caption, setCaption] = useState(editingAd?.caption ?? '');
  const [link, setLink] = useState(editingAd?.link ?? '');
  const [buttonText, setButtonText] = useState(editingAd?.buttonText ?? '');
  const [buttonColor, setButtonColor] = useState(editingAd?.buttonColor ?? CTA_COLORS[8]);
  const [targetLocations, setTargetLocations] = useState<string[]>(editingAd?.targetLocations ?? []);
  const [locationInput, setLocationInput] = useState('');
  const [targetLanguages, setTargetLanguages] = useState<string[]>(editingAd?.targetLanguages ?? []);
  const [radiusCity, setRadiusCity] = useState(
    editingAd?.targetGeo ? cityNameForCoordinates(editingAd.targetGeo.lat, editingAd.targetGeo.lng) ?? '' : ''
  );
  const [radiusKm, setRadiusKm] = useState<number | null>(editingAd?.targetGeo?.radiusKm ?? null);
  const [displayName, setDisplayName] = useState(editingAd?.displayName ?? '');
  const [displayAvatarUri, setDisplayAvatarUri] = useState<string | null>(null);
  const [displayGradient, setDisplayGradient] = useState<[string, string]>(
    (editingAd?.displayAvatarGradient as [string, string]) ?? [colors.red, colors.coral]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.ads.generateUploadUrl);
  const createAd = useMutation(api.ads.createAd);
  const updateAd = useMutation(api.ads.updateAd);
  const commonLanguages = useQuery(api.users.listCommonLanguages, {});

  const radiusCityCoords = radiusCity.trim() ? coordinatesForCity(normalizeLocationName(radiusCity)) : null;
  const targetGeo = radiusCityCoords && radiusKm ? { ...radiusCityCoords, radiusKm } : undefined;

  const audienceEstimate = useQuery(api.ads.estimateAdAudience, {
    targetLocations,
    targetLanguages,
    targetGeo,
  });

  const addLocation = () => {
    const trimmed = locationInput.trim();
    if (!trimmed) return;
    setTargetLocations((current) => (current.includes(trimmed) ? current : [...current, trimmed]));
    setLocationInput('');
  };
  const removeLocation = (city: string) => {
    setTargetLocations((current) => current.filter((c) => c !== city));
  };
  const toggleTargetLanguage = (code: string) => {
    setTargetLanguages((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code]
    );
  };

  const previewMediaUri = mediaUri ?? editingAd?.mediaUrl ?? null;
  const previewAvatarUri = displayAvatarUri ?? editingAd?.displayAvatarUrl ?? null;

  const player = useVideoPlayer(
    step === 'media' || step === 'review'
      ? previewMediaUri && mediaType === 'video'
        ? { uri: previewMediaUri }
        : null
      : null,
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    }
  );

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'clip' ? ['videos'] : ['images', 'videos'],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setMediaUri(asset.uri);
    setMediaType(asset.type === 'video' ? 'video' : 'photo');
  };

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setDisplayAvatarUri(result.assets[0].uri);
  };

  const canContinue = (() => {
    switch (step) {
      case 'type':
        return true;
      case 'media':
        return previewMediaUri !== null;
      case 'details':
        return true;
      case 'destination':
        return link.trim().length > 0 && buttonText.trim().length > 0;
      case 'targeting':
        return true;
      case 'persona':
        return displayName.trim().length > 0;
      case 'review':
        return true;
    }
  })();

  const goNext = () => {
    if (!canContinue) return;
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      handleSubmit();
    }
  };

  const goBack = () => {
    if (stepIndex === 0) {
      onBack();
    } else {
      setStepIndex((i) => i - 1);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let mediaStorageId: Id<'_storage'> | undefined;
      if (mediaUri) {
        const compressed = await compressMedia(mediaUri, mediaType);
        const uploadUrl = await generateUploadUrl({ userId });
        mediaStorageId = (await uploadFileToConvex(
          compressed,
          uploadUrl,
          mediaType === 'photo' ? 'image/jpeg' : 'video/mp4'
        )) as Id<'_storage'>;
      }

      let displayAvatarStorageId: Id<'_storage'> | undefined;
      if (displayAvatarUri) {
        const compressed = await compressPhoto(displayAvatarUri);
        const uploadUrl = await generateUploadUrl({ userId });
        displayAvatarStorageId = (await uploadFileToConvex(
          compressed,
          uploadUrl,
          'image/jpeg'
        )) as Id<'_storage'>;
      }

      if (editingAd) {
        await updateAd({
          adId: editingAd._id,
          creatorId: userId,
          title,
          caption,
          ...(mediaStorageId ? { mediaStorageId, mediaType } : {}),
          link,
          buttonText,
          buttonColor,
          displayName,
          ...(displayAvatarStorageId ? { displayAvatarStorageId } : {}),
          displayAvatarGradient: displayGradient,
          targetLocations,
          targetGeo,
          targetLanguages,
        });
      } else {
        if (!mediaStorageId) throw new Error(t('addMediaBeforeSubmittingError'));
        await createAd({
          creatorId: userId,
          kind,
          title: title || undefined,
          caption: caption || undefined,
          mediaStorageId,
          mediaType,
          link,
          buttonText,
          buttonColor,
          displayName,
          displayAvatarStorageId,
          displayAvatarGradient: displayAvatarStorageId ? undefined : displayGradient,
          targetLocations: targetLocations.length > 0 ? targetLocations : undefined,
          targetGeo,
          targetLanguages: targetLanguages.length > 0 ? targetLanguages : undefined,
        });
      }

      onDone();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={goBack}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </Pressable>
        <View style={styles.progressRow}>
          {steps.map((s, i) => (
            <View
              key={s}
              style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'type' && (
          <StepBlock title={t('typeStepTitle')} subtitle={t('typeStepSubtitle')}>
            <View style={styles.typeList}>
              <TypeCard
                label={t('postAdLabel')}
                description={t('postAdDescription')}
                price={formatUsd(adDailyPrice('post'))}
                selected={kind === 'post'}
                onPress={() => setKind('post')}
                icon={Image02Icon}
              />
              <TypeCard
                label={t('clipAdLabel')}
                description={t('clipAdDescription')}
                price={formatUsd(adDailyPrice('clip'))}
                selected={kind === 'clip'}
                onPress={() => setKind('clip')}
                icon={Video01Icon}
              />
            </View>
          </StepBlock>
        )}

        {step === 'media' && (
          <StepBlock
            title={t('mediaStepTitle')}
            subtitle={kind === 'clip' ? t('mediaClipSubtitle') : t('mediaPhotoSubtitle')}
          >
            <Pressable style={styles.mediaPicker} onPress={pickMedia}>
              {previewMediaUri ? (
                mediaType === 'photo' ? (
                  <Image source={{ uri: previewMediaUri }} style={styles.mediaPreview} resizeMode="cover" />
                ) : (
                  <VideoView
                    style={styles.mediaPreview}
                    player={player}
                    nativeControls={false}
                    contentFit="cover"
                  />
                )
              ) : (
                <View style={styles.mediaEmpty}>
                  <HugeiconsIcon icon={Image02Icon} size={28} color={colors.textMuted} />
                  <Text style={styles.mediaEmptyText}>
                    {kind === 'clip' ? t('importVideoText') : t('uploadPhotoOrVideoText')}
                  </Text>
                </View>
              )}
            </Pressable>
            {previewMediaUri && (
              <Pressable onPress={pickMedia}>
                <Text style={styles.changeLink}>{t('chooseDifferentFileText')}</Text>
              </Pressable>
            )}
          </StepBlock>
        )}

        {step === 'details' && (
          <StepBlock title={t('detailsStepTitle')} subtitle={t('detailsStepSubtitle')}>
            <AppTextInput
              style={styles.input}
              placeholder={t('titlePlaceholder')}
              placeholderTextColor={colors.placeholder}
              value={title}
              onChangeText={setTitle}
              cursorColor={colors.coral}
            />
            <AppTextInput
              style={[styles.input, styles.captionInput]}
              placeholder={t('captionPlaceholder')}
              placeholderTextColor={colors.placeholder}
              value={caption}
              onChangeText={setCaption}
              multiline
              cursorColor={colors.coral}
            />
          </StepBlock>
        )}

        {step === 'destination' && (
          <StepBlock title={t('destinationStepTitle')} subtitle={t('destinationStepSubtitle')}>
            <Text style={styles.label}>{t('linkLabel')}</Text>
            <AppTextInput
              style={styles.input}
              placeholder={t('linkPlaceholder')}
              placeholderTextColor={colors.placeholder}
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              cursorColor={colors.coral}
            />

            <Text style={[styles.label, styles.labelSpaced]}>{t('buttonTextLabel')}</Text>
            <AppTextInput
              style={styles.input}
              placeholder={t('buttonTextPlaceholder')}
              placeholderTextColor={colors.placeholder}
              value={buttonText}
              onChangeText={setButtonText}
              maxLength={24}
              cursorColor={colors.coral}
            />

            <Text style={[styles.label, styles.labelSpaced]}>{t('buttonColorLabel')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.swatchRow}
            >
              {CTA_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setButtonColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    buttonColor === c && styles.swatchActive,
                  ]}
                />
              ))}
            </ScrollView>

            {buttonText.trim().length > 0 && (
              <View style={[styles.ctaPreview, { backgroundColor: buttonColor }]}>
                <Text style={styles.ctaPreviewText}>{buttonText}</Text>
              </View>
            )}
          </StepBlock>
        )}

        {step === 'targeting' && (
          <StepBlock
            title={t('targetingStepTitle')}
            subtitle={t('targetingStepSubtitle')}
          >
            <Text style={styles.label}>{t('citiesLabel')}</Text>
            <View style={styles.locationInputRow}>
              <AppTextInput
                style={[styles.input, styles.locationInput]}
                placeholder={t('cityPlaceholder')}
                placeholderTextColor={colors.placeholder}
                value={locationInput}
                onChangeText={setLocationInput}
                onSubmitEditing={addLocation}
                returnKeyType="done"
                cursorColor={colors.coral}
              />
              <Pressable style={styles.addLocationButton} onPress={addLocation}>
                <Text style={styles.addLocationButtonText}>{t('addButton')}</Text>
              </Pressable>
            </View>
            {targetLocations.length > 0 && (
              <View style={styles.chipWrapRow}>
                {targetLocations.map((city) => (
                  <Pressable key={city} style={styles.locationChip} onPress={() => removeLocation(city)}>
                    <Text style={styles.locationChipText}>{city} ✕</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={[styles.label, styles.labelSpaced]}>{t('languagesLabel')}</Text>
            <View style={styles.chipWrapRow}>
              {(commonLanguages ?? []).map((lang) => {
                const selected = targetLanguages.includes(lang.code);
                return (
                  <Pressable
                    key={lang.code}
                    style={[styles.locationChip, selected && styles.locationChipActive]}
                    onPress={() => toggleTargetLanguage(lang.code)}
                  >
                    <Text style={[styles.locationChipText, selected && styles.locationChipTextActive]}>
                      {lang.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, styles.labelSpaced]}>{t('radiusTargetingLabel')}</Text>
            <Text style={styles.radiusHint}>
              {t('radiusHint')}
            </Text>
            <View style={styles.locationInputRow}>
              <AppTextInput
                style={[styles.input, styles.locationInput]}
                placeholder={t('radiusCityPlaceholder')}
                placeholderTextColor={colors.placeholder}
                value={radiusCity}
                onChangeText={setRadiusCity}
                cursorColor={colors.coral}
              />
              {radiusCity.trim().length > 0 && (
                <Pressable style={styles.addLocationButton} onPress={() => { setRadiusCity(''); setRadiusKm(null); }}>
                  <Text style={styles.addLocationButtonText}>{t('clearButton')}</Text>
                </Pressable>
              )}
            </View>
            {radiusCity.trim().length > 0 && !radiusCityCoords && (
              <Text style={styles.radiusWarning}>
                {t('radiusCityNotRecognizedWarning')}
              </Text>
            )}
            {radiusCityCoords && (
              <View style={styles.chipWrapRow}>
                {RADIUS_PRESETS_KM.map((km) => (
                  <Pressable
                    key={km}
                    style={[styles.locationChip, radiusKm === km && styles.locationChipActive]}
                    onPress={() => setRadiusKm(km)}
                  >
                    <Text style={[styles.locationChipText, radiusKm === km && styles.locationChipTextActive]}>
                      {t('radiusKmChip', { km })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.audienceEstimateCard}>
              <Text style={styles.audienceEstimateText}>
                {audienceEstimate
                  ? targetLocations.length === 0 && targetLanguages.length === 0 && !targetGeo
                    ? t('noTargetingText')
                    : audienceEstimate.isExact
                      ? t('audienceEstimateExact', { count: audienceEstimate.estimatedUsers.toLocaleString() })
                      : t('audienceEstimateApprox', { count: audienceEstimate.estimatedUsers.toLocaleString() })
                  : t('estimatingAudienceText')}
              </Text>
            </View>
          </StepBlock>
        )}

        {step === 'persona' && (
          <StepBlock
            title={t('personaStepTitle')}
            subtitle={t('personaStepSubtitle')}
          >
            <Pressable
              style={styles.avatarPicker}
              onPress={() => (previewAvatarUri ? pickAvatar() : setDisplayGradient(newGradient(displayGradient)))}
            >
              {previewAvatarUri ? (
                <Image source={{ uri: previewAvatarUri }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={displayGradient} style={styles.avatarGradient}>
                  <Text style={styles.avatarLetter}>
                    {(displayName || '?').charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
            </Pressable>
            <View style={styles.avatarActions}>
              <Pressable onPress={pickAvatar}>
                <Text style={styles.changeLink}>
                  {previewAvatarUri ? t('choosePhotoText') : t('uploadPhotoText')}
                </Text>
              </Pressable>
              {!previewAvatarUri && (
                <Pressable onPress={() => setDisplayGradient(newGradient(displayGradient))}>
                  <Text style={styles.changeLink}>{t('tryNewColorText')}</Text>
                </Pressable>
              )}
              {previewAvatarUri && (
                <Pressable
                  onPress={() => {
                    setDisplayAvatarUri(null);
                  }}
                >
                  <Text style={styles.changeLink}>{t('useColorInsteadText')}</Text>
                </Pressable>
              )}
            </View>

            <AppTextInput
              style={[styles.input, styles.personaInput]}
              placeholder={t('displayNamePlaceholder')}
              placeholderTextColor={colors.placeholder}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={40}
              cursorColor={colors.coral}
            />
          </StepBlock>
        )}

        {step === 'review' && (
          <StepBlock
            title={t('reviewStepTitle')}
            subtitle={t('reviewStepSubtitle', { price: formatUsd(adDailyPrice(kind)) })}
          >
            <View style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewAvatar}>
                  {previewAvatarUri ? (
                    <Image source={{ uri: previewAvatarUri }} style={styles.avatarImage} />
                  ) : (
                    <LinearGradient colors={displayGradient} style={styles.avatarGradient}>
                      <Text style={styles.avatarLetter}>
                        {(displayName || '?').charAt(0).toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
                <View>
                  <Text style={styles.reviewName}>{displayName || t('displayNameFallback')}</Text>
                  <Text style={styles.reviewSponsored}>{t('sponsoredLabel')}</Text>
                </View>
              </View>

              {title && <Text style={styles.reviewTitle}>{title}</Text>}

              {previewMediaUri && (
                <View style={styles.reviewMediaWrap}>
                  {mediaType === 'photo' ? (
                    <Image source={{ uri: previewMediaUri }} style={styles.reviewMedia} resizeMode="cover" />
                  ) : (
                    <View style={styles.reviewMedia}>
                      <VideoView
                        style={StyleSheet.absoluteFill}
                        player={player}
                        nativeControls={false}
                        contentFit="cover"
                      />
                      <View style={styles.reviewPlayBadge}>
                        <HugeiconsIcon icon={PlayIcon} size={14} color="#ffffff" />
                      </View>
                    </View>
                  )}
                </View>
              )}

              {caption && <Text style={styles.reviewCaption}>{caption}</Text>}

              <View style={[styles.ctaPreview, { backgroundColor: buttonColor }]}>
                <Text style={styles.ctaPreviewText}>{buttonText || t('buttonTextFallback')}</Text>
              </View>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
          </StepBlock>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          onPress={goNext}
          disabled={!canContinue || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text style={styles.continueButtonText}>
              {step === 'review'
                ? editingAd
                  ? t('resubmitButton')
                  : t('submitButton')
                : t('continueButton')}
            </Text>
          )}
        </Pressable>
      </View>

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

function newGradient(current: [string, string]): [string, string] {
  const palette: [string, string][] = [
    ['#f97316', '#ef4444'],
    ['#3b82f6', '#6d28d9'],
    ['#10b981', '#0ea5e9'],
    ['#eab308', '#f97316'],
    ['#ec4899', '#6d28d9'],
  ];
  const options = palette.filter((p) => p[0] !== current[0]);
  return options[Math.floor(Math.random() * options.length)];
}

function StepBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View>
      <Text style={styles.stepTitle}>{title}</Text>
      {subtitle && <Text style={styles.stepSubtitle}>{subtitle}</Text>}
      <View style={styles.stepBody}>{children}</View>
    </View>
  );
}

function TypeCard({
  label,
  description,
  price,
  selected,
  onPress,
  icon,
}: {
  label: string;
  description: string;
  price: string;
  selected: boolean;
  onPress: () => void;
  icon: Parameters<typeof HugeiconsIcon>[0]['icon'];
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation(['createAd', 'common']);
  return (
    <Pressable style={[styles.typeCard, selected && styles.typeCardSelected]} onPress={onPress}>
      <View style={styles.typeIconTile}>
        <HugeiconsIcon icon={icon} size={20} color={colors.white} />
      </View>
      <View style={styles.typeText}>
        <Text style={styles.typeLabel}>{label}</Text>
        <Text style={styles.typeDescription}>{description}</Text>
      </View>
      <Text style={styles.typePrice}>{t('perDayPrice', { price })}</Text>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 40,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.xl,
      paddingBottom: space.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressRow: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
    },
    progressDot: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.buttonSecondary,
    },
    progressDotActive: {
      backgroundColor: colors.coral,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: space.xl,
      paddingBottom: space.xl,
    },
    stepTitle: {
      ...typography.h1,
      fontSize: 26,
      color: colors.white,
    },
    stepSubtitle: {
      marginTop: space.xs,
      ...typography.body,
      color: colors.textMuted,
    },
    stepBody: {
      marginTop: space.xl,
    },
    typeList: {
      gap: space.sm,
    },
    typeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      padding: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeCardSelected: {
      borderColor: colors.coral,
    },
    typeIconTile: {
      width: 42,
      height: 42,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    typeText: {
      flex: 1,
      gap: 2,
    },
    typeLabel: {
      ...typography.bodyBold,
      fontSize: 16,
      color: colors.white,
    },
    typeDescription: {
      ...typography.caption,
      lineHeight: 16,
      color: colors.textMuted,
    },
    typePrice: {
      ...typography.bodyBold,
      color: colors.white,
    },
    mediaPicker: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mediaPreview: {
      flex: 1,
    },
    mediaEmpty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm,
    },
    mediaEmptyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    changeLink: {
      marginTop: space.md,
      ...typography.body,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.coral,
      textAlign: 'center',
    },
    input: {
      fontFamily: 'Poppins_400Regular',
      minHeight: 44,
      paddingHorizontal: 2,
      color: colors.white,
      fontSize: 17,
    },
    captionInput: {
      marginTop: space.md,
      minHeight: 90,
      ...typography.body,
      textAlignVertical: 'top',
    },
    label: {
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: colors.textMuted,
      marginBottom: space.xs,
    },
    labelSpaced: {
      marginTop: space.xl,
    },
    swatchRow: {
      gap: space.sm,
      paddingVertical: 4,
    },
    swatch: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    swatchActive: {
      borderColor: colors.white,
    },
    chipWrapRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.xs,
      marginTop: space.sm,
    },
    locationInputRow: {
      flexDirection: 'row',
      gap: space.sm,
      alignItems: 'center',
    },
    locationInput: {
      flex: 1,
      height: 44,
      borderRadius: radius.input,
      paddingHorizontal: space.sm,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addLocationButton: {
      height: 44,
      paddingHorizontal: space.md,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonSecondary,
    },
    addLocationButtonText: {
      ...typography.callout,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.white,
    },
    locationChip: {
      paddingHorizontal: space.md,
      height: 36,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    locationChipActive: {
      backgroundColor: colors.coral,
      borderColor: colors.coral,
    },
    locationChipText: {
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.white,
    },
    locationChipTextActive: {
      color: colors.accentText,
    },
    radiusHint: {
      marginTop: -4,
      marginBottom: space.sm,
      ...typography.caption,
      lineHeight: 16,
      color: colors.textMuted,
    },
    radiusWarning: {
      marginTop: space.xs,
      ...typography.caption,
      lineHeight: 16,
      color: colors.errorText,
    },
    audienceEstimateCard: {
      marginTop: space.xl,
      padding: space.sm,
      borderRadius: radius.md,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    audienceEstimateText: {
      ...typography.footnote,
      lineHeight: 18,
      color: colors.textMuted,
    },
    ctaPreview: {
      marginTop: space.md,
      height: 48,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaPreviewText: {
      ...typography.bodyBold,
      color: '#ffffff',
    },
    avatarPicker: {
      alignSelf: 'center',
      width: 96,
      height: 96,
      borderRadius: 48,
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
      ...typography.display,
      fontFamily: 'Poppins_600SemiBold',
      color: '#ffffff',
    },
    avatarActions: {
      marginTop: space.md,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: space.lg,
    },
    personaInput: {
      marginTop: space.xl,
      textAlign: 'center',
      fontSize: 18,
    },
    reviewCard: {
      padding: space.md,
      borderRadius: radius.xl,
      backgroundColor: colors.inputBackground,
      gap: space.sm,
    },
    reviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
    },
    reviewAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
    },
    reviewName: {
      ...typography.bodyBold,
      color: colors.white,
    },
    reviewSponsored: {
      ...typography.caption,
      color: colors.textMuted,
    },
    reviewTitle: {
      ...typography.h3,
      fontSize: 18,
      color: colors.white,
    },
    reviewMediaWrap: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: '#111',
    },
    reviewMedia: {
      flex: 1,
    },
    reviewPlayBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    reviewCaption: {
      ...typography.body,
      color: colors.textMuted,
    },
    error: {
      marginTop: space.md,
      ...typography.footnote,
      color: colors.errorText,
      textAlign: 'center',
    },
    footer: {
      paddingHorizontal: space.xl,
      paddingTop: space.sm,
      paddingBottom: space.xxl,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    continueButton: {
      height: 56,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonBackground,
    },
    continueButtonDisabled: {
      opacity: 0.4,
    },
    continueButtonText: {
      color: colors.buttonText,
      ...typography.h3,
      fontFamily: 'Poppins_600SemiBold',
    },
  });
