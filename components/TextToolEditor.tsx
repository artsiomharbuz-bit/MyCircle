import AppTextInput from './AppTextInput';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from './AppText';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, Tick04Icon } from '@hugeicons/core-free-icons';
// Deliberately not theme-reactive: this overlay sits on top of the photo/video
// being edited, so — like a camera app — it always stays dark regardless of
// the app's own light/dark setting.
import { mediaColors as colors, radius, space, typography, textToolColors, textToolFonts, TextToolFont } from '../theme';

export default function TextToolEditor({
  initialText,
  initialColor,
  initialFont,
  onCancel,
  onConfirm,
}: {
  initialText: string;
  initialColor: string;
  initialFont: TextToolFont;
  onCancel: () => void;
  onConfirm: (text: string, color: string, font: TextToolFont) => void;
}) {
  const [text, setText] = useState(initialText);
  const [color, setColor] = useState(initialColor);
  const [font, setFont] = useState(initialFont);

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.cancelButton} onPress={onCancel}>
        <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.white} />
      </Pressable>

      <View style={styles.center}>
        <AppTextInput
          style={[
            styles.input,
            !font.fontFamily && styles.inputDefaultWeight,
            { color, fontFamily: font.fontFamily },
          ]}
          placeholder="Type something"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          cursorColor={color}
        />
      </View>

      <View style={styles.bottomControls}>
        <View style={styles.fontRow}>
          {textToolFonts.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFont(f)}
              style={[styles.fontChip, font.key === f.key && styles.fontChipActive]}
            >
              <Text
                style={[
                  styles.fontChipText,
                  font.key === f.key && styles.fontChipTextActive,
                  { fontFamily: f.fontFamily },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.colorRow}
        >
          {textToolColors.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
            />
          ))}
        </ScrollView>

        <Pressable
          style={[styles.doneButton, !text.trim() && styles.doneButtonDisabled]}
          onPress={() => text.trim() && onConfirm(text.trim(), color, font)}
          disabled={!text.trim()}
        >
          <HugeiconsIcon icon={Tick04Icon} size={24} color={colors.black} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 20,
  },
  cancelButton: {
    position: 'absolute',
    top: 40,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.buttonBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
  },
  input: { fontFamily: 'Poppins_400Regular',
    fontSize: 32,
    textAlign: 'center',
  },
  // See DraggableText.tsx's textDefaultWeight for why this only applies
  // when no custom fontFamily is selected.
  inputDefaultWeight: {
    fontWeight: '700',
  },
  bottomControls: {
    paddingHorizontal: space.xl,
    paddingBottom: 40,
    gap: space.md,
  },
  fontRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  fontChip: {
    paddingHorizontal: 14,
    paddingVertical: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.buttonBackground,
  },
  fontChipActive: {
    backgroundColor: colors.white,
  },
  fontChipText: {
    ...typography.callout,
    color: colors.white,
  },
  fontChipTextActive: {
    color: colors.black,
  },
  colorRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: colors.white,
  },
  doneButton: {
    alignSelf: 'flex-end',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonDisabled: {
    opacity: 0.4,
  },
});
