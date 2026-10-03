import { View } from 'react-native';

import { roles, regionNames, regionOrder, sectorNames } from '@/data/catalog';
import type { AreaScore, SectorId } from '@/data/types';
import { useTextSize } from '@/lib/a11y';
import { usePrefs } from '@/state/store';
import { useColors } from '@/theme/ColorsProvider';
import { Pill, SelectableRow } from './controls';
import { Mono } from './T';

/** Two-column grid that drops to one column at accessibility text sizes. */
function Grid({ children }: { children: React.ReactNode[] }) {
  const { accessibility } = useTextSize();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16 }}>
      {children.map((child, i) => (
        <View key={i} style={{ width: accessibility ? '100%' : '48.9%', flexGrow: 1 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function RolePicker() {
  const role = usePrefs((s) => s.role);
  const set = usePrefs((s) => s.set);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Role">
      <Grid>
        {roles.map((r) => (
          <SelectableRow key={r.id} label={r.name} selected={role === r.id} onPress={() => set('role', r.id)} />
        ))}
      </Grid>
    </View>
  );
}

/** Ten sectors with today's score, multi-select. */
export function SectorPicker({ sectors }: { sectors: Pick<AreaScore<SectorId>, 'id' | 'score'>[] }) {
  const c = useColors();
  const picked = usePrefs((s) => s.sectors);
  const toggle = usePrefs((s) => s.toggleSector);
  return (
    <Grid>
      {sectors.map((s) => {
        const on = picked.includes(s.id);
        return (
          <SelectableRow
            key={s.id}
            multi
            label={sectorNames[s.id]}
            selected={on}
            onPress={() => toggle(s.id)}
            trailing={
              Number.isFinite(s.score) ? (
                <Mono size={11} tracking={0} color={on ? c.ink : c.mute}>
                  {String(s.score)}
                </Mono>
              ) : undefined
            }
          />
        );
      })}
    </Grid>
  );
}

export function RegionPicker() {
  const picked = usePrefs((s) => s.regions);
  const toggle = usePrefs((s) => s.toggleRegion);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16 }}>
      {regionOrder.map((id) => (
        <Pill key={id} label={regionNames[id].full} selected={picked.includes(id)} onPress={() => toggle(id)} />
      ))}
    </View>
  );
}
