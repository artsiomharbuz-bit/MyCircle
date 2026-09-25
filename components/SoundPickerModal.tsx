import AppTextInput from './AppTextInput';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from './AppText';
import { StatusBar } from 'expo-status-bar';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  MusicNote02Icon,
  PauseIcon,
  PlayIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons';
import SoundAudioLayer from './SoundAudioLayer';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export type PickedSound = {
  _id: Id<'sounds'>;
  name: string;
  pictureUrl: string | null;
  audioUrl: string | null;
  isDeleted: boolean;
};

type Tab = 'trending' | 'saved';

// "Add sound": search, or browse Trending (most-used global sounds) and
// Saved (this person's saved list). Tapping a row previews it in place;
// tapping "Use this sound" attaches it and closes.
export default function SoundPickerModal({
  visible,
  userId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  userId: Id<'users'>;
  onClose: () => void;
  onSelect: (sound: PickedSound) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const [tab, setTab] = useState<Tab>('trending');
  const [search, setSearch] = useState('');
  const [previewingId, setPreviewingId] = useState<Id<'sounds'> | null>(null);

  const sounds = useQuery(
    api.sounds.browseSounds,
    visible ? { viewerId: userId, tab, search } : 'skip'
  );

  const close = () => {
    setPreviewingId(null);
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={close} accessibilityLabel="Go back">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
          </Pressable>
          <Text style={styles.title}>Add sound</Text>
        </View>

        <View style={styles.searchWrap}>
          <HugeiconsIcon icon={Search01Icon} size={18} color={colors.textMuted} />
          <AppTextInput
            style={styles.searchInput}
            placeholder="Search sounds"
            placeholderTextColor={colors.placeholder}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.tabs}>
          {(['trending', 'saved'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'trending' ? 'Trending' : 'Saved'}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {sounds === undefined && <Text style={styles.empty}>Loading sounds…</Text>}

          {sounds && sounds.length === 0 && (
            <Text style={styles.empty}>
              {tab === 'saved'
                ? "You haven't saved any sounds yet."
                : search
                  ? 'No sounds match your search.'
                  : 'No trending sounds yet — be the first to post one.'}
            </Text>
          )}

          {sounds?.map((sound) => {
            const isPreviewing = previewingId === sound._id;
            const disabled = sound.isDeleted || !sound.audioUrl;

            return (
              <View key={sound._id} style={[styles.row, disabled && styles.rowDisabled]}>
                <Pressable
                  style={styles.playButton}
                  disabled={disabled}
                  onPress={() => setPreviewingId(isPreviewing ? null : sound._id)}
                >
                  {sound.pictureUrl ? (
                    <Image source={{ uri: sound.pictureUrl }} style={styles.picture} />
                  ) : (
                    <View style={styles.pictureFallback}>
                      <HugeiconsIcon icon={MusicNote02Icon} size={18} color={colors.white} />
                    </View>
                  )}
                  <View style={styles.playOverlay}>
                    <HugeiconsIcon
                      icon={isPreviewing ? PauseIcon : PlayIcon}
                      size={14}
                      color="#ffffff"
                    />
                  </View>
                  {isPreviewing && (
                    <SoundAudioLayer audioUrl={sound.audioUrl} volume={1} isActive />
                  )}
                </Pressable>

                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {sound.name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {sound.owner?.username ? `@${sound.owner.username}` : 'Unknown'} ·{' '}
                    {sound.useCount} {sound.useCount === 1 ? 'use' : 'uses'}
                  </Text>
                </View>

                <Pressable
                  style={[styles.useButton, disabled && styles.useButtonDisabled]}
                  disabled={disabled}
                  onPress={() => {
                    setPreviewingId(null);
                    onSelect(sound);
                  }}
                >
                  <Text style={styles.useButtonText}>Use</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>

        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      </View>
    </Modal>
  );
}

const PICTURE_SIZE = 46;

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
      paddingBottom: 14,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...typography.h2,
      color: colors.white,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      marginHorizontal: space.lg,
      paddingHorizontal: 18,
      height: 48,
      borderRadius: radius.input,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.white,
    },
    tabs: {
      flexDirection: 'row',
      gap: space.xs,
      marginHorizontal: space.lg,
      marginTop: space.md,
    },
    tab: {
      paddingHorizontal: 18,
      height: 36,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabActive: {
      backgroundColor: colors.white,
      borderColor: colors.white,
    },
    tabLabel: {
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      color: colors.white,
    },
    tabLabelActive: {
      color: colors.black,
    },
    scroll: {
      flex: 1,
    },
    list: {
      paddingHorizontal: space.lg,
      paddingTop: 18,
      paddingBottom: 30,
      gap: space.xxs,
    },
    empty: {
      marginTop: 40,
      textAlign: 'center',
      ...typography.callout,
      color: colors.textMuted,
      paddingHorizontal: space.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 9,
    },
    rowDisabled: {
      opacity: 0.45,
    },
    playButton: {
      width: PICTURE_SIZE,
      height: PICTURE_SIZE,
    },
    picture: {
      width: PICTURE_SIZE,
      height: PICTURE_SIZE,
      borderRadius: 14,
      backgroundColor: colors.buttonSecondary,
    },
    pictureFallback: {
      width: PICTURE_SIZE,
      height: PICTURE_SIZE,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonSecondary,
    },
    playOverlay: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderWidth: 2,
      borderColor: colors.background,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowName: {
      ...typography.bodyBold,
      color: colors.white,
    },
    rowMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    useButton: {
      paddingHorizontal: space.md,
      height: 34,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white,
    },
    useButtonDisabled: {
      backgroundColor: colors.buttonSecondary,
    },
    useButtonText: {
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      fontWeight: '700',
      color: colors.black,
    },
  });
