import { SectionLabel } from '@/components/layout';
import { RegionPicker } from '@/components/pickers';
import { SettingsPage } from '@/components/settings';
import { usePrefs } from '@/state/store';

/** Region picker from 02. */
export default function RegionsSetting() {
  const count = usePrefs((s) => s.regions.length);
  return (
    <SettingsPage eyebrow="SCOPE" title="Regions">
      <SectionLabel left="REGIONS" right={`${count} OF 5`} style={{ paddingTop: 8 }} />
      <RegionPicker />
    </SettingsPage>
  );
}
