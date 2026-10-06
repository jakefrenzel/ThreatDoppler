import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { EmberPill, ToggleRow } from '@/components/controls';
import { Tile } from '@/components/data';
import { HeatSlider } from '@/components/HeatSlider';
import { Card, CardHeader, Header } from '@/components/layout';
import { Screen } from '@/components/Screen';
import { Banner } from '@/components/states';
import { Mono, T } from '@/components/T';
import { useCopy } from '@/copy/wording';
import { useSnapshot } from '@/data/SnapshotProvider';
import { ruleLabel, ruleSub } from '@/lib/alerts';
import { setUpChannel } from '@/lib/channels';
import { enablePush, systemName, usePushPermission } from '@/lib/notifications';
import { useDeliveries } from '@/lib/useDeliveries';
import { usePrefs } from '@/state/store';
import { useColors } from '@/theme/ColorsProvider';
import { bandFor } from '@/theme/tokens';

/** 07 Alerts, with 13c Notifications off. */
export default function Alerts() {
  const c = useColors();
  const copy = useCopy();
  const { data } = useSnapshot();
  const prefs = usePrefs();
  const { permission, setPermission } = usePushPermission();
  const deliveries = useDeliveries(data, prefs.pushToken);

  const pushOn = prefs.pushEnabled && permission === 'granted';
  const now = data ? Math.round(data.index.value) : null;
  const band = bandFor(prefs.globalThreshold);

  const turnOnPush = async () => {
    const next = permission === 'granted' ? permission : await enablePush(permission);
    setPermission(next);
    prefs.set('pushEnabled', true);
  };

  const pushSub = permission === 'denied' ? `Blocked in ${systemName}` : permission === 'undetermined' ? 'Not allowed yet' : prefs.pushEnabled ? 'This phone' : 'Turned off';

  return (
    <Screen tabBar>
      <Header
        eyebrow={`NOTIFICATIONS · ${prefs.rules.length} RULES`}
        title="Alerts"
        right={<EmberPill icon="plus" label="New rule" onPress={() => router.push('/new-rule')} />}
      />
      {!pushOn && (
        <Banner
          tone="ember"
          icon="bellOff"
          title="Notifications are off"
          body={`Your ${prefs.rules.length} rules are saved, but alerts won't reach this phone.`}
          announce="Notifications are off. Your rules are saved, but alerts won't reach this phone."
          action={<EmberPill label="Turn on" onPress={turnOnPush} />}
        />
      )}
      <Card padding={[12, 16]}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Mono size={10} tracking={0} color={c.mute} style={{ marginRight: 'auto' }}>
            {copy.L.threshold}
          </Mono>
          <T size={34} weight={600} tracking={-0.03} leading={1}>
            {String(prefs.globalThreshold)}
          </T>
          <T size={14} weight={600} color={band.color}>
            {band.name}
          </T>
        </View>
        <View style={{ marginTop: 14 }}>
          <HeatSlider
            label="Global threshold"
            value={prefs.globalThreshold}
            valueText={`${prefs.globalThreshold}, ${band.name}`}
            onChange={prefs.setThreshold}
            marker={now ?? undefined}
            markerLabel={now !== null ? `NOW ${now}` : undefined}
          />
        </View>
      </Card>
      <Card padding={[2, 14]}>
        {prefs.rules.map((r, i) => (
          <ToggleRow key={r.id} first={i === 0} label={ruleLabel(r, copy)} sub={ruleSub(r)} value={r.enabled} onChange={() => prefs.toggleRule(r.id)} />
        ))}
      </Card>
      <View style={{ flexDirection: 'row', gap: 6, marginHorizontal: 14 }}>
        <Pressable style={{ flex: 1 }} onPress={pushOn ? undefined : turnOnPush} accessibilityRole="button" accessibilityLabel={`Push, ${pushOn ? 'on' : 'off'}, ${pushSub}`}>
          <Tile highlight={pushOn} label="PUSH" value={pushOn ? 'On' : 'Off'} valueSize={14} valueColor={pushOn ? undefined : c.mute} sub={pushSub} pad={[9, 11]} />
        </Pressable>
        {(['email', 'slack'] as const).map((ch) => {
          const state = prefs.channels[ch];
          const label = ch === 'email' ? 'EMAIL' : 'SLACK';
          const value = state.connected ? (ch === 'slack' ? state.detail : 'On') : 'Off';
          const sub = state.connected ? (ch === 'slack' ? 'Connected' : state.detail) : 'Coming later';
          return (
            <Pressable
              key={ch}
              style={{ flex: 1 }}
              onPress={state.connected ? undefined : () => setUpChannel(ch)}
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${value}, ${sub}`}
            >
              <Tile highlight={state.connected} label={label} value={value} valueSize={14} valueColor={state.connected ? undefined : c.mute} sub={sub} pad={[9, 11]} />
            </Pressable>
          );
        })}
      </View>
      {/* This device's pushes from the last week; hidden until there are some. */}
      {deliveries.length > 0 && (
        <Card padding={[10, 14]} style={{ gap: 6 }}>
          <CardHeader
            left="RECENT DELIVERIES"
            right={prefs.quietHours.enabled ? `QUIET ${prefs.quietHours.start}–${prefs.quietHours.end}` : 'QUIET HOURS OFF'}
          />
          {deliveries.map((d) => (
            <View key={d.key} style={{ flexDirection: 'row', gap: 8 }}>
              <T mono size={12} color={c.mute} style={{ width: 38 }}>
                {d.time}
              </T>
              <T size={12} style={{ flex: 1 }}>
                {copy.label(d.label)}
              </T>
              <Mono size={10} tracking={0} color={c.mute}>
                {d.channels}
              </Mono>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
