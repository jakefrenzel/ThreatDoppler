import { Alert } from 'react-native';

/** Email and Slack delivery come in milestone 3. Until then, tapping either explains that. */
export function setUpChannel(channel: 'email' | 'slack') {
  const name = channel === 'email' ? 'Email' : 'Slack';
  Alert.alert(`${name} alerts are coming later`, `For now, alerts arrive by push on this phone.`);
}
