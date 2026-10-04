import { useLayoutEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { T, type TProps } from './T';

/**
 * Text that cross-fades when its string changes (180 ms, the design's wording change). The layout
 * doesn't move: the new string takes its place at once and fades in while the old one fades out
 * on top of it. Already a fade, so it stays on under Reduce Motion. The first render doesn't animate.
 */
export function CrossFadeText({ children, ...props }: Omit<TProps, 'children'> & { children: string }) {
  // Remember the string being replaced (updating state during render, React's pattern for
  // reacting to a prop change), so both are on screen in the same commit.
  const [texts, setTexts] = useState<{ now: string; was: string | null }>({ now: children, was: null });
  if (texts.now !== children) setTexts({ now: children, was: texts.now });

  const progress = useAnimatedValue(1);
  const { now, was } = texts;
  // A layout effect, so the new string starts hidden on the first frame instead of flashing in.
  useLayoutEffect(() => {
    if (was === null) return;
    progress.setValue(0);
    const fade = Animated.timing(progress, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true });
    fade.start(({ finished }) => {
      if (finished) setTexts((t) => ({ ...t, was: null }));
    });
    return () => fade.stop();
  }, [now, was, progress]);

  return (
    <View>
      <Animated.View style={{ opacity: progress }}>
        <T {...props}>{now}</T>
      </Animated.View>
      {was !== null && (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', top: 0, left: 0, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}
        >
          <T {...props} numberOfLines={1}>
            {was}
          </T>
        </Animated.View>
      )}
    </View>
  );
}
