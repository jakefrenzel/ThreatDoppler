import { View } from 'react-native';

import { SelectableRow, ToggleRow } from '@/components/controls';
import { SectionLabel } from '@/components/layout';
import { Group, SettingsPage } from '@/components/settings';
import { usePrefs } from '@/state/store';

const presets: [string, string][] = [
  ['22:00', '06:30'],
  ['23:00', '07:00'],
  ['21:00', '06:00'],
  ['00:00', '08:00'],
];

/** Quiet hours: alerts are held overnight, except Severe. */
export default function QuietHoursSetting() {
  const quiet = usePrefs((s) => s.quietHours);
  const set = usePrefs((s) => s.set);
  return (
    <SettingsPage eyebrow="NOTIFICATIONS" title="Quiet hours">
      <Group>
        <ToggleRow
          first
          label="Quiet hours"
          labelWeight={500}
          sub="SEVERE STILL COMES THROUGH"
          value={quiet.enabled}
          onChange={(enabled) => set('quietHours', { ...quiet, enabled })}
        />
      </Group>
      {quiet.enabled && (
        <>
          <SectionLabel left="SILENT BETWEEN" right="LOCAL TIME" style={{ paddingTop: 10 }} />
          <View accessibilityRole="radiogroup" style={{ gap: 6, paddingHorizontal: 16 }}>
            {presets.map(([start, end]) => (
              <SelectableRow
                key={start}
                label={`${start}–${end}`}
                selected={quiet.start === start && quiet.end === end}
                onPress={() => set('quietHours', { enabled: true, start, end })}
              />
            ))}
          </View>
        </>
      )}
    </SettingsPage>
  );
}
