import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { palette } from '@/theme/tokens';

export interface GlowSpec {
  /** Ellipse radii as fractions of the box (CSS "130% 50%"). */
  rx: number;
  ry: number;
  /** Centre as fractions of the box (CSS "at 50% -8%"). */
  cx: number;
  cy: number;
  opacity: number;
  /** Where the colour reaches transparent (CSS "transparent 62%"). */
  fade: number;
}

// Backgrounds from the design.
export const glows = {
  sky: { rx: 1.3, ry: 0.5, cx: 0.5, cy: -0.08, opacity: 0.26, fade: 0.62 },
  onboarding: { rx: 0.9, ry: 0.4, cx: 0.85, cy: 0.08, opacity: 0.32, fade: 0.7 },
  sheet: { rx: 1.1, ry: 0.4, cx: 0.5, cy: 0, opacity: 0.22, fade: 0.7 },
  sheetTight: { rx: 1.1, ry: 0.4, cx: 0.5, cy: 0, opacity: 0.22, fade: 0.6 },
} satisfies Record<string, GlowSpec>;

let gid = 0;

/** An elliptical ember radial gradient that fills its parent. */
export function Glow({ spec }: { spec: GlowSpec }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [id] = useState(() => `glow${gid++}`);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.w !== width || size.h !== height) setSize({ w: width, h: height });
  };

  let content = null;
  if (size && size.w > 0 && size.h > 0) {
    const cx = spec.cx * size.w;
    const cy = spec.cy * size.h;
    const rx = spec.rx * size.w;
    const ry = spec.ry * size.h;
    content = (
      <Svg width={size.w} height={size.h}>
        <Defs>
          <RadialGradient
            id={id}
            cx={cx}
            cy={cy}
            r={rx}
            fx={cx}
            fy={cy}
            gradientUnits="userSpaceOnUse"
            gradientTransform={`translate(${cx} ${cy}) scale(1 ${ry / rx}) translate(${-cx} ${-cy})`}
          >
            <Stop offset={0} stopColor={palette.ember} stopOpacity={spec.opacity} />
            <Stop offset={spec.fade} stopColor={palette.ember} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${id})`} />
      </Svg>
    );
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {content}
    </View>
  );
}
