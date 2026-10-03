import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';

import { TrendChart } from '@/components/charts';
import { BandDot, CountUp, ScoreBar, Tile, TileRow } from '@/components/data';
import { Card, CardHeader, CircleButton, Header, HeaderPill } from '@/components/layout';
import { OFFLINE_OPACITY, OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { Bone, SkeletonCard } from '@/components/states';
import { Mono, T } from '@/components/T';
import { useCopy } from '@/copy/wording';
import { regionNames, vectorNames } from '@/data/catalog';
import { useSnapshot } from '@/data/SnapshotProvider';
import type { Snapshot } from '@/data/types';
import { useTextSize } from '@/lib/a11y';
import { personalIndex } from '@/lib/alerts';
import { plusMinus, signed, signedInt } from '@/lib/format';
import { warning } from '@/lib/haptics';
import { usePrefs } from '@/state/store';
import { useColors } from '@/theme/ColorsProvider';
import { bandFor } from '@/theme/tokens';

/** 03 / 04 Now (home). Same layout at every wording level; only labels change. */
export default function NowScreen() {
  const { data, status, refresh } = useSnapshot();
  if (!data) return <NowLoading />;
  return <NowContent data={data} offline={status === 'offline'} refreshing={status === 'refreshing'} onRefresh={refresh} />;
}

function NowContent({ data, offline, refreshing, onRefresh }: { data: Snapshot; offline: boolean; refreshing: boolean; onRefresh: () => void }) {
  const c = useColors();
  const copy = useCopy();
  const { L } = copy;
  const { accessibility } = useTextSize();
  const sectors = usePrefs((s) => s.sectors);
  const showMyIndex = usePrefs((s) => s.showMyIndex);

  const { index } = data;
  const band = bandFor(index.value);
  const mine = showMyIndex ? personalIndex(data, sectors) : null;
  const trend = data.history.find((h) => h.key === '30D')!.stats;
  const deltaColor = (d: number) => (d > 0 ? c.ember : d < 0 ? c.b1 : c.ink);

  // Warning haptic when the index crosses into a new band while the app is open.
  const lastBand = useRef(band.key);
  useEffect(() => {
    if (lastBand.current !== band.key) warning();
    lastBand.current = band.key;
  }, [band.key]);

  const spoken = copy.isPlain
    ? `Global cyber index ${Math.round(index.value)}, ${band.name}, ${index.delta24h >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(index.delta24h))} in 1 day`
    : `Global index ${index.value.toFixed(1)}, ${band.name}, ${index.delta24h >= 0 ? 'up' : 'down'} ${Math.abs(index.delta24h).toFixed(1)} in 24 hours, plus or minus ${index.ci}`;
  const trendSpoken = `30-day trend, from ${data.trend30[0]} to ${data.trend30[data.trend30.length - 1]}, lowest ${trend.low}, highest ${trend.high}`;

  return (
    <Screen tabBar onRefresh={onRefresh}>
      <Header
        eyebrow={refreshing ? 'UPDATING…' : L.nowEyebrow(data.updatedAt, data.model)}
        title="Cyber weather"
        right={
          <>
            <HeaderPill label="Global" accessibilityLabel="Scope: Global. Show regions" onPress={() => router.push('/now/breakdown?view=regions')} />
            <CircleButton icon="sliders" label="Settings" strokeWidth={2} onPress={() => router.push('/settings')} />
          </>
        }
      />
      {offline && <OfflineBanner />}
      <View style={{ gap: 10, opacity: offline ? OFFLINE_OPACITY : 1 }}>
        <TileRow wrap={accessibility}>
          <Tile
            highlight
            label={L.index(band.name)}
            labelSize={10}
            pad={[9, 12]}
            radius={18}
            accessibilityLabel={spoken}
            style={{ flex: 1.4, flexBasis: accessibility ? '48%' : undefined }}
            value={
              <>
                <T size={26} weight={600} leading={1.1}>
                  <CountUp value={index.value} />
                </T>
                {/* "Show my index" (Settings): the personal index sits next to the global one. */}
                {mine !== null && (
                  <Mono size={9} tracking={0} color={c.mute} accessibilityLabel={`Your index ${mine}`}>
                    {`${L.myIndex} ${mine} · ${signedInt(mine - Math.round(index.value))}`}
                  </Mono>
                )}
              </>
            }
          />
          {[
            { label: L.d24, value: <CountUp value={index.delta24h} format={signed} />, color: deltaColor(index.delta24h) },
            { label: L.d7, value: <CountUp value={index.delta7d} format={signed} />, color: deltaColor(index.delta7d) },
            { label: L.ci, value: <CountUp value={index.ci} format={plusMinus} />, color: c.ink },
          ].map((t) => (
            <Tile
              key={t.label}
              label={t.label}
              labelSize={10}
              value={t.value}
              valueMono
              valueColor={t.color}
              valueGap={5}
              pad={[9, 10]}
              radius={18}
              style={{ flexBasis: accessibility ? '48%' : undefined }}
            />
          ))}
        </TileRow>

        <Pressable onPress={() => router.push('/now/history')} accessibilityRole="button" accessibilityLabel={trendSpoken} accessibilityHint="Opens history">
          <Card padding={[12, 14, 10]}>
            <CardHeader left={L.trendTitle} right={L.trendStats(trend.low, trend.high, trend.sd)} style={{ marginBottom: 8 }} />
            <TrendChart values={data.trend30} />
          </Card>
        </Pressable>

        <Pressable onPress={() => router.push('/now/breakdown')} accessibilityRole="button" accessibilityHint="Opens the sector breakdown">
          <Card padding={[4, 14]}>
            <View style={{ flexDirection: 'row', gap: 8, paddingTop: 8, paddingBottom: 6 }}>
              <Mono size={10} tracking={0} color={c.mute} style={{ flex: 1 }}>
                {L.vector}
              </Mono>
              {!accessibility && (
                <Mono size={10} tracking={0} color={c.mute} style={{ width: 34 }}>
                  {L.weight}
                </Mono>
              )}
              <Mono size={10} tracking={0} color={c.mute} style={{ width: 70 }}>
                {L.score}
              </Mono>
              <Mono size={10} tracking={0} color={c.mute} style={{ width: 44 }} align="right">
                {L.d24}
              </Mono>
            </View>
            {data.vectors.map((v, i) => {
              const color = bandFor(v.score).color;
              const dColor = v.delta24h > 0.5 ? c.ember : v.delta24h < 0 ? c.b1 : c.mute;
              return (
                <View
                  key={v.id}
                  accessible
                  accessibilityLabel={`${vectorNames[v.id]}, ${v.score}, ${bandFor(v.score).name}, ${signed(v.delta24h)}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.line }}
                >
                  <T size={13} weight={500} style={{ flex: 1 }} numberOfLines={1}>
                    {vectorNames[v.id]}
                  </T>
                  {!accessibility && (
                    <T mono size={12} color={c.mute} style={{ width: 34 }}>
                      {v.weight.toFixed(2).slice(1)}
                    </T>
                  )}
                  <View style={{ width: 70, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <T mono size={12} style={{ minWidth: 18 }}>
                      {/* In step with the score bar beside it (400 ms, 30 ms stagger per row). */}
                      <CountUp value={v.score} digits={0} duration={400} delay={i * 30} />
                    </T>
                    <ScoreBar score={v.score} color={color} index={i} />
                  </View>
                  <T mono size={12} weight={600} color={dColor} style={{ width: 44 }} align="right">
                    {signed(v.delta24h)}
                  </T>
                </View>
              );
            })}
          </Card>
        </Pressable>

        <View style={{ flexDirection: 'row', flexWrap: accessibility ? 'wrap' : 'nowrap', gap: 6, marginHorizontal: 14 }}>
          {data.regions.map((r) => {
            const b = bandFor(r.score);
            return (
              <Pressable
                key={r.id}
                onPress={() => router.push('/now/breakdown?view=regions')}
                accessibilityRole="button"
                accessibilityLabel={`${regionNames[r.id].full}, ${r.score}, ${b.name}`}
                style={{
                  flex: 1,
                  flexBasis: accessibility ? '30%' : undefined,
                  paddingVertical: 7,
                  paddingHorizontal: 9,
                  borderRadius: 14,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.line,
                }}
              >
                <Mono size={9} tracking={0} color={c.mute} numberOfLines={1}>
                  {regionNames[r.id].short}
                </Mono>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <BandDot color={b.color} />
                  <T size={17} weight={600}>
                    <CountUp value={r.score} digits={0} />
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginHorizontal: 20, gap: 5 }}>
          {data.events.slice(0, 2).map((e) => (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/threat/${e.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${e.time}, ${copy.event(e.headline)}, impact ${signed(e.impact)}`}
              style={{ flexDirection: 'row', gap: 8 }}
            >
              <T mono size={12} color={c.mute} style={{ width: 42 }}>
                {e.time}
              </T>
              <T size={12} style={{ flex: 1 }}>
                {copy.event(e.headline)}
              </T>
              <T mono size={12} color={e.impact > 0 ? c.ember : e.impact < 0 ? c.b1 : c.dim}>
                {signed(e.impact)}
              </T>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

/** 13a Now · Loading: skeletons matching each card's radius and height. */
function NowLoading() {
  const c = useColors();
  return (
    <Screen tabBar gap={10}>
      <View
        accessible
        accessibilityLabel="Updating today's index"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 }}
      >
        <View>
          <Mono size={11} color={c.mute}>
            UPDATING…
          </Mono>
          <T size={22} weight={600} tracking={-0.02}>
            Cyber weather
          </T>
        </View>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.card2 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginHorizontal: 14 }}>
        {[1.4, 1, 1, 1].map((flex, i) => (
          <SkeletonCard key={i} radius={18} style={{ flex, height: 62, paddingVertical: 10, paddingHorizontal: 12, gap: 8 }}>
            <Bone width="60%" />
            <Bone width="80%" height={14} />
          </SkeletonCard>
        ))}
      </View>
      <SkeletonCard style={{ marginHorizontal: 14, height: 140, padding: 14, gap: 10 }}>
        <Bone width="40%" />
        <View style={{ flex: 1, borderRadius: 12, backgroundColor: 'rgba(255,244,235,0.05)' }} />
      </SkeletonCard>
      <SkeletonCard style={{ marginHorizontal: 14, height: 214, padding: 14, gap: 14 }}>
        <Bone width="35%" />
        {[100, 90, 95, 70, 85, 60].map((w, i) => (
          <Bone key={i} width={`${w}%`} height={10} />
        ))}
      </SkeletonCard>
      <View style={{ flexDirection: 'row', gap: 6, marginHorizontal: 14 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} radius={14} style={{ flex: 1, height: 50, padding: 9, gap: 8 }}>
            <Bone width="70%" height={6} />
            <Bone width="50%" height={12} />
          </SkeletonCard>
        ))}
      </View>
    </Screen>
  );
}
