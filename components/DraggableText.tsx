import { StyleSheet } from 'react-native';
import Text from './AppText';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

const MIN_SCALE = 0.4;
const MAX_SCALE = 6;

export type TextTransform = {
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
};

export default function DraggableText({
  text,
  color,
  fontFamily,
  initialTransform,
  onTransformChange,
}: {
  text: string;
  color: string;
  fontFamily?: string;
  // Starting position/scale/rotation (e.g. when re-opening the text tool on
  // an overlay that was already placed) — defaults to centered/1x/0deg.
  initialTransform?: TextTransform;
  // Fired (via runOnJS, off the UI thread) whenever a gesture ends, so the
  // parent always has the latest placement without re-rendering mid-drag.
  onTransformChange?: (transform: TextTransform) => void;
}) {
  const translateX = useSharedValue(initialTransform?.translateX ?? 0);
  const translateY = useSharedValue(initialTransform?.translateY ?? 0);
  const scale = useSharedValue(initialTransform?.scale ?? 1);
  const rotation = useSharedValue(initialTransform?.rotation ?? 0);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);

  const reportTransform = () => {
    'worklet';
    if (!onTransformChange) return;
    runOnJS(onTransformChange)({
      translateX: translateX.value,
      translateY: translateY.value,
      scale: scale.value,
      rotation: rotation.value,
    });
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
    })
    .onEnd(reportTransform);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = startScale.value * e.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    })
    .onEnd(reportTransform);

  const rotationGesture = Gesture.Rotation()
    .onStart(() => {
      startRotation.value = rotation.value;
    })
    .onUpdate((e) => {
      rotation.value = startRotation.value + e.rotation;
    })
    .onEnd(reportTransform);

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotateZ: `${rotation.value}rad` },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={animatedStyle}>
        <Text
          style={[styles.text, !fontFamily && styles.textDefaultWeight, { color, fontFamily }]}
        >
          {text}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 32,
    textAlign: 'center',
  },
  // Custom display fonts (Oswald/Fredoka/Caveat, etc.) ship as a single
  // pre-weighted file — setting fontWeight alongside fontFamily makes
  // Android try to resolve a "family + weight" variant that doesn't exist
  // and silently falls back to the system font. Only the default/"Classic"
  // option (no custom fontFamily) needs the weight forced here.
  textDefaultWeight: {
    fontWeight: '700',
  },
});
