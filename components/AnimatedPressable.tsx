import { ReactNode, useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { motion } from '../theme';

export default function AnimatedPressable({
  style,
  children,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, 'children' | 'style'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      style={style}
      onPressIn={(e) => {
        Animated.spring(scale, {
          toValue: 0.92,
          useNativeDriver: true,
          ...motion.springSnappy,
        }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          ...motion.springSnappy,
        }).start();
        onPressOut?.(e);
      }}
      {...props}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}
