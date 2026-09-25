import AppTextInput from './AppTextInput';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Text from './AppText';
import { useAuthedMutation as useMutation } from '../SessionContext';
import AnimatedPressable from './AnimatedPressable';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, textToolColors, typography } from '../theme';

export default function CreateCircleSheet({
  visible,
  userId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  userId: Id<'users'>;
  onClose: () => void;
  onCreated: (circleId: Id<'userCircles'>) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [name, setName] = useState('');
  const [color, setColor] = useState(textToolColors[4]);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const createCircle = useMutation(api.userCircles.createCircle);

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timeout);
  }, [visible]);

  const handleClose = () => {
    setName('');
    setColor(textToolColors[4]);
    onClose();
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const circleId = await createCircle({ ownerId: userId, name: trimmed, color });
      setName('');
      onCreated(circleId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalContent}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.heading}>New Circle</Text>

          <AppTextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Circle name"
            placeholderTextColor={colors.placeholder}
            value={name}
            onChangeText={setName}
            cursorColor={color}
            maxLength={30}
            returnKeyType="done"
          />

          <Text style={styles.subheading}>Color</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.swatchRow}
          >
            {textToolColors
              .filter((c) => c !== '#ffffff' && c !== '#000000')
              .map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
                />
              ))}
          </ScrollView>

          <AnimatedPressable
            style={[styles.createButton, !name.trim() && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={!name.trim() || submitting}
          >
            <Text style={styles.createButtonText}>{submitting ? 'Creating…' : 'Create Circle'}</Text>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    modalContent: {
      flex: 1,
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingHorizontal: space.xl,
      paddingTop: space.sm,
      paddingBottom: space.xxxl - 8,
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
    heading: {
      ...typography.h2,
      color: colors.white,
      marginBottom: space.md,
    },
    input: { fontFamily: 'Poppins_400Regular',
      height: 52,
      borderRadius: radius.input,
      paddingHorizontal: space.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.white,
      fontSize: 16,
    },
    subheading: {
      marginTop: space.lg,
      marginBottom: space.sm - 2,
      ...typography.footnote,
      fontFamily: 'Poppins_600SemiBold',
      color: colors.textMuted,
    },
    swatchRow: {
      gap: space.sm,
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
    createButton: {
      marginTop: space.xl,
      height: 52,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.coral,
    },
    createButtonDisabled: {
      opacity: 0.4,
    },
    createButtonText: {
      ...typography.h3,
      color: colors.accentText,
    },
  });
