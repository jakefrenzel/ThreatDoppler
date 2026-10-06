import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmberPill, Pill, Segmented } from '@/components/controls';
import { Glow, glows } from '@/components/Glow';
import { HeatSlider } from '@/components/HeatSlider';
import { Icon } from '@/components/Icon';
import { Card, CardHeader } from '@/components/layout';
import { Mono, T } from '@/components/T';
import { regionNames, regionOrder, sectorNames, sectorOrder, vectorNames, vectorOrder } from '@/data/catalog';
import { useSnapshot } from '@/data/SnapshotProvider';
import { backtest, backtestSeries } from '@/lib/alerts';
import { setUpChannel } from '@/lib/channels';
import { success } from '@/lib/haptics';
import { systemName, usePushPermission } from '@/lib/notifications';
import { usePrefs, type AlertRule, type Channel } from '@/state/store';
import { useColors } from '@/theme/ColorsProvider';
import { bandFor, palette } from '@/theme/tokens';

type Kind = 'index' | 'sector' | 'region' | 'vector';
type Condition = 'above' | 'jump';

const kinds: { value: Kind; label: string }[] = [
  { value: 'index', label: 'Index' },
  { value: 'sector', label: 'Sector' },
  { value: 'region', label: 'Region' },
  { value: 'vector', label: 'Attack type' },
];

const COLLAPSED = 5;

