import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AlertsStep from '@/app/onboarding/alerts';
import NotificationsStep from '@/app/onboarding/notifications';
import RoleStep from '@/app/onboarding/role';
import { defaultPrefs, usePrefs } from '@/state/store';

// Step 4 only reads the snapshot for its lock-screen previews; none are needed here.
jest.mock('@/data/SnapshotProvider', () => ({
  useSnapshot: () => ({ data: null, status: 'loading', settled: false, refresh: async () => {} }),
}));

describe('onboarding quiet hours', () => {
  beforeEach(() => {
    usePrefs.setState({ ...defaultPrefs, quietHours: { enabled: true, start: '23:00', end: '07:00' } });
  });

  it('step 3 shows the quiet hours picked in Settings', async () => {
    await renderRouter({ 'onboarding/alerts': AlertsStep }, { initialUrl: '/onboarding/alerts' });
    expect(screen.getByText('23:00–07:00 · SEVERE STILL COMES THROUGH')).toBeTruthy();
    expect(screen.queryByText(/22:00/)).toBeNull();
  });

  it('step 4 summary uses the same hours', async () => {
    await renderRouter({ 'onboarding/notifications': NotificationsStep }, { initialUrl: '/onboarding/notifications' });
    expect(screen.getByText('Silent 23:00–07:00, except Severe')).toBeTruthy();
  });
});

describe('onboarding navigation', () => {
  const steps = { 'onboarding/role': RoleStep, 'onboarding/scope': () => null };

  // renderRouter attaches its helpers to the promise RNTL 14's async render returns, so keep
  // the promise and await it separately.
  it('Redo setup carries redo=1 to the next step', async () => {
    const router = renderRouter(steps, { initialUrl: '/onboarding/role?redo=1' });
    await router;
    await fireEvent.press(screen.getByText('Continue'));
    expect(router.getPathname()).toBe('/onboarding/scope');
    expect(router.getSearchParams()).toEqual({ redo: '1' });
  });

  it('first-run setup moves on without it', async () => {
    const router = renderRouter(steps, { initialUrl: '/onboarding/role' });
    await router;
    await fireEvent.press(screen.getByText('Continue'));
    expect(router.getPathname()).toBe('/onboarding/scope');
    expect(router.getSearchParams()).toEqual({});
  });
});
