import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { AlertRule, QuietHours } from '@/state/store';
import type { Wording } from '@/data/types';

// Push alerts (milestone 2, docs/push-plan.md): this device's Expo push token, registered with the
// backend along with its alert rules. The backend decides when to send.

/** The EAS project id, written into app.json by `eas init`. Without it there's no push token. */
export const pushProjectId: string | undefined =
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;

/** Push alerts need a native platform, an EAS project and the live backend. */
export const pushAvailable =
  Platform.OS !== 'web' &&
  !!pushProjectId &&
  !!process.env.EXPO_PUBLIC_SUPABASE_URL &&
  !!process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Gets the Expo push token. It asks Expo's servers, so it's retried a few times. */
export async function getPushToken(): Promise<string | null> {
  if (!pushAvailable) return null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return (await Notifications.getExpoPushTokenAsync({ projectId: pushProjectId })).data;
    } catch {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  return null;
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')}/rest/v1/rpc/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name} failed with ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export interface DeviceSettings {
  rules: AlertRule[];
  quietHours: QuietHours;
  wording: Wording;
}

/** What gets registered; also used to tell whether anything changed since the last sync. */
export function registration(token: string, s: DeviceSettings) {
  return {
    p_token: token,
    p_platform: Platform.OS === 'android' ? 'android' : 'ios',
    p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    p_wording: s.wording,
    p_quiet_hours: { enabled: s.quietHours.enabled, start: s.quietHours.start, end: s.quietHours.end },
    p_rules: s.rules.map(({ id, kind, condition, targets, value, channels, enabled }) => ({
      id,
      kind,
      condition,
      targets,
      value,
      channels,
      enabled,
    })),
  };
}

export const registerDevice = (payload: ReturnType<typeof registration>) => rpc<void>('register_device', payload);
export const unregisterDevice = (token: string) => rpc<void>('unregister_device', { p_token: token });

export interface DeviceDelivery {
  at: string;
  kind: 'alert' | 'morning' | 'held' | 'bundle' | 'test';
  title: string;
  body: string;
  status: 'held' | 'queued' | 'sent' | 'delivered' | 'failed';
}

/** This device's deliveries from the last week, newest first. */
export const fetchDeliveries = (token: string) => rpc<DeviceDelivery[]>('get_deliveries', { p_token: token });

/** Where a tapped notification should open, from the data send-alerts attaches. */
export function notificationTarget(data: unknown): { pathname: string; params?: Record<string, string> } | null {
  if (!data || typeof data !== 'object') return null;
  const { path, params } = data as { path?: unknown; params?: unknown };
  // Only the app's own routes.
  if (typeof path !== 'string' || !/^\/(alerts|now\/breakdown|threat\/[\w.-]+)?$/.test(path)) return null;
  const safe =
    params && typeof params === 'object'
      ? Object.fromEntries(Object.entries(params).filter(([, v]) => typeof v === 'string')) as Record<string, string>
      : undefined;
  return { pathname: path, params: safe };
}
