import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import LegalDocModal from './LegalDocModal';
import { LegalDocKey } from '../legalText';
import Text from './AppText';
import AnimatedPressable from './AnimatedPressable';
import { useAppTheme } from '../ThemeContext';
import { Colors, elevation, radius, space, typography } from '../theme';

// The "Heads up" card shown once whenever the Privacy Policy and/or Terms of
// Use change (see legal.ts).
export default function LegalUpdateModal({
  visible,
  privacy,
  terms,
  onAcknowledge,
}: {
  visible: boolean;
  privacy: boolean;
  terms: boolean;
  onAcknowledge: () => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors, scheme);
  const [doc, setDoc] = useState<LegalDocKey | null>(null);

  const what =
    privacy && terms
      ? 'Privacy Policy and Terms of Use'
      : privacy
        ? 'Privacy Policy'
        : 'Terms of Use';

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onAcknowledge}>
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Heads up</Text>
          <Text style={styles.title}>We updated our {what}</Text>
          <Text style={styles.message}>
            We made changes to our {what}. By continuing to use MyCircle you agree to the updated{' '}
            {privacy && terms ? 'documents' : 'document'}.
          </Text>
          <View style={styles.links}>
            {privacy && (
              <Text style={styles.link} onPress={() => setDoc('privacy')}>Read Privacy Policy</Text>
            )}
            {terms && (
              <Text style={styles.link} onPress={() => setDoc('terms')}>Read Terms of Use</Text>
            )}
          </View>
          <AnimatedPressable style={styles.button} onPress={onAcknowledge}>
            <Text style={styles.buttonText}>Got it</Text>
          </AnimatedPressable>
        </View>
      </View>
      <LegalDocModal docKey={doc} onClose={() => setDoc(null)} />
    </Modal>
  );
}

const createStyles = (colors: Colors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: space.xl,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    card: {
      width: '100%',
      maxWidth: 340,
      borderRadius: radius.sheet,
      padding: space.xl,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      ...(scheme === 'dark' ? elevation.high : null),
    },
    eyebrow: {
      ...typography.caption,
      fontFamily: 'Poppins_600SemiBold',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.coral,
      marginBottom: space.xs,
    },
    title: {
      ...typography.h2,
      color: colors.white,
    },
    message: {
      ...typography.callout,
      color: colors.textMuted,
      marginTop: space.sm,
    },
    links: { marginTop: space.md, gap: space.xs },
    link: { ...typography.calloutBold, color: colors.coral },
    button: {
      marginTop: space.xl,
      height: 46,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonBackground,
    },
    buttonText: {
      ...typography.bodyBold,
      color: colors.buttonText,
    },
  });
