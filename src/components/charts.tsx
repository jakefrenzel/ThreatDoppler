import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { useReduceMotion } from '@/lib/a11y';
import { lineChart, movingAverage, sparkline, trendDomain } from '@/lib/charts';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { useColors } from '@/theme/ColorsProvider';
import { bandColor, fonts, palette } from '@/theme/tokens';

let chartId = 0;
const useId = (prefix: string) => useState(() => `${prefix}${chartId++}`)[0];

const MONO = fonts.mono[400];
const MONO_BOLD = fonts.mono[600];

const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
/** Room above and below the plot so dots on the top edge aren't clipped by the reveal. */
const BLEED = 8;

/**
 * Draws a chart as two layers in the same viewBox: `base` (reference lines, labels) shows
 * straight away, and `data` (line, area, dots) is wiped in from left to right (700 ms
 * ease-out, matching the index count-up) on mount and again whenever `revealKey` changes,
 * i.e. when the plotted data is different. A refresh that brings back the same data leaves
 * the chart still. Under Reduce Motion it shows at once.
 */
function RevealChart({
  width,
  height,
  revealKey,
  base,
  data,
}: {
  width: number;
  height: number;
  revealKey: string;
  base: ReactNode;
  data: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  const [w, setW] = useState(0);
  const progress = useAnimatedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const wipe = Animated.timing(progress, { toValue: 1, duration: 700, easing: EASE_OUT, useNativeDriver: false });
    wipe.start();
    return () => wipe.stop();
  }, [progress, reduceMotion, revealKey]);

  const viewBox = `0 0 ${width} ${height}`;
  return (
    <View style={{ aspectRatio: width / height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Svg width="100%" height="100%" viewBox={viewBox} style={{ overflow: 'visible' }}>
        {base}
      </Svg>
      {w > 0 && (
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            top: -BLEED,
            bottom: -BLEED,
            overflow: 'hidden',
            width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, w] }),
          }}
        >
          <Svg width={w} height={(w * height) / width} viewBox={viewBox} style={{ marginTop: BLEED }}>
            {data}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

/** 30-day area chart (344 × 90): ember line, ember fade, dashed 70 and 50 lines, end dot. */
export function TrendChart({ values }: { values: number[] }) {
  const c = useColors();
  const id = useId('g30');
  // Over the design's 40–90 range this puts 70 at y 36 and 50 at y 72; lower or higher values
  // widen the range so the line stays inside the chart.
  const [lo, hi] = trendDomain(values);
  const y = (v: number) => ((hi - v) / (hi - lo)) * 90;
  const chart = lineChart(values, 320, 90, y);
  const [ex, ey] = chart.points[chart.points.length - 1];
  return (
    <RevealChart
      width={344}
      height={90}
      revealKey={values.join(',')}
      base={
        <>
          <Line x1={0} y1={y(70)} x2={320} y2={y(70)} stroke="rgba(255,107,53,0.5)" strokeWidth={1} strokeDasharray="2 4" />
          <Line x1={0} y1={y(50)} x2={320} y2={y(50)} stroke="rgba(255,244,235,0.2)" strokeWidth={1} strokeDasharray="2 4" />
          <SvgText x={326} y={y(70) + 3} fontFamily={MONO} fontSize={9} fill={c.mute}>
            70
          </SvgText>
          <SvgText x={326} y={y(50) + 3} fontFamily={MONO} fontSize={9} fill={c.mute}>
            50
          </SvgText>
        </>
      }
      data={
        <>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset={0} stopColor={palette.ember} stopOpacity={0.45} />
              <Stop offset={1} stopColor={palette.ember} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={chart.area} fill={`url(#${id})`} />
          <Path d={chart.line} fill="none" stroke={palette.ember} strokeWidth={2} strokeLinejoin="round" />
          <Circle cx={ex} cy={ey} r={4} fill={c.ink} />
        </>
      }
    />
  );
}

/**
 * History chart (346 × 150): band-gradient line, dashed 4-point moving average, reference
 * lines at 85/70/50, a callout on the peak and axis labels.
 */
