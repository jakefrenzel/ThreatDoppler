import { useState } from 'react';
import { Animated } from 'react-native';

/** A stable Animated.Value. React Native exports one too, but react-native-web does not. */
export function useAnimatedValue(initial: number) {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}
