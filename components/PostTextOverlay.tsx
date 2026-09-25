import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import Text from './AppText';

export type PostTextOverlayData = {
  text: string;
  color: string;
  fontFamily?: string;
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
};

// Renders a video post's text overlay at playback — the same placement that
// was set while editing, reproduced here (rather than baked into the video's
// pixels, which would need real video re-encoding). translateX/Y on the data
// are normalized fractions of the edit canvas's size, so they're re-scaled to
// this container's own measured size to land in the same relative spot no
// matter how big the video renders here (feed card vs full-screen clip).
export default function PostTextOverlay({
  overlay,
  ready = true,
}: {
  overlay: PostTextOverlayData;
  // Video callers pass false until the first frame is on screen, so the text
  // never shows over a blank player.
  ready?: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  };

  // Until the container has been measured the offsets below are all 0 — the
  // text would flash dead-center for a frame and then jump to its real spot.
  // Staying invisible until then means it only ever appears where it belongs,
  // as if it were part of the video itself.
  const measured = ready && size.width > 0 && size.height > 0;

  return (
    <View pointerEvents="none" style={styles.container} onLayout={onLayout}>
      <Text
        style={[
          styles.text,
          { opacity: measured ? 1 : 0 },
          !overlay.fontFamily && styles.textDefaultWeight,
          {
            color: overlay.color,
            fontFamily: overlay.fontFamily,
            transform: [
              { translateX: overlay.translateX * size.width },
              { translateY: overlay.translateY * size.height },
              { rotateZ: `${overlay.rotation}rad` },
              { scale: overlay.scale },
            ],
          },
        ]}
      >
        {overlay.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 32,
    textAlign: 'center',
  },
  textDefaultWeight: {
    fontWeight: '700',
  },
});
