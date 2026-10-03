import { memo, useEffect } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useReduceMotion } from '@/lib/a11y';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { palette } from '@/theme/tokens';

// The sweep trail is a conic gradient in the design:
//   conic-gradient(from 45deg, transparent 0deg 250deg, rgba(255,107,53,.6) 360deg)
// on a disc inset 18% inside the 100 × 100 grid. SVG has no conic gradient, so it is drawn
// as thin wedges whose opacity ramps from 0 (110° behind the arm) to .6 (at the arm).
const TRAIL_RADIUS = 32;
const TRAIL_START = 45 + 250; // degrees clockwise from 12 o'clock
const TRAIL_END = 45 + 360;
const WEDGE = 2.5;

function point(angle: number, r: number) {
  const a = (angle * Math.PI) / 180;
  return [50 + r * Math.sin(a), 50 - r * Math.cos(a)];
}

const wedges = (() => {
  const out: { d: string; opacity: number }[] = [];
  for (let a = TRAIL_START; a < TRAIL_END; a += WEDGE) {
    const [x1, y1] = point(a, TRAIL_RADIUS);
    // Overlap neighbours slightly so no hairline seams show between wedges.
    const [x2, y2] = point(Math.min(a + WEDGE + 0.6, TRAIL_END), TRAIL_RADIUS);
    const t = (a + WEDGE / 2 - TRAIL_START) / (TRAIL_END - TRAIL_START);
    out.push({
      d: `M50 50L${x1.toFixed(2)} ${y1.toFixed(2)}A${TRAIL_RADIUS} ${TRAIL_RADIUS} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z`,
      opacity: 0.6 * t,
    });
  }
  return out;
})();

const MarkSvg = memo(function MarkSvg({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {wedges.map((w, i) => (
        <Path key={i} d={w.d} fill={palette.ember} fillOpacity={w.opacity} />
      ))}
      <Circle cx={50} cy={50} r={33} fill="none" stroke={palette.ember} strokeWidth={7} />
      <Path d="M50 50 L72 28" stroke={palette.ember} strokeWidth={7} strokeLinecap="round" />
    </Svg>
  );
});

interface Props {
  size: number;
  /** Rotate the arm and trail clockwise, one turn per 2 s (stopped under Reduce Motion). */
  spinning?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The ThreatDoppler radar mark. Decorative, so hidden from VoiceOver. */
export function RadarMark({ size, spinning = false, style }: Props) {
  const reduceMotion = useReduceMotion();
  const turn = useAnimatedValue(0);

  useEffect(() => {
    if (!spinning || reduceMotion) {
      turn.stopAnimation();
      return;
    }
    turn.setValue(0);
    const loop = Animated.loop(
      Animated.timing(turn, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinning, reduceMotion, turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <MarkSvg size={size} />
      </Animated.View>
    </View>
  );
}

/** App-icon tile: flat #110E0D with the mark filling most of it. */
export function IconTile({ size, radius, mark = 0.8 }: { size: number; radius: number; mark?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.iconTileLine,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <RadarMark size={Math.round(size * mark)} />
    </View>
  );
}
