import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Image02Icon, PencilEdit01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { useAppTheme } from '../ThemeContext';
import { Colors, gradientPalette, radius, space, typography } from '../theme';
import { ChatBackground, saveChatBackgroundPhoto } from '../chatBackgrounds';
import { BubbleStyleKey, bubbleStylePresets } from '../chatBubbleStyle';

// Only for this device, only for this one chat — see chatBackgrounds.ts /
// chatBubbleStyle.ts.
export default function ChatBackgroundSheet({
  visible,
  selected,
  bubbleStyle,
  viewerId,
  otherUserId,
  onSelect,
  onSelectBubbleStyle,
  onClose,
}: {
  visible: boolean;
  // null = the default app background (no override).
  selected: ChatBackground | null;
  bubbleStyle: BubbleStyleKey;
  viewerId: string;
  otherUserId: string;
  onSelect: (background: ChatBackground | null) => void;
  onSelectBubbleStyle: (style: BubbleStyleKey) => void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo access was denied.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });
    if (result.canceled) return;

    setPickingPhoto(true);
    try {
      const persistentUri = await saveChatBackgroundPhoto(viewerId, otherUserId, result.assets[0].uri);
      onSelect({ type: 'photo', uri: persistentUri });
    } catch {
      setError("Couldn't save that photo — try again.");
    } finally {
      setPickingPhoto(false);
    }
  };

  const hasPhoto = selected?.type === 'photo';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Customize chat</Text>
        <Text style={styles.subtitle}>Only visible to you — they'll still see the normal chat.</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.sectionLabel}>Background</Text>
        <View style={styles.grid}>
          <Pressable style={styles.swatchWrap} onPress={() => onSelect(null)}>
            <View style={[styles.swatch, styles.defaultSwatch]}>
              {selected === null && (
                <HugeiconsIcon icon={Tick02Icon} size={22} color={colors.white} />
              )}
            </View>
            <Text style={styles.swatchLabel}>Default</Text>
          </Pressable>

          <Pressable style={styles.swatchWrap} onPress={pickPhoto} disabled={pickingPhoto}>
            <View style={[styles.swatch, styles.photoSwatch]}>
              {hasPhoto ? (
                <Image source={{ uri: selected.uri }} style={styles.photoPreview} />
              ) : (
                <HugeiconsIcon icon={Image02Icon} size={22} color={colors.textMuted} />
              )}
              {hasPhoto && (
                // A distinct "tap to change" affordance — the swatch already
                // reopens the picker on tap either way, but without this a
                // photo that's already selected looked "locked in" rather
                // than editable.
                <View style={styles.photoEditBadge}>
                  <HugeiconsIcon icon={PencilEdit01Icon} size={12} color="#ffffff" />
                </View>
              )}
            </View>
            <Text style={styles.swatchLabel}>
              {pickingPhoto ? 'Saving…' : hasPhoto ? 'Change' : 'Photo'}
            </Text>
          </Pressable>

          {gradientPalette.map((swatchColors, index) => (
            <Pressable key={index} style={styles.swatchWrap} onPress={() => onSelect({ type: 'gradient', index })}>
              <LinearGradient colors={swatchColors} style={styles.swatch}>
                {selected?.type === 'gradient' && selected.index === index && (
                  <HugeiconsIcon icon={Tick02Icon} size={22} color="#ffffff" />
                )}
              </LinearGradient>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, styles.bubbleSectionLabel]}>Bubble style</Text>
        <View style={styles.bubbleRow}>
          {(Object.keys(bubbleStylePresets) as BubbleStyleKey[]).map((key) => {
            const preset = bubbleStylePresets[key];
            const active = bubbleStyle === key;
            return (
              <Pressable
                key={key}
                style={styles.bubbleOption}
                onPress={() => onSelectBubbleStyle(key)}
              >
                <View
                  style={[
                    styles.bubblePreviewWrap,
                    active && styles.bubblePreviewWrapActive,
                  ]}
                >
                  <View
                    style={[
                      styles.bubblePreviewBubble,
                      styles.bubblePreviewTheirs,
                      {
                        borderRadius: preset.radius,
                        borderBottomLeftRadius: preset.tailRadius,
                        paddingHorizontal: preset.paddingHorizontal * 0.6,
                        paddingVertical: preset.paddingVertical * 0.6,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.bubblePreviewBubble,
                      styles.bubblePreviewMine,
                      {
                        borderRadius: preset.radius,
                        borderBottomRightRadius: preset.tailRadius,
                        paddingHorizontal: preset.paddingHorizontal * 0.6,
                        paddingVertical: preset.paddingVertical * 0.6,
                        backgroundColor: colors.coral,
                      },
                    ]}
                  />
                  {active && (
                    <View style={styles.bubbleCheck}>
                      <HugeiconsIcon icon={Tick02Icon} size={12} color="#ffffff" />
                    </View>
                  )}
                </View>
                <Text style={styles.swatchLabel}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const SWATCH_SIZE = 56;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingHorizontal: space.xl,
      paddingTop: space.sm,
      paddingBottom: space.xxl + 4,
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
      marginBottom: space.md,
    },
    title: {
      ...typography.h2,
      color: colors.white,
    },
    subtitle: {
      marginTop: space.xxs,
      ...typography.footnote,
      color: colors.textMuted,
    },
    error: {
      marginTop: space.xs,
      ...typography.footnote,
      color: colors.errorText,
    },
    sectionLabel: {
      marginTop: space.lg,
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.textMuted,
    },
    bubbleSectionLabel: {
      marginBottom: space.xxs,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.sm + 2,
      marginTop: space.sm,
    },
    swatchWrap: {
      alignItems: 'center',
      gap: space.xxs + 2,
      width: SWATCH_SIZE,
    },
    swatch: {
      width: SWATCH_SIZE,
      height: SWATCH_SIZE,
      borderRadius: SWATCH_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    defaultSwatch: {
      backgroundColor: colors.inputBackground,
    },
    photoSwatch: {
      backgroundColor: colors.inputBackground,
    },
    photoPreview: {
      width: '100%',
      height: '100%',
    },
    photoEditBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.coral,
      borderWidth: 2,
      borderColor: colors.background,
    },
    swatchLabel: {
      ...typography.micro,
      fontFamily: 'Poppins_400Regular',
      color: colors.textMuted,
    },
    bubbleRow: {
      flexDirection: 'row',
      gap: space.lg,
      marginTop: space.sm,
    },
    bubbleOption: {
      alignItems: 'center',
      gap: space.xxs + 2,
    },
    bubblePreviewWrap: {
      width: 64,
      height: 48,
      borderRadius: radius.md,
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 6,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubblePreviewWrapActive: {
      borderColor: colors.coral,
    },
    bubblePreviewBubble: {
      minWidth: 28,
      height: 12,
    },
    bubblePreviewTheirs: {
      alignSelf: 'flex-start',
      backgroundColor: colors.buttonSecondary,
    },
    bubblePreviewMine: {
      alignSelf: 'flex-end',
    },
    bubbleCheck: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.coral,
      borderWidth: 2,
      borderColor: colors.background,
    },
  });
