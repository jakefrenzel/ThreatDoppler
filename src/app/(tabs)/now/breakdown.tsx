import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Sparkline } from '@/components/charts';
import { Segmented } from '@/components/controls';
import { BandDot, Tile, TileRow } from '@/components/data';
import { BackHeader, Card } from '@/components/layout';
import { Screen } from '@/components/Screen';
import { Mono, T } from '@/components/T';
import { useCopy } from '@/copy/wording';
import { regionNames, sectorNames, vectorNames } from '@/data/catalog';
import { useSnapshot } from '@/data/SnapshotProvider';
import type { AreaScore } from '@/data/types';
import { useTextSize } from '@/lib/a11y';
import { signedInt } from '@/lib/format';
import { usePrefs } from '@/state/store';
import { useColors } from '@/theme/ColorsProvider';
import { bandFor } from '@/theme/tokens';

type View_ = 'sectors' | 'regions';

/** 09 Sectors breakdown (and the same table for regions). */
export default function Breakdown() {
  const c = useColors();
  const { L } = useCopy();
  const { accessibility } = useTextSize();
  const params = useLocalSearchParams<{ view?: View_ }>();
  const [view, setView] = useState<View_>(params.view === 'regions' ? 'regions' : 'sectors');
  const { data } = useSnapshot();
  const mySectors = usePrefs((s) => s.sectors);
  const myRegions = usePrefs((s) => s.regions);

  const rows: AreaScore<string>[] = data ? (view === 'sectors' ? data.sectors : data.regions) : [];
  const mine: string[] = view === 'sectors' ? mySectors : myRegions;
  const name = (id: string) => (view === 'sectors' ? sectorNames[id as keyof typeof sectorNames] : regionNames[id as keyof typeof regionNames].medium);

  const hottest = [...rows].sort((a, b) => b.score - a.score)[0];
  const cooling = [...rows].sort((a, b) => a.delta24h - b.delta24h)[0];
  const picked = rows.filter((r) => mine.includes(r.id));
  const average = picked.length ? Math.round(picked.reduce((a, r) => a + r.score, 0) / picked.length) : null;
  const dColor = (d: number) => (d > 0 ? c.ember : d < 0 ? c.b1 : c.dim);

  return (
    <Screen tabBar>
      <BackHeader
        title="Breakdown"
        onBack={() => router.back()}
        right={
          <Segmented
            label="Breakdown by"
            variant="compact"
            stretch={false}
            options={[
              { value: 'sectors', label: 'Sectors' },
              { value: 'regions', label: 'Regions' },
            ]}
            value={view}
            onChange={setView}
          />
        }
      />
      {data && hottest && (
        <>
          <TileRow wrap={accessibility}>
            <Tile highlight label="HOTTEST" value={`${name(hottest.id)} ${hottest.score}`} />
            <Tile label="YOUR AVERAGE" value={average !== null ? String(average) : '—'} />
            <Tile label="COOLING" value={name(cooling.id)} valueColor={c.b1} />
          </TileRow>
          <Card padding={[8, 14, 4]}>
            <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 6 }}>
              <Mono size={9} color={c.mute} style={{ flex: 1 }}>
                {L.breakdownHead(view)}
              </Mono>
              {!accessibility && (
                <Mono size={9} color={c.mute} style={{ width: 56 }}>
                  7D
                </Mono>
              )}
              <Mono size={9} color={c.mute} style={{ width: 28 }}>
                NOW
              </Mono>
              <Mono size={9} color={c.mute} style={{ width: 30 }} align="right">
                24H
              </Mono>
              {!accessibility && (
                <Mono size={9} color={c.mute} style={{ width: 30 }} align="right">
                  7D
                </Mono>
              )}
            </View>
            {rows.map((r) => {
              const band = bandFor(r.score);
              const isMine = mine.includes(r.id);
              return (
                <View
                  key={r.id}
                  accessible
                  accessibilityLabel={`${name(r.id)}${isMine ? ', yours' : ''}, ${r.score}, ${band.name}, ${signedInt(r.delta24h)} in 24 hours, ${signedInt(r.delta7d)} in 7 days, top threat ${vectorNames[r.topVector]}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.line }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <T size={14} weight={600} numberOfLines={1} style={{ flexShrink: 1 }}>
                        {name(r.id)}
                      </T>
                      {isMine && <BandDot color={c.ember} />}
                    </View>
                    <Mono size={9} tracking={0} color={c.mute}>
                      {vectorNames[r.topVector].toUpperCase()}
                    </Mono>
                  </View>
                  {!accessibility && <Sparkline values={r.series7d} color={band.color} />}
                  <T size={15} weight={600} style={{ width: 28 }}>
                    {String(r.score)}
                  </T>
                  <T mono size={11} color={dColor(r.delta24h)} style={{ width: 30 }} align="right">
                    {signedInt(r.delta24h)}
                  </T>
                  {!accessibility && (
                    <T mono size={11} color={r.delta7d > 0 ? c.ember : c.b1} style={{ width: 30 }} align="right">
                      {signedInt(r.delta7d)}
                    </T>
                  )}
                </View>
              );
            })}
          </Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20 }}>
            <BandDot color={c.ember} />
            <Mono size={9} tracking={0} color={c.mute}>
              {view === 'sectors' ? 'YOUR SECTORS' : 'YOUR REGIONS'}
            </Mono>
          </View>
        </>
      )}
    </Screen>
  );
}
