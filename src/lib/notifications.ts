import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';

export type PushPermission = 'granted' | 'denied' | 'undetermined';

/** The OS that owns the permission, for copy like "Blocked in iOS". Push isn't offered on web. */
export const systemName = Platform.OS === 'android' ? 'Android' : 'iOS';

async function readPermission(): Promise<PushPermission> {
  if (Platform.OS === 'web') return 'undetermined';
  try {
    const res = await Notifications.getPermissionsAsync();
    if (res.granted || res.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
    return res.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}

/** Only ever called from an explicit user action (02b, the Alerts banner or Settings), never on launch. */
export async function requestPushPermission(): Promise<PushPermission> {
  if (Platform.OS === 'web') return 'undetermined';
  try {
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return res.granted ? 'granted' : res.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}

/** Turn on: ask if iOS still lets us, otherwise open the app's page in iOS Settings. */
export async function enablePush(current: PushPermission): Promise<PushPermission> {
  if (current === 'undetermined') {
    const next = await requestPushPermission();
    if (next !== 'undetermined') return next;
  }
  await Linking.openSettings().catch(() => {});
  return current;
}

/** The OS permission, re-read whenever the app comes back to the foreground. */
export function usePushPermission() {
  const [permission, setPermission] = useState<PushPermission>('undetermined');
  const refresh = useCallback(() => {
    readPermission().then(setPermission);
  }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  return { permission, setPermission, refresh };
}
