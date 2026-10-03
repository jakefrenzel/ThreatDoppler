import { View } from 'react-native';

import { Card, CardHeader } from '@/components/layout';
import { SettingsPage } from '@/components/settings';
import { Mono, T } from '@/components/T';
import { useColors } from '@/theme/ColorsProvider';

const sources: [string, string][] = [
  ['LEAK MONITOR', 'Ransomware leak-site postings'],
  ['HONEYNET', 'Scanning and exploit attempts seen by sensors'],
  ['CDN TELEMETRY', 'Traffic floods against websites'],
  ['MAIL SENSORS', 'Phishing campaigns'],
  ['REGISTRY ADVISORY', 'Malicious software packages'],
  ['CERT', 'Government security bulletins'],
  ['RESEARCH', 'Published vulnerability research'],
];

/** About · Data sources and method */
export default function AboutData() {
  const c = useColors();
  return (
    <SettingsPage eyebrow="ABOUT" title="Data sources">
      <Card style={{ borderColor: c.emberLine, backgroundColor: c.emberSoft }}>
        <T size={14} weight={600}>
          Sample data
        </T>
        <T size={13} leading={1.4} color={c.body} style={{ marginTop: 2 }}>
          This build shows fictional sample data. Live data arrives when the ThreatDoppler service is connected.
        </T>
      </Card>
      <Card style={{ gap: 2 }}>
        <CardHeader left="SOURCE TYPES" style={{ paddingBottom: 4 }} />
        {sources.map(([code, what]) => (
          <View key={code} style={{ gap: 1, paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.line }}>
            <Mono size={10} color={c.mute}>
              {code}
            </Mono>
            <T size={14}>{what}</T>
          </View>
        ))}
      </Card>
    </SettingsPage>
  );
}
