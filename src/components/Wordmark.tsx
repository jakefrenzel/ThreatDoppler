import { Text } from 'react-native';

import { useColors } from '@/theme/ColorsProvider';
import { fonts } from '@/theme/tokens';

/** "Threat" 400 in mute + "Doppler" 600 in ink, one word, −.03em. */
export function Wordmark({ size }: { size: number }) {
  const c = useColors();
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="ThreatDoppler"
      style={{ fontSize: size, letterSpacing: -0.03 * size }}
    >
      <Text style={{ fontFamily: fonts.sans[400], color: c.mute }}>Threat</Text>
      <Text style={{ fontFamily: fonts.sans[600], color: c.ink }}>Doppler</Text>
    </Text>
  );
}
