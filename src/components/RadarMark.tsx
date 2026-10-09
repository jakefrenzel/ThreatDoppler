import { memo, useEffect } from 'react';
import { Animated, Easing, Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useReduceMotion } from '@/lib/a11y';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { palette } from '@/theme/tokens';

// The sweep trail is a conic gradient in the design:
//   conic-gradient(from 45deg, transparent 0deg 250deg, rgba(255,107,53,.6) 360deg)
// on a disc inset 18% inside the 100 × 100 grid. SVG has no conic gradient, so it is an image
// (scripts/radar-trail renders it) under the ring and arm, rotating with them.
const trail = require('../../assets/radar-trail.png');
const TRAIL_INSET = 0.18;

const MarkSvg = memo(function MarkSvg({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
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
    if (reduceMotion) {
      turn.stopAnimation();
      turn.setValue(0);
      return;
    }
    if (!spinning) {
      // Finish the current turn and come to rest at the starting angle, so the next spin
      // doesn't begin from wherever this one stopped.
      turn.stopAnimation((v) => {
        if (v === 0) return;
        Animated.timing(turn, {
          toValue: 1,
          duration: Math.max(1 - v, 0) * 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished }) => finished && turn.setValue(0));
      });
      return;
    }
    turn.stopAnimation();
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
      <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
        <Image
          source={trail}
          style={{
            position: 'absolute',
            left: size * TRAIL_INSET,
            top: size * TRAIL_INSET,
            width: size * (1 - 2 * TRAIL_INSET),
            height: size * (1 - 2 * TRAIL_INSET),
          }}
        />
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
