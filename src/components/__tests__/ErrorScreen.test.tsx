import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { ErrorScreen } from '@/components/ErrorScreen';

let mockShouldThrow = true;

function FlakyThreat() {
  if (mockShouldThrow) throw new Error('bad threat data');
  return <Text>Threat screen</Text>;
}

const routes = {
  // The same wiring as src/app/_layout.tsx: the root layout exports ErrorScreen as its ErrorBoundary.
  _layout: { default: () => <Stack />, ErrorBoundary: ErrorScreen },
  now: () => <Text>Now screen</Text>,
  'threat/[id]': FlakyThreat,
};

describe('ErrorScreen', () => {
  beforeEach(() => {
    mockShouldThrow = true;
    // React logs the caught error; keep the test output readable.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('replaces a screen that throws instead of crashing the app', async () => {
    await renderRouter(routes, { initialUrl: '/threat/x' });
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('Back to Now leaves the broken screen', async () => {
    // renderRouter attaches getPathname to the promise RNTL 14's async render returns, not to
    // what it resolves to, so keep the promise and await it separately.
    const router = renderRouter(routes, { initialUrl: '/threat/x' });
    await router;
    await fireEvent.press(screen.getByText('Back to Now'));
    expect(await screen.findByText('Now screen')).toBeTruthy();
    expect(router.getPathname()).toBe('/now');
  });

  it('Try again re-renders the same screen once it works', async () => {
    const router = renderRouter(routes, { initialUrl: '/threat/x' });
    await router;
    mockShouldThrow = false;
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Threat screen')).toBeTruthy();
    expect(router.getPathname()).toBe('/threat/x');
  });
});