export function HistoryChart({
  values,
  peak,
  axis,
}: {
  values: number[];
  peak: { index: number; label: string };
  axis: { at: number; label: string }[];
}) {
  const c = useColors();
  const area = useId('gha');
  const stroke = useId('ghl');
  const y = (v: number) => 136 - v * 1.36;
  const chart = lineChart(values, 322, 136, y);
  const ma = lineChart(movingAverage(values, 4), 322, 136, y);
  const [px, py] = chart.points[peak.index] ?? chart.points[0];
  const [ex, ey] = chart.points[chart.points.length - 1];
  const calloutW = Math.max(56, peak.label.length * 6.2 + 12);
  // Keep the callout inside the plot when the peak is near the right edge.
  const calloutX = px + 10 + calloutW > 340 ? px - 10 - calloutW : px + 10;
  return (
    <RevealChart
      width={346}
      height={150}
      revealKey={values.join(',')}
      base={
        <>
          <Line x1={0} y1={20.4} x2={322} y2={20.4} stroke="rgba(232,54,74,0.5)" strokeWidth={1} strokeDasharray="2 4" />
          <Line x1={0} y1={40.8} x2={322} y2={40.8} stroke="rgba(255,107,53,0.5)" strokeWidth={1} strokeDasharray="2 4" />
          <Line x1={0} y1={68} x2={322} y2={68} stroke="rgba(255,244,235,0.18)" strokeWidth={1} strokeDasharray="2 4" />
          <SvgText x={328} y={23} fontFamily={MONO} fontSize={9} fill={c.mute}>
            85
          </SvgText>
          <SvgText x={328} y={44} fontFamily={MONO} fontSize={9} fill={c.mute}>
            70
          </SvgText>
          <SvgText x={328} y={71} fontFamily={MONO} fontSize={9} fill={c.mute}>
            50
          </SvgText>
          {axis.map((a) => (
            <SvgText key={a.label + a.at} x={a.at * 322} y={150} fontFamily={MONO} fontSize={9} fill={c.mute}>
              {a.label}
            </SvgText>
          ))}
        </>
      }
      data={
        <>
          <Defs>
            <LinearGradient id={area} x1="0" y1="0" x2="0" y2="1">
              <Stop offset={0} stopColor={bandColor.b5} stopOpacity={0.55} />
              <Stop offset={0.35} stopColor={palette.ember} stopOpacity={0.35} />
              <Stop offset={1} stopColor={palette.ember} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id={stroke} x1="0" y1="0" x2="0" y2="136" gradientUnits="userSpaceOnUse">
              <Stop offset={0} stopColor={bandColor.b5} />
              <Stop offset={0.3} stopColor={palette.ember} />
              <Stop offset={0.55} stopColor={bandColor.b3} />
              <Stop offset={1} stopColor={bandColor.b2} />
            </LinearGradient>
          </Defs>
          <Path d={chart.area} fill={`url(#${area})`} />
          <Path d={ma.line} fill="none" stroke="rgba(255,244,235,0.55)" strokeWidth={1.2} strokeDasharray="3 3" />
          <Path d={chart.line} fill="none" stroke={`url(#${stroke})`} strokeWidth={2} strokeLinejoin="round" />
          <Circle cx={px} cy={py} r={4} fill={c.ink} stroke={bandColor.b5} strokeWidth={2} />
          <Rect x={calloutX} y={0} width={calloutW} height={18} rx={9} fill={bandColor.b5} />
          <SvgText x={calloutX + 8} y={12.5} fontFamily={MONO_BOLD} fontSize={10} fontWeight="600" fill="#fff">
            {peak.label}
          </SvgText>
          <Circle cx={ex} cy={ey} r={4} fill={c.ink} />
        </>
      }
    />
  );
}

/** 56 × 18 sparkline coloured by band. */
export function Sparkline({ values, color, width = 56, height = 18 }: { values: number[]; color: string; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <Polyline points={sparkline(values, width, height)} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
