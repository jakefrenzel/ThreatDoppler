import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { HistoryChart } from '@/components/charts';
import { Segmented } from '@/components/controls';
import { CountUp, StackedBar, Tile, bandColorByKey } from '@/components/data';
import { BackHeader, Card, CardHeader } from '@/components/layout';
import { Screen } from '@/components/Screen';
import { Mono, T } from '@/components/T';
import { useCopy } from '@/copy/wording';
import { vectorNames } from '@/data/catalog';
import { useSnapshot } from '@/data/SnapshotProvider';
import type { HistoryRange } from '@/data/types';
import { useTextSize } from '@/lib/a11y';
import { useColors } from '@/theme/ColorsProvider';
import { bandFor, bands } from '@/theme/tokens';

const spans: Record<HistoryRange['key'], { points: string; window: string }> = {
  '30D': { points: '30 DAYS', window: '30 DAYS' },
  '90D': { points: '90 DAYS', window: '90 DAYS' },
  '1Y': { points: '52 WEEKS', window: '12 MONTHS' },
  '5Y': { points: '60 MONTHS', window: '5 YEARS' },
};

/** 10 History */
export default function History() {
  const c = useColors();
  const copy = useCopy();
  const { L } = copy;
  const { accessibility } = useTextSize();
  const { data } = useSnapshot();
  const [range, setRange] = useState<HistoryRange['key']>('1Y');
  const h = data?.history.find((r) => r.key === range);

  const stats = h
    ? [
        { label: L.stat.average, value: <CountUp value={h.stats.average} digits={0} /> },
        { label: L.stat.median, value: <CountUp value={h.stats.median} digits={0} /> },
        { label: L.stat.sd, value: <CountUp value={h.stats.sd} /> },
        {
          label: L.stat.percentile,
          value: <CountUp value={h.stats.percentile} format={(n) => L.percentileValue(Math.round(n))} />,
          highlight: true,
        },
        { label: L.stat.high, value: <CountUp value={h.stats.high} digits={0} />, color: bandFor(h.stats.high).color },
        { label: L.stat.low, value: <CountUp value={h.stats.low} digits={0} />, color: bandFor(h.stats.low).color },
        { label: L.stat.above70, value: <CountUp value={h.stats.daysAbove70} digits={0} /> },
        { label: L.stat.above85, value: <CountUp value={h.stats.daysAbove85} digits={0} /> },
      ]
    : [];

  return (
    <Screen tabBar>
      <BackHeader
        title="History"
        onBack={() => router.back()}
        right={
          <Segmented
            label="Time range"
            variant="mono"
            stretch={false}
            options={(['30D', '90D', '1Y', '5Y'] as const).map((k) => ({ value: k, label: k }))}
            value={range}
            onChange={setRange}
          />
        }
      />
      {h && (
        <>
          <Card padding={[12, 14, 10]}>
            <CardHeader left={`${copy.label(h.unit)} · ${L.historyUnitSuffix}`} right={spans[range].points} style={{ paddingBottom: 8 }} />
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={`${copy.label(h.unit)}, ${spans[range].window.toLowerCase()}, from ${Math.round(h.series[0])} to ${Math.round(
                h.series[h.series.length - 1],
              )}, peak ${h.peak.label.replace(' · ', ' on ')}`}
            >
              <HistoryChart values={h.series} peak={h.peak} axis={h.axis} />
            </View>
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 14 }}>
            {stats.map((s) => (
              <Tile
                key={s.label}
                label={s.label}
                value={s.value}
                valueSize={18}
                valueColor={s.color}
                highlight={s.highlight}
                style={{ flexBasis: accessibility ? '47%' : '22%' }}
              />
            ))}
          </View>
          <Card style={{ gap: 8 }}>
            <CardHeader left={`${L.timeInBand} · ${spans[range].window}`} />
            <StackedBar
              items={h.timeInBand.map((b) => ({
                key: b.band,
                label: `${bands.find((x) => x.key === b.band)!.name.toUpperCase()} ${b.share}%`,
                value: b.share,
                color: bandColorByKey(b.band),
              }))}
            />
          </Card>
          <Card padding={[4, 14]}>
            {h.peaks.map((p, i) => (
              <View
                key={p.date + p.title}
                accessible
                accessibilityLabel={`${p.date}, ${p.title}, ${vectorNames[p.type]}, peak ${p.value}, ${bandFor(p.value).name}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}
              >
                <Mono size={10} tracking={0} color={c.mute} style={{ width: 48 }}>
                  {p.date}
                </Mono>
                <View style={{ flex: 1, gap: 1 }}>
                  <T size={13} weight={500}>
                    {p.title}
                  </T>
                  <Mono size={9} tracking={0} color={c.mute}>
                    {vectorNames[p.type].toUpperCase()}
                  </Mono>
                </View>
                <T size={15} weight={600} color={bandFor(p.value).color} style={{ width: 26 }} align="right">
                  {String(p.value)}
                </T>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
