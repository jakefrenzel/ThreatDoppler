import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { usePushPermission } from '@/lib/notifications';
import { getPushToken, notificationTarget, pushAvailable, registerDevice, registration, unregisterDevice } from '@/lib/push';
import { usePrefs, usePrefsHydrated } from '@/state/store';

// Alerts that arrive while the app is open still show as a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

if (Platform.OS === 'android') {
  // send-alerts targets this channel.
  Notifications.setNotificationChannelAsync('alerts', {
    name: 'Alerts',
    importance: Notifications.AndroidImportance.HIGH,
  }).catch(() => {});
}

/** Waits this long after a change before syncing, so a run of edits is one request. */
const SYNC_DELAY_MS = 1500;

/**
 * Keeps this device's registration with the backend in step with the app: registers when push is
 * on and allowed, re-syncs when rules, quiet hours or wording change (and on launch, which also marks
 * the device as still in use), and unregisters when push is turned off. Also opens the right screen
 * when a notification is tapped. Renders nothing.
 */
export function PushSync() {
  const hydrated = usePrefsHydrated();
  const onboarded = usePrefs((s) => s.onboarded);
  const pushEnabled = usePrefs((s) => s.pushEnabled);
  const pushToken = usePrefs((s) => s.pushToken);
  const rules = usePrefs((s) => s.rules);
  const quietHours = usePrefs((s) => s.quietHours);
  const wording = usePrefs((s) => s.wording);
  const set = usePrefs((s) => s.set);
  const { permission } = usePushPermission();

  const wanted = hydrated && onboarded && pushEnabled && permission === 'granted' && pushAvailable;
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (wanted) {
          const token = pushToken ?? (await getPushToken());
          if (!token || cancelled) return;
          const payload = registration(token, { rules, quietHours, wording });
          const key = JSON.stringify(payload);
          if (key === lastSent.current) return;
          await registerDevice(payload);
          lastSent.current = key;
          if (token !== pushToken) set('pushToken', token);
        } else if (pushToken && (!pushEnabled || permission === 'denied')) {
          // Turned off in the app or blocked in the OS: stop sending to this device.
          await unregisterDevice(pushToken);
          lastSent.current = null;
          set('pushToken', null);
        }
      } catch {
        // Offline or the service is down: the next change or launch tries again.
      }
    }, SYNC_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hydrated, wanted, pushEnabled, permission, pushToken, rules, quietHours, wording, set]);

  // A tapped notification opens what it's about (an event, Breakdown, Alerts or Now).
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const target = notificationTarget(response.notification.request.content.data);
    if (target) router.push(target as Parameters<typeof router.push>[0]);
  }, [response]);

  return null;
}
