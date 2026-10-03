import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, useWindowDimensions } from 'react-native';

function useAccessibilityFlag(
  read: () => Promise<boolean>,
  event: 'reduceMotionChanged' | 'darkerSystemColorsChanged',
) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let mounted = true;
    read()
      .then((v) => mounted && setOn(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(event, (v: boolean) => setOn(v));
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [read, event]);
  return on;
}

/** Reduce Motion: swap movement for a 150 ms cross-fade and stop loops. */
export function useReduceMotion() {
  return useAccessibilityFlag(AccessibilityInfo.isReduceMotionEnabled, 'reduceMotionChanged');
}

const readIncreaseContrast = () =>
  Platform.OS === 'ios' ? AccessibilityInfo.isDarkerSystemColorsEnabled() : Promise.resolve(false);

/** iOS Increase Contrast. */
export function useIncreaseContrast() {
  return useAccessibilityFlag(readIncreaseContrast, 'darkerSystemColorsChanged');
}

/**
 * Text-size buckets. iOS font scale is ~1.0 at the default size, ~1.12 at xLarge and
 * ~1.65 at AX1 (the first accessibility size).
 */
export function useTextSize() {
  const { fontScale } = useWindowDimensions();
  return {
    fontScale,
    /** From xLarge upward every screen may scroll. */
    large: fontScale >= 1.1,
    /** AX1 and above: grids go to one column, tile rows to 2 × 2, tables drop secondary columns. */
    accessibility: fontScale >= 1.6,
  };
}