/** 12 New rule (sheet). Save adds the rule to the top of the list on 07. */
export default function NewRule() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { data } = useSnapshot();
  const prefs = usePrefs();
  const { permission } = usePushPermission();

  const [kind, setKind] = useState<Kind>('sector');
  const [targets, setTargets] = useState<string[]>([]);
  const [condition, setCondition] = useState<Condition>('above');
  const [above, setAbove] = useState(85);
  const [jump, setJump] = useState(5);
  const [channels, setChannels] = useState<Channel[]>(['push']);
  const [expanded, setExpanded] = useState(false);

  // Followed sectors and regions are listed first.
  const options = useMemo(() => {
    if (kind === 'sector') {
      const order = [...prefs.sectors, ...sectorOrder.filter((s) => !prefs.sectors.includes(s))];
      return order.map((id) => ({ id: id as string, name: sectorNames[id] }));
    }
    if (kind === 'region') {
      const order = [...prefs.regions, ...regionOrder.filter((r) => !prefs.regions.includes(r))];
      return order.map((id) => ({ id: id as string, name: regionNames[id].medium }));
    }
    if (kind === 'vector') return vectorOrder.map((id) => ({ id: id as string, name: vectorNames[id] }));
    return [];
  }, [kind, prefs.sectors, prefs.regions]);

  const changeKind = (k: Kind) => {
    setKind(k);
    setTargets([]);
    setExpanded(false);
  };
  const toggleTarget = (id: string) => setTargets((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  const value = condition === 'above' ? above : jump;
  const series = data ? backtestSeries(data, kind, targets) : [];
  const hits = series.length ? Math.max(...series.map((s) => backtest(s, condition, value))) : 0;
  const current = data
    ? kind === 'index'
      ? Math.round(data.index.value)
      : series.length
        ? Math.max(...series.map((s) => Math.round(s[s.length - 1])))
        : null
    : null;

  const kindName = { index: 'GLOBAL INDEX', sector: 'SECTOR', region: 'REGION', vector: 'ATTACK TYPE' }[kind];
  const targetName =
    kind === 'index' || !targets.length
      ? kindName
      : options.find((o) => o.id === targets[0])!.name.toUpperCase() + (targets.length > 1 ? ` +${targets.length - 1}` : '');
  const band = bandFor(above);

  const pushReady = permission !== 'denied';
  const channelInfo: { ch: Channel; label: string; connected: boolean; detail: string }[] = [
    { ch: 'push', label: 'PUSH', connected: pushReady, detail: pushReady ? 'This phone' : `Blocked in ${systemName}` },
    { ch: 'email', label: 'EMAIL', connected: prefs.channels.email.connected, detail: prefs.channels.email.connected ? prefs.channels.email.detail : 'Coming later' },
    { ch: 'slack', label: 'SLACK', connected: prefs.channels.slack.connected, detail: prefs.channels.slack.connected ? prefs.channels.slack.detail : 'Coming later' },
  ];
  const activeChannels = channels.filter((ch) => channelInfo.find((i) => i.ch === ch)!.connected);
  const canSave = (kind === 'index' || targets.length > 0) && activeChannels.length > 0;

  const toggleChannel = (info: (typeof channelInfo)[number]) => {
    if (!info.connected) {
      if (info.ch === 'push') return;
      setUpChannel(info.ch);
      return;
    }
    setChannels((cs) => (cs.includes(info.ch) ? cs.filter((x) => x !== info.ch) : [...cs, info.ch]));
  };

  const save = () => {
    prefs.addRule({ kind, condition, targets: targets as AlertRule['targets'], value, channels: activeChannels, enabled: true });
    success();
    router.back();
  };

  const shown = expanded ? options : options.slice(0, COLLAPSED);
  const hidden = options.length - shown.length;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, borderTopLeftRadius: 34, borderTopRightRadius: 34, overflow: 'hidden' }}>
      <Glow spec={glows.sheetTight} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 24 }}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.dim }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
            <T size={15} color={c.mute}>
              Cancel
            </T>
          </Pressable>
          <T size={17} weight={600} accessibilityRole="header">
            New rule
          </T>
          <EmberPill label="Save" size={14} disabled={!canSave} onPress={save} />
        </View>

        <CardHeader left="ALERT ME ABOUT" style={{ paddingHorizontal: 4 }} />
        <Segmented label="Alert me about" variant="medium" height={32} options={kinds} value={kind} onChange={changeKind} style={{ borderRadius: 19 }} />

        {kind !== 'index' && (
          <>
            <CardHeader
              left={kind === 'sector' ? 'SECTORS' : kind === 'region' ? 'REGIONS' : 'ATTACK TYPES'}
              right={`${targets.length} PICKED`}
              style={{ paddingHorizontal: 4 }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {shown.map((o) => (
                <Pill key={o.id} label={o.name} selected={targets.includes(o.id)} onPress={() => toggleTarget(o.id)} />
              ))}
              {hidden > 0 && <Pill label={`+${hidden} more`} selected={false} onPress={() => setExpanded(true)} />}
            </View>
          </>
        )}

        <CardHeader left="WHEN IT" style={{ paddingHorizontal: 4 }} />
        <Segmented
          label="When it"
          variant="medium"
          height={32}
          options={[
            { value: 'above', label: 'Goes above' },
            { value: 'jump', label: 'Jumps in 1 day' },
          ]}
          value={condition}
          onChange={setCondition}
          style={{ borderRadius: 19 }}
        />

        <Card inset={0} padding={[12, 16]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Mono size={10} tracking={0} color={c.mute} style={{ marginRight: 'auto', flexShrink: 1 }} numberOfLines={1}>
              {`${targetName} ${condition === 'above' ? 'GOES ABOVE' : 'JUMPS BY'}`}
            </Mono>
            <T size={34} weight={600} tracking={-0.03} leading={1}>
              {condition === 'above' ? String(above) : `+${jump}`}
            </T>
            {condition === 'above' && (
              <T size={14} weight={600} color={band.color}>
                {band.name}
              </T>
            )}
          </View>
          <View style={{ marginTop: 14 }}>
            {condition === 'above' ? (
              <HeatSlider
                label="Threshold"
                value={above}
                valueText={`${above}, ${band.name}`}
                onChange={setAbove}
                marker={current ?? undefined}
                markerLabel={current !== null ? `NOW ${current}` : undefined}
              />
            ) : (
              <HeatSlider plain label="Jump size" min={1} max={15} value={jump} valueText={`${jump} points in a day`} onChange={setJump} />
            )}
          </View>
          {series.length > 0 && (
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line }}>
              <T size={12} color={c.mute}>
                {'Would have alerted you '}
                <T size={12} weight={600}>
                  {hits === 1 ? 'once' : `${hits} times`}
                </T>
                {' in the last 30 days.'}
              </T>
            </View>
          )}
        </Card>

        <CardHeader left="SEND TO" style={{ paddingHorizontal: 4 }} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {channelInfo.map((info) => {
            const on = info.connected && channels.includes(info.ch);
            return (
              <Pressable
                key={info.ch}
                onPress={() => toggleChannel(info)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: info.ch === 'push' && !info.connected }}
                accessibilityLabel={`${info.label}, ${info.detail}`}
                accessibilityHint={info.connected || info.ch === 'push' ? undefined : 'Not available yet'}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  paddingHorizontal: 11,
                  borderRadius: 16,
                  backgroundColor: on ? c.emberSoft : c.card,
                  borderWidth: 1,
                  borderColor: on ? palette.emberLine : c.line,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Mono size={9} tracking={0} color={on ? c.ember : c.mute}>
                    {info.label}
                  </Mono>
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? c.ember : 'transparent',
                      borderWidth: on ? 0 : 1.5,
                      borderColor: c.dim,
                    }}
                  >
                    {on && <Icon name="check" size={10} color={palette.onEmber} strokeWidth={3.5} />}
                  </View>
                </View>
                <T size={14} weight={600}>
                  {on ? 'On' : 'Off'}
                </T>
                <T size={11} color={c.mute} numberOfLines={1}>
                  {info.detail}
                </T>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
