import { View } from 'react-native';

import { BandDot } from '@/components/data';
import { Card, CardHeader } from '@/components/layout';
import { SettingsPage } from '@/components/settings';
import { Mono, T } from '@/components/T';
import { vectorNames } from '@/data/catalog';
import { useSnapshot } from '@/data/SnapshotProvider';
import { useColors } from '@/theme/ColorsProvider';
import { bands } from '@/theme/tokens';

/** About · How the index works */
export default function AboutIndex() {
  const c = useColors();
  const { data } = useSnapshot();
  return (
    <SettingsPage eyebrow="ABOUT" title="How the index works">
      <T size={14} leading={1.45} color={c.mute} style={{ paddingHorizontal: 20 }}>
        ThreatDoppler reports global cyber threat levels the way a weather forecast reports the weather: one number from 0 to 100,
        split into five bands, with breakdowns by threat type, sector and region.
      </T>
      <Card style={{ gap: 2 }}>
        <CardHeader left="BANDS" right="RANGE" style={{ paddingBottom: 4 }} />
        {bands.map((b, i) => {
          const max = bands[i + 1] ? bands[i + 1].min - 1 : 100;
          return (
            <View key={b.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.line }}>
              <BandDot color={b.color} size={8} />
              <T size={14} weight={500} style={{ flex: 1 }}>
                {b.name}
              </T>
              <Mono size={11} tracking={0} color={c.mute}>
                {`${b.min}–${max}`}
              </Mono>
            </View>
          );
        })}
      </Card>
      {data && (
        <Card style={{ gap: 2 }}>
          <CardHeader left="THREAT TYPES" right="SHARE OF THE INDEX" style={{ paddingBottom: 4 }} />
          {data.vectors.map((v) => (
            <View key={v.id} style={{ flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.line }}>
              <T size={14} style={{ flex: 1 }}>
                {vectorNames[v.id]}
              </T>
              <Mono size={11} tracking={0} color={c.mute}>
                {`${Math.round(v.weight * 100)}%`}
              </Mono>
            </View>
          ))}
        </Card>
      )}
      <T size={14} leading={1.45} color={c.mute} style={{ paddingHorizontal: 20 }}>
        Each threat type gets its own score. The index is their weighted mix. The forecast gives a best guess for each of the next
        seven days with a 90% range: the true value should land inside it nine days out of ten. Your personal index is the average of
        the sectors you follow.
      </T>
    </SettingsPage>
  );
}
