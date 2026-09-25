import AppTextInput from './AppTextInput';
import { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import Text from './AppText';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Cancel01Icon,
  PlusSignIcon,
  Search01Icon,
  StarIcon,
  StickerIcon,
} from '@hugeicons/core-free-icons';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { uploadFileToConvex } from '../uploadMedia';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

type Sticker = { _id: Id<'stickers'>; name: string; imageUrl: string | null; isSaved: boolean };

export default function StickerSheet({
  visible,
  userId,
  onClose,
  onSelect,
  manageOnly = false,
  fullScreen = false,
}: {
  visible: boolean;
  userId: Id<'users'>;
  onClose: () => void;
  onSelect?: (sticker: Sticker) => void;
  manageOnly?: boolean;
  fullScreen?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [search, setSearch] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [name, setName] = useState('');
  const [uri, setUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const stickers = useQuery(api.stickers.list, visible ? { userId, search, savedOnly } : 'skip');
  const uploadUrl = useMutation(api.stickers.generateUploadUrl);
  const create = useMutation(api.stickers.create);
  const toggleSaved = useMutation(api.stickers.toggleSaved);

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert('Photo access required', 'Allow photo access to create a sticker.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setUri(result.assets[0].uri);
  };

  const make = async () => {
    if (!uri || !name.trim()) return;
    setCreating(true);
    try {
      const id = await uploadFileToConvex(uri, await uploadUrl({ userId }), 'image/jpeg');
      await create({ ownerId: userId, name, imageStorageId: id as Id<'_storage'> });
      setName('');
      setUri(null);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal transparent={!fullScreen} visible={visible} animationType="slide" onRequestClose={onClose}>
      {!fullScreen && <Pressable style={styles.backdrop} onPress={onClose} />}

      <View style={[styles.sheet, fullScreen && styles.fullScreen]}>
        {!fullScreen && <View style={styles.handle} />}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{manageOnly ? 'Your sticker studio' : 'Stickers'}</Text>
            <Text style={styles.subtitle}>
              {manageOnly ? 'Make your photos shareable.' : 'Tap to send · hold to save'}
            </Text>
          </View>
          <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
            <HugeiconsIcon icon={Cancel01Icon} size={16} color={colors.white} />
          </Pressable>
        </View>

        {manageOnly && (
          <View style={styles.creator}>
            <Pressable onPress={pick} style={styles.preview}>
              {uri ? (
                <Image source={{ uri }} style={styles.previewImage} />
              ) : (
                <>
                  <View style={styles.plusCircle}>
                    <HugeiconsIcon icon={PlusSignIcon} size={20} color={colors.white} />
                  </View>
                  <Text style={styles.choose}>Choose a photo</Text>
                </>
              )}
            </Pressable>

            <Text style={styles.eyebrow}>NEW STICKER</Text>
            <Text style={styles.creatorTitle}>
              {uri ? 'Name your new sticker' : 'Start with a photo'}
            </Text>
            <Text style={styles.hint}>
              {uri
                ? 'It will be ready to use in chats and comments.'
                : 'Use a square crop for the cleanest look.'}
            </Text>

            <AppTextInput
              value={name}
              onChangeText={setName}
              placeholder="Sticker name"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              cursorColor={colors.coral}
            />

            <Pressable
              style={[styles.createButton, (!uri || !name.trim() || creating) && styles.disabled]}
              onPress={make}
              disabled={!uri || !name.trim() || creating}
            >
              <Text style={styles.createText}>{creating ? 'Creating…' : 'Create sticker'}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tabButton, !savedOnly && styles.tabSelected]}
            onPress={() => setSavedOnly(false)}
          >
            <Text style={[styles.tab, !savedOnly && styles.tabActive]}>All stickers</Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, savedOnly && styles.tabSelected]}
            onPress={() => setSavedOnly(true)}
          >
            <Text style={[styles.tab, savedOnly && styles.tabActive]}>Saved</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <HugeiconsIcon icon={Search01Icon} size={16} color={colors.placeholder} />
          <AppTextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search stickers"
            placeholderTextColor={colors.placeholder}
            style={styles.search}
            cursorColor={colors.coral}
          />
        </View>

        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {stickers?.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <HugeiconsIcon icon={StickerIcon} size={22} color={colors.textMuted} />
              </View>
              <Text style={styles.empty}>
                {savedOnly ? 'Long-press a sticker to save it here.' : 'No stickers found.'}
              </Text>
            </View>
          )}

          {stickers?.map((sticker) => (
            <Pressable
              key={sticker._id}
              style={styles.tile}
              onPress={() => {
                onSelect?.(sticker);
                if (!manageOnly) onClose();
              }}
              onLongPress={() => toggleSaved({ userId, stickerId: sticker._id })}
            >
              <View style={styles.imageWrap}>
                {sticker.imageUrl && <Image source={{ uri: sticker.imageUrl }} style={styles.image} />}
                {sticker.isSaved && (
                  <View style={styles.saved}>
                    <HugeiconsIcon icon={StarIcon} size={9} color={colors.accentText} fill={colors.accentText} />
                  </View>
                )}
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {sticker.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    sheet: {
      minHeight: '62%',
      maxHeight: '91%',
      backgroundColor: c.background,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      borderWidth: 1,
      borderColor: c.border,
      borderBottomWidth: 0,
      paddingHorizontal: space.lg,
      paddingBottom: 28,
    },
    fullScreen: {
      flex: 1,
      maxHeight: undefined,
      minHeight: undefined,
      borderWidth: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      paddingTop: 38,
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.buttonSecondary,
      marginVertical: 12,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerText: {
      flex: 1,
    },
    title: {
      ...typography.h2,
      color: c.white,
    },
    subtitle: {
      ...typography.footnote,
      color: c.textMuted,
      marginTop: 3,
    },
    close: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    creator: {
      marginTop: 18,
      padding: space.md,
      borderRadius: radius.xl,
      backgroundColor: c.inputBackground,
      borderWidth: 1,
      borderColor: c.border,
    },
    preview: {
      width: '100%',
      aspectRatio: 2.25,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: c.buttonSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    plusCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },
    choose: {
      color: c.white,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
    },
    eyebrow: {
      color: c.coral,
      fontSize: 10,
      letterSpacing: 1,
      fontFamily: 'Poppins_600SemiBold',
      marginTop: 13,
    },
    creatorTitle: {
      ...typography.h3,
      color: c.white,
      marginTop: 3,
    },
    hint: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 3,
    },
    input: {
      fontFamily: 'Poppins_400Regular',
      height: 46,
      borderRadius: 14,
      paddingHorizontal: space.sm,
      backgroundColor: c.background,
      color: c.white,
      marginTop: space.sm,
    },
    createButton: {
      marginTop: space.sm,
      height: 46,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.buttonBackground,
    },
    disabled: {
      opacity: 0.4,
    },
    createText: {
      color: c.buttonText,
      fontFamily: 'Poppins_600SemiBold',
    },
    tabs: {
      flexDirection: 'row',
      gap: space.xs,
      marginTop: 18,
      backgroundColor: c.inputBackground,
      borderRadius: radius.md,
      padding: space.xxs,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: radius.sm,
    },
    tabSelected: {
      backgroundColor: c.buttonSecondary,
    },
    tab: {
      color: c.textMuted,
      fontSize: 13,
      fontFamily: 'Poppins_600SemiBold',
    },
    tabActive: {
      color: c.white,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      height: 42,
      borderRadius: radius.input,
      paddingHorizontal: 14,
      backgroundColor: c.inputBackground,
      borderWidth: 1,
      borderColor: c.border,
      marginTop: space.sm,
    },
    search: {
      flex: 1,
      ...typography.callout,
      color: c.white,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.md,
      paddingTop: 18,
      paddingBottom: space.xs,
    },
    tile: {
      width: 76,
      alignItems: 'center',
    },
    imageWrap: {
      width: 76,
      height: 76,
      borderRadius: 20,
      overflow: 'visible',
    },
    image: {
      width: '100%',
      height: '100%',
      borderRadius: 20,
      backgroundColor: c.inputBackground,
      borderWidth: 1,
      borderColor: c.border,
    },
    name: {
      color: c.textMuted,
      ...typography.caption,
      marginTop: 6,
      maxWidth: 76,
    },
    saved: {
      position: 'absolute',
      top: -5,
      right: -5,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.coral,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.background,
    },
    emptyState: {
      width: '100%',
      alignItems: 'center',
      gap: 10,
      paddingVertical: space.xxl,
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    empty: {
      textAlign: 'center',
      color: c.textMuted,
      ...typography.footnote,
    },
  });
