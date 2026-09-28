import { useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuthedMutation as useMutation } from '../SessionContext';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import BackButton from '../components/BackButton';
import PrimaryButton from '../components/PrimaryButton';
import useEntranceAnimation from '../useEntranceAnimation';
import { useAppTheme } from '../ThemeContext';
import { Colors, randomGradient, space } from '../theme';
import { compressPhoto } from '../compressMedia';
import { getDeviceLanguage } from '../deviceInfo';
import { readableError } from '../errorMessage';
import { uploadFileToConvex } from '../uploadMedia';

export default function OnboardingAvatarScreen({
  userId,
  name,
  username,
  dateOfBirth,
  onBack,
  onDone,
}: {
  userId: Id<'users'>;
  name: string;
  username: string;
  dateOfBirth: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const entrance = useEntranceAnimation();
  const { t } = useTranslation(['onboardingAvatar', 'common']);
  const [gradient, setGradient] = useState(randomGradient);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const completeOnboarding = useMutation(api.users.completeOnboarding);

  const letter = username.charAt(0).toUpperCase();

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('photoAccessDeniedError'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const finish = async () => {
    setError(null);
    setFinishing(true);
    try {
      let avatarStorageId: Id<'_storage'> | undefined;

      if (photoUri) {
        setUploading(true);
        const compressedUri = await compressPhoto(photoUri);
        const uploadUrl = await generateUploadUrl({ userId });
        avatarStorageId = (await uploadFileToConvex(
          compressedUri,
          uploadUrl,
          'image/jpeg'
        )) as Id<'_storage'>;
        setUploading(false);
      }

      await completeOnboarding({
        userId,
        name,
        username,
        dateOfBirth,
        avatarGradient: gradient,
        avatarStorageId,
        deviceLanguage: getDeviceLanguage(),
      });

      onDone();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setUploading(false);
      setFinishing(false);
    }
  };

  return (
    <View style={styles.container}>
      <BackButton onPress={onBack} />

      <Animated.View style={[styles.titleWrap, entrance]}>
        <Text variant="display" style={styles.title}>
          {t('title')}
        </Text>
        <Text variant="body" style={styles.subtitle}>
          {t('subtitle')}
        </Text>

        <Pressable
          style={styles.avatar}
          onPress={() => !photoUri && setGradient(randomGradient())}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatarImage} />
          ) : (
            <LinearGradient colors={gradient} style={styles.avatarGradient}>
              <Text style={styles.avatarLetter}>{letter}</Text>
            </LinearGradient>
          )}
        </Pressable>

        {!photoUri && (
          <Text variant="footnote" style={styles.hint}>
            {t('hint')}
          </Text>
        )}

        {!!error && (
          <Text variant="footnote" style={styles.error}>
            {error}
          </Text>
        )}
      </Animated.View>

      <Animated.View style={[styles.actions, entrance]}>
        <PrimaryButton
          label={photoUri ? t('choosePhotoButton') : t('uploadPhotoButton')}
          tone="ghost"
          disabled={finishing}
          onPress={pickPhoto}
        />

        <PrimaryButton
          label={photoUri ? t('continueButton') : t('skipButton')}
          tone="primary"
          loading={finishing}
          disabled={finishing}
          onPress={finish}
        />
      </Animated.View>

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const AVATAR_SIZE = 160;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: space.xl,
      paddingTop: space.xl,
      paddingBottom: space.xl,
    },
    titleWrap: {
      marginTop: space.xxl,
      alignItems: 'center',
    },
    title: {
      color: colors.white,
    },
    subtitle: {
      marginTop: space.xs,
      color: colors.textMuted,
      textAlign: 'center',
    },
    avatar: {
      marginTop: space.xxl,
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
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 64,
      color: '#ffffff',
    },
    hint: {
      marginTop: space.sm,
      color: colors.textMuted,
    },
    error: {
      marginTop: space.sm,
      color: colors.red,
      textAlign: 'center',
    },
    actions: {
      marginTop: space.xxl,
      gap: space.sm,
    },
  });
