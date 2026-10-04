import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { fetchSnapshot } from '@/data/api';
import { sampleSnapshot } from '@/data/sample';
import { SnapshotProvider, useSnapshot } from '@/data/SnapshotProvider';

type NetState = { isConnected: boolean };

// A NetInfo we can unplug: `connected` is what fetch() reports, emit() fires a change event.
const mockNet = {
  connected: true,
  listeners: new Set<(state: NetState) => void>(),
};

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: () => Promise.resolve({ isConnected: mockNet.connected }),
    addEventListener: (listener: (state: NetState) => void) => {
      mockNet.listeners.add(listener);
      return () => mockNet.listeners.delete(listener);
    },
  },
}));

jest.mock('@/data/api', () => ({ fetchSnapshot: jest.fn() }));

function setConnected(isConnected: boolean) {
  mockNet.connected = isConnected;
  mockNet.listeners.forEach((listener) => listener({ isConnected }));
}

function Status() {
  return <Text>{useSnapshot().status}</Text>;
}

const renderProvider = () =>
  render(
    <SnapshotProvider>
      <Status />
    </SnapshotProvider>,
  );

describe('SnapshotProvider', () => {
  beforeEach(async () => {
    mockNet.connected = true;
    jest.mocked(fetchSnapshot).mockReset().mockResolvedValue(sampleSnapshot);
    await AsyncStorage.clear();
  });

  it('fetches again when the connection comes back', async () => {
    mockNet.connected = false;
    await renderProvider();
    await screen.findByText('offline');
    expect(fetchSnapshot).not.toHaveBeenCalled();

    await act(() => setConnected(true));
    await screen.findByText('ready');
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('goes offline when the connection drops, then recovers', async () => {
    await renderProvider();
    await screen.findByText('ready');

    await act(() => setConnected(false));
    await screen.findByText('offline');

    await act(() => setConnected(true));
    await screen.findByText('ready');
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });

  it('shares one fetch between overlapping reloads', async () => {
    mockNet.connected = false;
    await renderProvider();
    await screen.findByText('offline');

    await act(() => {
      setConnected(true);
      setConnected(true);
      setConnected(true);
    });
    await screen.findByText('ready');
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('does not refetch on connection events while already online', async () => {
    await renderProvider();
    await screen.findByText('ready');

    await act(() => setConnected(true));
    await screen.findByText('ready');
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });
});
