import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAppTheme } from '../ThemeContext';
import { Colors, elevation, radius, space, typography } from '../theme';

export default function NativePopup({ visible, title, message, confirmLabel = 'Save', showCancel = true, onClose, onConfirm }: { visible: boolean; title: string; message: string; confirmLabel?: string; showCancel?: boolean; onClose: () => void; onConfirm: () => void | Promise<void> }) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors, scheme);
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose} />
    <View style={styles.center} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.spark}><Text style={styles.sparkText}>★</Text></View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.actions}>
          {showCancel && <Pressable style={styles.cancel} onPress={onClose}><Text style={styles.cancelText}>Not now</Text></Pressable>}
          <Pressable style={[styles.confirm, !showCancel && styles.confirmOnly]} onPress={async () => { await onConfirm(); onClose(); }}><Text style={styles.confirmText}>{confirmLabel}</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}
const createStyles = (c: Colors, scheme: 'light' | 'dark') => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderRadius: radius.sheet,
    padding: space.xl,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
    // A dark drop shadow reads as a lift on dark mode but as a smudge on
    // light mode, so light mode skips it entirely.
    ...(scheme === 'dark' ? elevation.high : null),
  },
  spark: { width: 54, height: 54, borderRadius: 27, backgroundColor: c.coral, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  sparkText: { color: c.accentText, fontSize: 24 }, title: { color: c.white, ...typography.h2 },
  message: { color: c.textMuted, ...typography.callout, textAlign: 'center', marginTop: space.xs, paddingHorizontal: 6 },
  actions: { flexDirection: 'row', gap: space.sm, width: '100%', marginTop: space.xl },
  cancel: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.button, backgroundColor: c.buttonSecondary },
  cancelText: { color: c.white, fontFamily: 'Poppins_600SemiBold' },
  confirm: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.button, backgroundColor: c.buttonBackground },
  confirmOnly: { flex: undefined, width: '100%' },
  confirmText: { color: c.buttonText, fontFamily: 'Poppins_600SemiBold' },
});
