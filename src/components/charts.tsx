import { useState } from 'react';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { lineChart, movingAverage, sparkline } from '@/lib/charts';
import { useColors } from '@/theme/ColorsProvider';
import { bandColor, fonts, palette } from '@/theme/tokens';

let chartId = 0;
const useId = (prefix: string) => useState(() => `${prefix}${chartId++}`)[0];

const MONO = fonts.mono[400];
const MONO_BOLD = fonts.mono[600];

/** 30-day area chart (344 × 90): ember line, ember fade, dashed 70 and 50 lines, end dot. */
export function TrendChart({ values }: { values: number[] }) {
  const c = useColors();
  const id = useId('g30');
  // y = (90 − v) × 1.8 puts 70 at y 36 and 50 at y 72, as in the design.
  const chart = lineChart(values, 320, 90, (v) => (90 - v) * 1.8);
  const [ex, ey] = chart.points[chart.points.length - 1];
  return (
    <Svg width="100%" style={{ aspectRatio: 344 / 90, overflow: 'visible' }} viewBox="0 0 344 90">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset={0} stopColor={palette.ember} stopOpacity={0.45} />
          <Stop offset={1} stopColor={palette.ember} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Line x1={0} y1={36} x2={320} y2={36} stroke="rgba(255,107,53,0.5)" strokeWidth={1} strokeDasharray="2 4" />
      <Line x1={0} y1={72} x2={320} y2={72} stroke="rgba(255,244,235,0.2)" strokeWidth={1} strokeDasharray="2 4" />
      <SvgText x={326} y={39} fontFamily={MONO} fontSize={9} fill={c.mute}>
        70
      </SvgText>
      <SvgText x={326} y={75} fontFamily={MONO} fontSize={9} fill={c.mute}>
        50
      </SvgText>
      <Path d={chart.area} fill={`url(#${id})`} />
      <Path d={chart.line} fill="none" stroke={palette.ember} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={ex} cy={ey} r={4} fill={c.ink} />
    </Svg>
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
    <Svg width="100%" style={{ aspectRatio: 346 / 150, overflow: 'visible' }} viewBox="0 0 346 150">
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
      <Path d={chart.area} fill={`url(#${area})`} />
      <Path d={ma.line} fill="none" stroke="rgba(255,244,235,0.55)" strokeWidth={1.2} strokeDasharray="3 3" />
      <Path d={chart.line} fill="none" stroke={`url(#${stroke})`} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={px} cy={py} r={4} fill={c.ink} stroke={bandColor.b5} strokeWidth={2} />
      <Rect x={calloutX} y={0} width={calloutW} height={18} rx={9} fill={bandColor.b5} />
      <SvgText x={calloutX + 8} y={12.5} fontFamily={MONO_BOLD} fontSize={10} fontWeight="600" fill="#fff">
        {peak.label}
      </SvgText>
      <Circle cx={ex} cy={ey} r={4} fill={c.ink} />
      {axis.map((a) => (
        <SvgText key={a.label + a.at} x={a.at * 322} y={150} fontFamily={MONO} fontSize={9} fill={c.mute}>
          {a.label}
        </SvgText>
      ))}
    </Svg>
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
