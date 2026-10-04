import { View } from 'react-native';

import { BandDot } from '@/components/data';
import { Card, CardHeader } from '@/components/layout';
import { SettingsPage } from '@/components/settings';
import { Mono, T } from '@/components/T';
import { vectorNames } from '@/data/catalog';
import { useSnapshot } from '@/data/SnapshotProvider';
import { useColors } from '@/theme/ColorsProvider';
import { bands } from '@/theme/tokens';

/** The method in short. The full version, with the reasons, is docs/backend-plan.md. */
const method: [string, string][] = [
  [
    'SCORES',
    'Each threat type is built from public signals, such as newly exploited flaws or ransomware leak-site posts. Each signal is compared with its own last two years, so very different sources can be compared. Recent days count most; a busy day fades out over a few weeks.',
  ],
  [
    'BANDS',
    'Scores are placed so the bands mean the same everywhere: Severe is the busiest 5% of days in the last two years, High the next 21%, Elevated about half, Guarded 21% and Low the quietest 3%.',
  ],
  [
    'THE INDEX',
    'The index mixes the threat types by the shares above, then is placed on the same bands. It covers complete days (UTC), so it changes once a day; the feed updates every hour. The ± figure is how much the index usually moves in a day: nine days out of ten, it moves less than that.',
  ],
  [
    'SECTORS AND REGIONS',
    'These are modelled estimates. Each one applies its usual mix of attack types, from thousands of past incidents, to the global scores. They move with the global picture rather than measuring each sector directly.',
  ],
  [
    'FORECAST',
    'A best guess for each of the next seven days, with a 90% range: the true value should land inside it nine days out of ten. The error figure is how far past forecasts actually missed, on average.',
  ],
  [
    'EVENTS',
    'Events come from rules, such as a flaw added to the exploited list, a ransomware group posting 10 or more victims in a day, or a new data breach. Their impact is their share of the day’s rise in their threat type.',
  ],
];

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
      {method.map(([head, body]) => (
        <View key={head} style={{ gap: 4, paddingHorizontal: 20 }}>
          <Mono size={10} color={c.mute}>
            {head}
          </Mono>
          <T size={14} leading={1.45} color={c.body}>
            {body}
          </T>
        </View>
      ))}
      {data && (
        <Mono size={10} tracking={0} color={c.dim} style={{ paddingHorizontal: 20 }}>
          {`MODEL ${data.model}`}
        </Mono>
      )}
    </SettingsPage>
  );
}
