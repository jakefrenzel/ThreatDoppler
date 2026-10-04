import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderRouter, screen } from 'expo-router/testing-library';

import AlertsStep from '@/app/onboarding/alerts';
import NotificationsStep from '@/app/onboarding/notifications';
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
