import { ReactNode } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import useEntranceAnimation from '../useEntranceAnimation';

export default function FadeInView({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const entrance = useEntranceAnimation();
  return <Animated.View style={[style, entrance]}>{children}</Animated.View>;
}
