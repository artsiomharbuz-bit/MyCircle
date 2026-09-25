import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { legalDocs, LegalDocKey } from '../legalText';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

// Full-screen reader for the Privacy Policy, Terms of Use or Community
// Guidelines.
export default function LegalDocModal({
  docKey,
  onClose,
}: {
  docKey: LegalDocKey | null;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const doc = docKey ? legalDocs[docKey] : null;

  return (
    <Modal visible={doc !== null} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{doc?.title}</Text>
          <Pressable style={styles.close} onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <HugeiconsIcon icon={Cancel01Icon} size={22} color={colors.white} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.updated}>Last updated {doc?.updated}</Text>
          {doc?.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.heading}>{section.heading}</Text>
              <Text style={styles.body}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: 40 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.xl,
      paddingBottom: space.md,
    },
    title: { ...typography.h1, color: colors.white, flex: 1 },
    close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: space.xl, paddingBottom: space.xxxl },
    updated: { ...typography.footnote, color: colors.textMuted, marginBottom: space.lg },
    section: { marginBottom: space.lg },
    heading: { ...typography.h3, color: colors.white, marginBottom: space.xxs },
    body: { ...typography.body, color: colors.textMuted, borderRadius: radius.xs },
  });
