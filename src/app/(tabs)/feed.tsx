import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, View } from 'react-native';

import { Chip } from '@/components/controls';
import { StackedBar } from '@/components/data';
import { Card, CardHeader, Header } from '@/components/layout';
import { OFFLINE_OPACITY, OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { Bone, EmptyState, SkeletonCard } from '@/components/states';
import { Mono, T } from '@/components/T';
import { useCopy } from '@/copy/wording';
import { eventTypeOrder, eventTypes, sectorNames } from '@/data/catalog';
import { useSnapshot } from '@/data/SnapshotProvider';
import type { EventType, SectorId } from '@/data/types';
import { useReduceMotion } from '@/lib/a11y';
import { signed } from '@/lib/format';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { usePrefs } from '@/state/store';
import { useColors } from '@/theme/ColorsProvider';

type Filter = { kind: 'all' } | { kind: 'type'; type: EventType } | { kind: 'sector'; sector: SectorId };

/** Pulsing live dot: ring scales 1 → 1.8 and fades .25 → 0 every 1.6 s. */
function LiveDot() {
  const c = useColors();
  const reduceMotion = useReduceMotion();
  const pulse = useAnimatedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);
  return (
    <View style={{ width: 7, height: 7 }}>
      <Animated.View
        style={{
          position: 'absolute',
          left: -4,
          top: -4,
          width: 15,
          height: 15,
          borderRadius: 7.5,
          backgroundColor: c.ember,
          opacity: reduceMotion ? 0.25 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] }),
          transform: reduceMotion ? [] : [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
        }}
      />
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.ember }} />
    </View>
  );
}

function LivePill({ offline, count }: { offline: boolean; count: number }) {
  const c = useColors();
  return (
    <View
      accessible
      accessibilityLabel={offline ? 'Offline' : count ? `Live, ${count} new events` : 'Live'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: offline ? c.card2 : c.emberSoft,
      }}
    >
      {offline ? <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.dim }} /> : <LiveDot />}
      <T size={12} weight={600} color={offline ? c.mute : c.ember}>
        {offline ? 'Offline' : count ? `Live · ${count} new` : 'Live'}
      </T>
    </View>
  );
}

/** 06 Feed, with 13b Offline and 13d Empty. */
export default function Feed() {
  const c = useColors();
  const copy = useCopy();
  const { L } = copy;
  const { data, status, refresh } = useSnapshot();
  const mySectors = usePrefs((s) => s.sectors);
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const offline = status === 'offline';

  if (!data) {
    return (
      <Screen tabBar>
        <Header eyebrow="UPDATING…" title="Live feed" />
        <SkeletonCard style={{ marginHorizontal: 14, height: 70, padding: 14, gap: 10 }}>
          <Bone width="40%" />
          <Bone height={10} />
        </SkeletonCard>
        <SkeletonCard style={{ marginHorizontal: 14, height: 380, padding: 14, gap: 18 }}>
          {[90, 75, 95, 70, 85, 80, 60].map((w, i) => (
            <Bone key={i} width={`${w}%`} height={10} />
          ))}
        </SkeletonCard>
      </Screen>
    );
  }

  const total = data.eventMix.reduce((a, b) => a + b.count, 0);
  const events = data.events.filter((e) =>
    filter.kind === 'all' ? true : filter.kind === 'type' ? e.type === filter.type : e.sectors.includes(filter.sector),
  );
  const filterName =
    filter.kind === 'type' ? eventTypes[filter.type].chip : filter.kind === 'sector' ? sectorNames[filter.sector] : null;
  const isOn = (f: Filter) =>
    f.kind === filter.kind &&
    (f.kind === 'all' || (f.kind === 'type' && filter.kind === 'type' && f.type === filter.type) || (f.kind === 'sector' && filter.kind === 'sector' && f.sector === filter.sector));

  const chips: { f: Filter; label: string; count: number }[] = [
    { f: { kind: 'all' }, label: 'All', count: total },
    ...eventTypeOrder
      .filter((t) => t !== 'supply')
      .map((t) => ({ f: { kind: 'type', type: t } as Filter, label: eventTypes[t].chip, count: data.eventMix.find((m) => m.type === t)?.count ?? 0 })),
    ...mySectors.map((s) => ({ f: { kind: 'sector', sector: s } as Filter, label: sectorNames[s], count: data.events.filter((e) => e.sectors.includes(s)).length })),
  ];

  return (
    <Screen tabBar refreshing={status === 'refreshing'} onRefresh={refresh}>
      <Header
        eyebrow={`${filterName ? filterName.toUpperCase() : 'GLOBAL'} · LAST 24H`}
        title="Live feed"
        right={<LivePill offline={offline} count={data.newEvents} />}
      />
      {offline && <OfflineBanner />}
      <Card style={{ gap: 8 }}>
        <CardHeader left={L.feedMix(total)} right={L.netImpact(data.netImpact24h)} />
        <StackedBar
          items={data.eventMix.map((m) => ({
            key: m.type,
            label: `${eventTypes[m.type].mix} ${m.count}`,
            value: m.count,
            color: eventTypes[m.type].color,
          }))}
        />
      </Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 14 }} style={{ flexGrow: 0 }}>
        {chips.map((chip) => (
          <Chip key={chip.label} label={chip.label} count={chip.count} selected={isOn(chip.f)} onPress={() => setFilter(chip.f)} />
        ))}
      </ScrollView>
      {events.length === 0 ? (
        <EmptyState
          title={`Nothing new for ${filterName}`}
          body="No events in the last 24 hours. New ones will appear here as they come in."
          action={filter.kind === 'sector' ? 'Show all sectors' : 'Show all events'}
          onAction={() => setFilter({ kind: 'all' })}
        />
      ) : (
        <Card padding={[2, 14]} style={{ opacity: offline ? OFFLINE_OPACITY : 1 }}>
          {events.map((e, i) => {
            const type = eventTypes[e.type];
            const title = copy.event(e.title);
            return (
              <Pressable
                key={e.id}
                onPress={() => router.push(`/threat/${e.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${e.time}, ${type.chip}, ${title}, ${e.source}, impact ${signed(e.impact)}`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  gap: 10,
                  paddingVertical: 8,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: c.line,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <T mono size={11} color={c.mute} style={{ width: 36 }}>
                  {e.time}
                </T>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: type.color }} />
                    <Mono size={9} color={type.color}>
                      {type.label}
                    </Mono>
                  </View>
                  {/* Titles may truncate in lists; the full title is on the detail sheet. */}
                  <T size={13} weight={500} leading={1.3} numberOfLines={1}>
                    {title}
                  </T>
                  <Mono size={9} tracking={0} color={c.mute} numberOfLines={1}>
                    {`${e.source} · ${e.meta}`}
                  </Mono>
                </View>
                <T mono size={12} weight={600} color={e.impact > 0 ? c.ember : e.impact < 0 ? c.b1 : c.dim} style={{ width: 32 }} align="right">
                  {signed(e.impact)}
                </T>
              </Pressable>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
