import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Card, CardHeader } from '@/components/layout';
import { SettingsPage } from '@/components/settings';
import { Mono, T } from '@/components/T';
import { dataSource } from '@/data/api';
import { useSnapshot } from '@/data/SnapshotProvider';
import { dataSources } from '@/data/sources';
import { ago } from '@/lib/format';
import { useColors } from '@/theme/ColorsProvider';

/** Sources older than this are flagged: their sub-index is left out of the index (see the method). */
const STALE_MS = 2 * 86_400_000;

/** About · Data sources, with the credit each licence asks for. */
export default function AboutData() {
  const c = useColors();
  const { data } = useSnapshot();
  const sample = dataSource() === 'sample';
  // Read once when the screen opens; ages don't need to tick while it's open.
  const [now] = useState(() => Date.now());
  return (
    <SettingsPage eyebrow="ABOUT" title="Data sources">
      {sample && (
        <Card style={{ borderColor: c.emberLine, backgroundColor: c.emberSoft }}>
          <T size={14} weight={600}>
            Sample data
          </T>
          <T size={13} leading={1.4} color={c.body} style={{ marginTop: 2 }}>
            This build shows fictional sample data, not the sources below.
          </T>
        </Card>
      )}
      <T size={14} leading={1.45} color={c.mute} style={{ paddingHorizontal: 20 }}>
        ThreatDoppler combines free public sources. They update hourly or daily; the index uses only complete days.
      </T>
      <Card style={{ gap: 2 }}>
        <CardHeader left="SOURCES" right="LAST UPDATED" style={{ paddingBottom: 4 }} />
        {dataSources.map((s) => {
          const updated = s.id === 'vcdb' ? null : data?.sources?.[s.id];
          const stale = updated ? now - Date.parse(updated) > STALE_MS : false;
          const status = s.id === 'vcdb' ? 'BASELINE' : sample || !updated ? '—' : ago(updated, now);
          return (
            <Pressable
              key={s.id}
              onPress={() => Linking.openURL(s.url)}
              accessibilityRole="link"
              accessibilityLabel={`${s.name}. ${s.what}. ${s.licence}. ${s.id === 'vcdb' ? '' : `Last updated ${status.toLowerCase()}.`} Opens ${s.url}`}
              style={({ pressed }) => ({ gap: 2, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.line, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T size={14} weight={500} style={{ flex: 1 }}>
                  {s.name}
                </T>
                <Mono size={10} tracking={0} color={stale ? c.ember : c.mute}>
                  {stale ? `STALE · ${status}` : status}
                </Mono>
                <Icon name="chevronRight" size={14} color={c.dim} />
              </View>
              <T size={13} leading={1.35} color={c.body}>
                {s.what}
              </T>
              <Mono size={10} tracking={0} color={c.mute}>
                {s.licence}
              </Mono>
            </Pressable>
          );
        })}
      </Card>
    </SettingsPage>
  );
}
