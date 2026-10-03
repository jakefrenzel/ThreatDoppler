import { Alert } from 'react-native';

import { usePrefs } from '@/state/store';

/**
 * Starts setup for a channel that isn't connected. Email and Slack delivery need the
 * ThreatDoppler backend, which doesn't exist yet, so this connects a sample destination.
 */
export function setUpChannel(channel: 'email' | 'slack', onDone?: () => void) {
  const name = channel === 'email' ? 'Email' : 'Slack';
  Alert.alert(
    `Connect ${name}`,
    `${name} alerts need the ThreatDoppler service, which isn't live yet. Connect a sample ${channel === 'email' ? 'address' : 'channel'} for now?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Connect',
        onPress: () => {
          usePrefs.getState().connectChannel(channel, channel === 'email' ? '1 address' : '#soc-alerts');
          onDone?.();
        },
      },
    ],
  );
}
