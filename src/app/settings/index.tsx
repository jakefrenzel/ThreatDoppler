import { router } from 'expo-router';
import { View } from 'react-native';

import { Segmented, ToggleRow } from '@/components/controls';
import { Group, GroupLabel, NavRow, SettingsPage } from '@/components/settings';
import { Mono, T } from '@/components/T';
import { wordingOptions } from '@/copy/wording';
import { regionNames, roleName, sectorNames } from '@/data/catalog';
import { useSnapshot } from '@/data/SnapshotProvider';
import { enablePush, systemName, usePushPermission } from '@/lib/notifications';
import { usePrefs } from '@/state/store';
import { useColors } from '@/theme/ColorsProvider';

/** "Finance, Health" or, past two, "Finance, Health +2". */
const listOrNone = (names: string[], none: string) =>
  !names.length ? none : names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');

/** 11 Settings */
export default function Settings() {
  const c = useColors();
  const prefs = usePrefs();
  const { data } = useSnapshot();
  const { permission, setPermission } = usePushPermission();
  const pushOn = prefs.pushEnabled && permission === 'granted';

  // The switch mirrors the iOS permission: turning it on asks iOS, or opens Settings if iOS already said no.
  const setPush = async (on: boolean) => {
    if (!on) {
      prefs.set('pushEnabled', false);
      return;
    }
    const next = permission === 'granted' ? permission : await enablePush(permission);
    setPermission(next);
    prefs.set('pushEnabled', true);
  };

  const wordingName = wordingOptions.find((o) => o.value === prefs.wording)!.label;

  return (
    <SettingsPage
      eyebrow={`${roleName(prefs.role).toUpperCase()} · ${wordingName.toUpperCase()} WORDING`}
      title="Settings"
      footer={
        <Mono size={10} tracking={0.05} color={c.dim} align="center" style={{ marginTop: 'auto', paddingTop: 16 }}>
          {`THREATDOPPLER 1.0 · MODEL ${data?.model ?? '3.2'}`}
        </Mono>
      }
    >
      <GroupLabel>PROFILE</GroupLabel>
      <Group>
        <NavRow first label="Role" value={roleName(prefs.role)} onPress={() => router.push('/settings/role')} />
        {/* Applies immediately; only labels and descriptions change. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, minHeight: 52, paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.line }}>
          <T size={14} weight={500} style={{ flex: 1 }}>
            Wording
          </T>
          <Segmented label="Wording" variant="medium" stretch={false} options={wordingOptions} value={prefs.wording} onChange={(v) => prefs.set('wording', v)} />
        </View>
      </Group>

      <GroupLabel>SCOPE</GroupLabel>
      <Group>
        <NavRow first label="Sectors" value={listOrNone(prefs.sectors.map((s) => sectorNames[s]), 'None')} onPress={() => router.push('/settings/sectors')} />
        <NavRow label="Regions" value={listOrNone(prefs.regions.map((r) => regionNames[r].medium), 'All')} onPress={() => router.push('/settings/regions')} />
        <ToggleRow label="Show my index" labelWeight={500} sub="NEXT TO THE GLOBAL INDEX ON NOW" value={prefs.showMyIndex} onChange={(v) => prefs.set('showMyIndex', v)} />
      </Group>

      <GroupLabel>NOTIFICATIONS</GroupLabel>
      <Group>
        <ToggleRow
          first
          label="Push notifications"
          labelWeight={500}
          sub={permission === 'denied' ? `BLOCKED IN ${systemName.toUpperCase()} SETTINGS` : undefined}
          value={pushOn}
          onChange={setPush}
        />
        <NavRow label="Alert rules" value={String(prefs.rules.length)} onPress={() => router.dismissTo('/alerts')} />
        <NavRow
          label="Quiet hours"
          value={prefs.quietHours.enabled ? `${prefs.quietHours.start}–${prefs.quietHours.end}` : 'Off'}
          onPress={() => router.push('/settings/quiet-hours')}
        />
      </Group>

      <GroupLabel>ABOUT</GroupLabel>
      <Group>
        <NavRow first label="How the index works" onPress={() => router.push('/settings/about-index')} />
        <NavRow label="Data sources and method" onPress={() => router.push('/settings/about-data')} />
        <NavRow label="Redo setup" onPress={() => router.push('/onboarding/role?redo=1')} />
      </Group>
    </SettingsPage>
  );
}
