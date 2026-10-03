import { useRef, useState } from 'react';
import { View } from 'react-native';

import { useColors } from '@/theme/ColorsProvider';
import { heatStops, shadows } from '@/theme/tokens';
import { GradientFill } from './data';
import { Mono } from './T';

interface Props {
  value: number;
  onChange: (v: number) => void;
  /** Today's value, drawn as a thin marker. */
  marker?: number;
  markerLabel?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Plain track instead of the heat gradient (jump sizes have no bands). */
  plain?: boolean;
  label: string;
  valueText: string;
}

/** Threshold slider on the 8 pt heat bar with a 24 pt knob (07, 12). */
export function HeatSlider({ value, onChange, marker, markerLabel, min = 0, max = 100, step = 1, plain, label, valueText }: Props) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const drag = useRef({ x0: 0, page0: 0 });

  const fromX = (x: number) => {
    if (!width) return min;
    const raw = min + (Math.max(0, Math.min(width, x)) / width) * (max - min);
    return Math.round(raw / step) * step;
  };

  const pct = (v: number) => `${((v - min) / (max - min)) * 100}%` as const;

  return (
    <View>
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          drag.current = { x0: e.nativeEvent.locationX, page0: e.nativeEvent.pageX };
          onChange(fromX(e.nativeEvent.locationX));
        }}
        onResponderMove={(e) => onChange(fromX(drag.current.x0 + e.nativeEvent.pageX - drag.current.page0))}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: valueText }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const delta = e.nativeEvent.actionName === 'increment' ? step : -step;
          onChange(Math.max(min, Math.min(max, value + delta)));
        }}
        style={{ height: 44, marginTop: -4, justifyContent: 'center' }}
      >
        <View pointerEvents="none" style={{ height: 8, borderRadius: 4, backgroundColor: plain ? c.track : undefined }}>
          {!plain && <GradientFill stops={heatStops} radius={4} />}
          {marker !== undefined && (
            <View
              style={{
                position: 'absolute',
                left: pct(marker),
                top: -5,
                width: 2,
                height: 18,
                marginLeft: -1,
                backgroundColor: 'rgba(255,244,235,0.6)',
              }}
            />
          )}
          <View
            style={{
              position: 'absolute',
              left: pct(value),
              top: -8,
              width: 24,
              height: 24,
              marginLeft: -12,
              borderRadius: 12,
              backgroundColor: c.ink,
              boxShadow: shadows.knob,
            }}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 }}>
        <Mono size={9} tracking={0} color={c.dim}>
          {String(min)}
        </Mono>
        {markerLabel ? (
          <Mono size={9} tracking={0} color={c.mute}>
            {markerLabel}
          </Mono>
        ) : null}
        <Mono size={9} tracking={0} color={c.dim}>
          {String(max)}
        </Mono>
      </View>
    </View>
  );
}
