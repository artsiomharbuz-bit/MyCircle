import { ReactNode } from 'react';
import { Platform, StatusBar as NativeStatusBar, StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../ThemeContext';

export default function StatusBarBackdrop({ children }: { children: ReactNode }) {
  const blurTarget = useRef<View>(null);
  const { scheme, colors } = useAppTheme();
  const android = Platform.OS === 'android';
  const height = android ? (NativeStatusBar.currentHeight ?? 24) : 126;
  const layers = scheme === 'dark'
    ? ['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.03)', 'rgba(0,0,0,0)']
    : ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)'];

  return (
    <View style={styles.root}>
      {android ? children : (
        <BlurTargetView ref={blurTarget} style={styles.target}>
          {children}
        </BlurTargetView>
      )}
      {android ? (
        <View pointerEvents="none" style={[styles.backdrop, { height, backgroundColor: colors.background }]} />
      ) : (
        <>
          <BlurView pointerEvents="none" blurMethod="dimezisBlurView" intensity={64} tint={scheme} style={[styles.backdrop, { height }]} />
          <View pointerEvents="none" style={[styles.backdrop, { height }]}>
            <LinearGradient colors={layers} locations={[0, 0.38, 0.72, 1]} style={StyleSheet.absoluteFill} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  target: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
});
