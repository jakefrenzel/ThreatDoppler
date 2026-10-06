import { isValidElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useReduceMotion } from '@/lib/a11y';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { useColors } from '@/theme/ColorsProvider';
import { palette, type BandKey, bands } from '@/theme/tokens';
import { Mono, T } from './T';

const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);

/** Metric tile: mono label over a value. Highlighted tiles are ember-soft with an ember label. */
export function Tile({
  label,
  value,
  highlight,
  valueSize = 16,
  valueMono,
  valueColor,
  sub,
  labelSize = 9,
  pad = [8, 10],
  radius = 16,
  valueGap = 0,
  style,
  accessibilityLabel,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
  valueSize?: number;
  valueMono?: boolean;
  valueColor?: string;
  sub?: string;
  labelSize?: number;
  pad?: [number, number];
  radius?: number;
  valueGap?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  return (
    <View
      accessible={!!accessibilityLabel || undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flex: 1,
          paddingVertical: pad[0],
          paddingHorizontal: pad[1],
          borderRadius: radius,
          backgroundColor: highlight ? c.emberSoft : c.card,
          borderWidth: 1,
          borderColor: highlight ? palette.emberLine : c.line,
        },
        style,
      ]}
    >
      <Mono size={labelSize} color={highlight ? c.ember : c.mute} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {label}
      </Mono>
      {typeof value === 'string' || typeof value === 'number' || (isValidElement(value) && value.type === CountUp) ? (
        <T mono={valueMono} size={valueSize} weight={600} color={valueColor} style={{ marginTop: valueGap }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {value}
        </T>
      ) : (
        value
      )}
      {sub ? (
        <T size={11} color={c.mute} numberOfLines={1}>
          {sub}
        </T>
      ) : null}
    </View>
  );
}

/** A row of tiles with a 6 pt gap; wraps to 2 × 2 when `wrap` is set (AX sizes). */
export function TileRow({ children, wrap, style }: { children: ReactNode; wrap?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: 6, marginHorizontal: 14 }, style]}>
      {children}
    </View>
  );
}

export function BandDot({ color, size = 6 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** 4 pt score bar that grows to the value on first appear (400 ms, 30 ms stagger per row). */
export function ScoreBar({ score, color, index = 0 }: { score: number; color: string; index?: number }) {
  const c = useColors();
  const reduceMotion = useReduceMotion();
  const grow = useAnimatedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      grow.setValue(1);
      return;
    }
    Animated.timing(grow, { toValue: 1, duration: 400, delay: index * 30, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [grow, index, reduceMotion]);
  return (
    <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: c.track, overflow: 'hidden' }}>
      <Animated.View
        style={{
          width: `${Math.max(0, Math.min(100, score))}%`,
          height: '100%',
          borderRadius: 2,
          backgroundColor: color,
          transformOrigin: 'left',
          transform: [{ scaleX: grow }],
        }}
      />
    </View>
  );
}

/** Horizontal 10 pt stacked bar with a dot legend underneath. */
export function StackedBar({ items }: { items: { key: string; label: string; value: number; color: string }[] }) {
  const c = useColors();
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 2, height: 10, borderRadius: 5, overflow: 'hidden' }}>
        {items.map((i) => (
          <View key={i.key} style={{ flex: i.value / total, backgroundColor: i.color }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 4 }}>
        {items.map((i) => (
          <View key={i.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <BandDot color={i.color} />
            <Mono size={9} tracking={0} color={c.mute}>
              {i.label}
            </Mono>
          </View>
        ))}
      </View>
    </View>
  );
}

let gradId = 0;

/** Horizontal SVG gradient filling its parent (rounded). */
export function GradientFill({ stops, radius = 0 }: { stops: [number, string][]; radius?: number }) {
  const [id] = useState(() => `hg${gradId++}`);
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute' }} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          {stops.map(([o, color]) => (
            <Stop key={o} offset={o} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Animated number (700 ms ease-out). Counts up from 0 when it first appears, then tweens from
 * the number on screen to the new one whenever `value` changes (a refresh, a range switch).
 * Render it inside a text element; a Tile accepts it directly as its `value`.
 */
export function CountUp({
  value,
  digits = 1,
  format,
  duration = 700,
  delay = 0,
  run = true,
}: {
  value: number;
  digits?: number;
  /** Formats each frame, e.g. `signed` for deltas. Defaults to `toFixed(digits)`. */
  format?: (n: number) => string;
  duration?: number;
  delay?: number;
  run?: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const [shown, setShown] = useState(0);
  const current = useRef(0);
  const anim = useAnimatedValue(0);
  useEffect(() => {
    if (!run || reduceMotion) return;
    anim.setValue(current.current);
    const id = anim.addListener(({ value: v }) => {
      current.current = v;
      setShown(v);
    });
    const tween = Animated.timing(anim, { toValue: value, duration, delay, easing: EASE_OUT, useNativeDriver: false });
    tween.start(({ finished }) => {
      if (!finished) return;
      current.current = value;
      setShown(value);
    });
    return () => {
      tween.stop();
      anim.removeListener(id);
    };
  }, [value, run, anim, reduceMotion, duration, delay]);
  const n = reduceMotion ? value : shown;
  return <>{format ? format(n) : n.toFixed(digits)}</>;
}

export const bandColorByKey = (key: BandKey) => bands.find((b) => b.key === key)!.color;
