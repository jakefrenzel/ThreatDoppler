import { describe, expect, it } from '@jest/globals';

import { notificationTarget, registration } from '@/lib/push';
import { defaultRules } from '@/state/store';

describe('push registration', () => {
  it('sends the rules, quiet hours, wording and time zone, without app-only fields', () => {
    const payload = registration('ExponentPushToken[abc12345]', {
      rules: defaultRules,
      quietHours: { enabled: true, start: '22:00', end: '06:30' },
      wording: 'plain',
    });
    expect(payload.p_token).toBe('ExponentPushToken[abc12345]');
    expect(payload.p_wording).toBe('plain');
    expect(payload.p_quiet_hours).toEqual({ enabled: true, start: '22:00', end: '06:30' });
    expect(typeof payload.p_time_zone).toBe('string');
    expect(payload.p_rules).toHaveLength(defaultRules.length);
    expect(Object.keys(payload.p_rules[0]).sort()).toEqual(['channels', 'condition', 'enabled', 'id', 'kind', 'targets', 'value']);
  });
});

describe('notification taps', () => {
  it('opens the app screens a push can point at', () => {
    expect(notificationTarget({ path: '/' })).toEqual({ pathname: '/' });
    expect(notificationTarget({ path: '/alerts' })).toEqual({ pathname: '/alerts' });
    expect(notificationTarget({ path: '/threat/kev-CVE-2026-88779' })).toEqual({ pathname: '/threat/kev-CVE-2026-88779' });
    expect(notificationTarget({ path: '/now/breakdown', params: { view: 'sectors', bad: 3 } })).toEqual({
      pathname: '/now/breakdown',
      params: { view: 'sectors' },
    });
  });

  it('ignores anything else', () => {
    for (const data of [null, 'x', {}, { path: 5 }, { path: 'https://evil.example' }, { path: '/settings/role' }, { path: '/threat/../x' }]) {
      expect(notificationTarget(data)).toBeNull();
    }
  });
});
