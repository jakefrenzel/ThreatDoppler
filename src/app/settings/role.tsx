import { RolePicker } from '@/components/pickers';
import { SettingsPage } from '@/components/settings';
import { T } from '@/components/T';
import { useColors } from '@/theme/ColorsProvider';

/** Role list from 01. Role never changes the data or the wording level. */
export default function RoleSetting() {
  const c = useColors();
  return (
    <SettingsPage eyebrow="PROFILE" title="Role">
      <T size={14} leading={1.45} color={c.mute} style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        Your role helps us understand who uses ThreatDoppler. Everyone sees the same data and screens.
      </T>
      <RolePicker />
    </SettingsPage>
  );
}
