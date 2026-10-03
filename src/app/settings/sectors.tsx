import { SectionLabel } from '@/components/layout';
import { SectorPicker } from '@/components/pickers';
import { SettingsPage } from '@/components/settings';
import { sectorOrder } from '@/data/catalog';
import { useSnapshot } from '@/data/SnapshotProvider';
import { usePrefs } from '@/state/store';

/** Sector picker from 02. */
export default function SectorsSetting() {
  const { data } = useSnapshot();
  const count = usePrefs((s) => s.sectors.length);
  return (
    <SettingsPage eyebrow="SCOPE" title="Sectors">
      <SectionLabel left="SECTORS" right={`${count} OF 10${data ? ' · TODAY' : ''}`} style={{ paddingTop: 8 }} />
      <SectorPicker sectors={data?.sectors ?? sectorOrder.map((id) => ({ id, score: NaN }))} />
    </SettingsPage>
  );
}
