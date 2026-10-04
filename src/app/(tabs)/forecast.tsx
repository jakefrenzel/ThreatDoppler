import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CountUp, Tile, TileRow } from '@/components/data';
import { Card, CardHeader, Header, HeaderPill } from '@/components/layout';
import { OFFLINE_OPACITY, StatusBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { Bone, SkeletonCard } from '@/components/states';
import { Mono, T } from '@/components/T';
import { useCopy } from '@/copy/wording';
import { vectorNames } from '@/data/catalog';
import { useSnapshot } from '@/data/SnapshotProvider';
import type { ForecastDay } from '@/data/types';
import { useTextSize } from '@/lib/a11y';
import { plusMinus, signedInt } from '@/lib/format';
import { useColors } from '@/theme/ColorsProvider';
import { bandFor, heatStops } from '@/theme/tokens';

// The full scale: live forecast ranges can reach well below the design's 40.
const DOMAIN = [0, 100] as const;
const frac = (v: number) => (v - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0]);
const DAY_NAMES: Record<string, string> = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };

/** 90% range bar: the heat gradient spans the whole 0–100 track and only the lo–hi segment shows. */
function RangeBar({ day }: { day: ForecastDay }) {
  const c = useColors();
  const [w, setW] = useState(0);
  const left = frac(day.lo) * w;
  const width = (frac(day.hi) - frac(day.lo)) * w;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.track }}>
      {w > 0 && (
        <>
          <View style={{ position: 'absolute', top: 0, bottom: 0, left, width, borderRadius: 3, overflow: 'hidden' }}>
            <Svg width={w} height={6} style={{ position: 'absolute', left: -left }}>
              <Defs>
                <LinearGradient id={`fr${day.day}`} x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
                  {heatStops.map(([o, color]) => (
                    <Stop key={o} offset={o} stopColor={color} />
                  ))}
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={w} height={6} fill={`url(#fr${day.day})`} />
            </Svg>
          </View>
          <View
            style={{
              position: 'absolute',
              top: -3,
              left: frac(day.point) * w - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: c.ink,
              borderWidth: 2,
              borderColor: c.bg,
            }}
          />
        </>
      )}
    </View>
  );
}

/** 05 Forecast */
export default function Forecast() {
  const c = useColors();
  const copy = useCopy();
  const { L } = copy;
  const { accessibility } = useTextSize();
  const { data, status } = useSnapshot();
  const offline = status === 'offline' || status === 'error';

  if (!data) {
    return (
      <Screen tabBar>
        <Header eyebrow="UPDATING…" title="Forecast" />
        <StatusBanner />
        <SkeletonCard style={{ marginHorizontal: 14, height: 300, padding: 14, gap: 16 }}>
          {[100, 90, 95, 80, 85, 70, 90].map((w, i) => (
            <Bone key={i} width={`${w}%`} height={10} />
          ))}
        </SkeletonCard>
      </Screen>
    );
  }

  const days = data.forecast;
  const peak = days.reduce((a, b) => (b.point > a.point ? b : a));
  const low = days.reduce((a, b) => (b.point < a.point ? b : a));
  const mean = days.reduce((a, b) => a + b.point, 0) / days.length;
  const peakIndex = days.indexOf(peak);

  return (
    <Screen tabBar>
      <Header
        eyebrow={L.forecastEyebrow(data.model)}
        title="Forecast"
        right={<HeaderPill label="Global" accessibilityLabel="Scope: Global. Show regions" onPress={() => router.push('/now/breakdown?view=regions')} />}
      />
      <StatusBanner />
      <View style={{ gap: 10, opacity: offline ? OFFLINE_OPACITY : 1 }}>
        <TileRow wrap={accessibility}>
          <Tile
            highlight
            label={L.peak(peak.day)}
            value={<CountUp value={peak.point} digits={0} />}
            valueSize={24}
            style={{ flex: 1.3, flexBasis: accessibility ? '48%' : undefined }}
            accessibilityLabel={`Peak ${DAY_NAMES[peak.day]}, ${peak.point}, ${bandFor(peak.point).name}`}
          />
          <Tile label={L.low(low.day)} value={<CountUp value={low.point} digits={0} />} valueMono style={{ flexBasis: accessibility ? '48%' : undefined }} />
          <Tile label={L.mean} value={<CountUp value={mean} />} valueMono style={{ flexBasis: accessibility ? '48%' : undefined }} />
          <Tile label={L.mae} value={<CountUp value={data.forecastStats.mae} format={plusMinus} />} valueMono style={{ flexBasis: accessibility ? '48%' : undefined }} />
        </TileRow>

        <Card padding={[10, 14, 4]}>
          <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 6 }}>
            <Mono size={9} color={c.mute} style={{ width: 34 }}>
              DAY
            </Mono>
            {!accessibility && (
              <Mono size={9} color={c.mute} style={{ width: 20 }}>
                LO
              </Mono>
            )}
            <Mono size={9} color={c.mute} style={{ flex: 1 }} numberOfLines={1}>
              {L.rangeHead}
            </Mono>
            {!accessibility && (
              <Mono size={9} color={c.mute} style={{ width: 20 }}>
                HI
              </Mono>
            )}
            <Mono size={9} color={c.mute} style={{ width: 24 }}>
              {L.point}
            </Mono>
            <Mono size={9} color={c.mute} style={{ width: 28 }} align="right">
              Δ
            </Mono>
          </View>
          {days.map((d) => (
            <View
              key={d.day}
              accessible
              accessibilityLabel={`${DAY_NAMES[d.day]}, ${d.point}, ${bandFor(d.point).name}, range ${d.lo} to ${d.hi}, ${signedInt(d.delta)}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.line }}
            >
              <T mono size={11} weight={600} style={{ width: 34 }}>
                {d.day}
              </T>
              {!accessibility && (
                <T mono size={11} color={c.mute} style={{ width: 20 }}>
                  {String(d.lo)}
                </T>
              )}
              <RangeBar day={d} />
              {!accessibility && (
                <T mono size={11} color={c.mute} style={{ width: 20 }}>
                  {String(d.hi)}
                </T>
              )}
              <T size={15} weight={600} style={{ width: 24 }}>
                {String(d.point)}
              </T>
              <T mono size={11} color={d.delta > 0 ? c.ember : c.b1} style={{ width: 28 }} align="right">
                {signedInt(d.delta)}
              </T>
            </View>
          ))}
        </Card>

        <Card style={{ gap: 5 }}>
          <CardHeader left={L.outlook} right={L.outlookSub} style={{ paddingBottom: 4 }} />
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <View style={{ width: 84 }} />
            {days.map((d, i) => (
              <Mono key={d.day} size={9} tracking={0} color={i === peakIndex ? c.ember : c.mute} style={{ flex: 1 }}>
                {d.short}
              </Mono>
            ))}
          </View>
          {data.vectorForecast.map((row) => (
            <View key={row.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <T size={12} style={{ width: 84 }} numberOfLines={1}>
                {vectorNames[row.id]}
              </T>
              {row.values.map((v, i) => (
                <View
                  key={i}
                  accessible
                  accessibilityLabel={`${vectorNames[row.id]}, ${DAY_NAMES[days[i].day]}, ${v}, ${bandFor(v).name}`}
                  style={{ flex: 1, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: bandFor(v).color }}
                >
                  {/* #1A0E09 on every band: white on Severe fails contrast at this size. */}
                  <T mono size={10} weight={600} color={c.onEmber}>
                    {String(v)}
                  </T>
                </View>
              ))}
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
