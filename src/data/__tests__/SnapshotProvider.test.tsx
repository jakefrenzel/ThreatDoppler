import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { fetchSnapshot } from '@/data/api';
import { SnapshotError } from '@/data/live';
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

jest.mock('@/data/api', () => ({ fetchSnapshot: jest.fn(), dataSource: () => 'live' }));

const CACHE_KEY = 'td.snapshot.v2.live';

function setConnected(isConnected: boolean) {
  mockNet.connected = isConnected;
  mockNet.listeners.forEach((listener) => listener({ isConnected }));
}

function Status() {
  const { status, data } = useSnapshot();
  return <Text>{`${status} ${data?.model ?? 'none'}`}</Text>;
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
    await screen.findByText(/^offline/);
    expect(fetchSnapshot).not.toHaveBeenCalled();

    await act(() => setConnected(true));
    await screen.findByText(/^ready/);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('goes offline when the connection drops, then recovers', async () => {
    await renderProvider();
    await screen.findByText(/^ready/);

    await act(() => setConnected(false));
    await screen.findByText(/^offline/);

    await act(() => setConnected(true));
    await screen.findByText(/^ready/);
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });

  it('shares one fetch between overlapping reloads', async () => {
    mockNet.connected = false;
    await renderProvider();
    await screen.findByText(/^offline/);

    await act(() => {
      setConnected(true);
      setConnected(true);
      setConnected(true);
    });
    await screen.findByText(/^ready/);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('does not refetch on connection events while already online', async () => {
    await renderProvider();
    await screen.findByText(/^ready/);

    await act(() => setConnected(true));
    await screen.findByText(/^ready/);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('tells a service problem apart from being offline, and keeps saved data', async () => {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(sampleSnapshot));
    jest.mocked(fetchSnapshot).mockRejectedValue(new SnapshotError('service', 'Snapshot request failed with 503'));
    await renderProvider();
    await screen.findByText(`error ${sampleSnapshot.model}`);
  });

  it('treats a network failure as offline', async () => {
    jest.mocked(fetchSnapshot).mockRejectedValue(new SnapshotError('offline', 'Network request failed'));
    await renderProvider();
    await screen.findByText('offline none');
  });

  it('keeps the offline state through a retry that fails, so nothing on screen moves', async () => {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(sampleSnapshot));
    jest.mocked(fetchSnapshot).mockRejectedValue(new SnapshotError('offline', 'Network request failed'));
    const seen: string[] = [];
    const handle = { refresh: async () => {} };
    function Recorder() {
      const ctx = useSnapshot();
      useEffect(() => {
        handle.refresh = ctx.refresh;
      });
      seen.push(`${ctx.status}${ctx.retrying ? '+retrying' : ''}`);
      return null;
    }
    await render(
      <SnapshotProvider>
        <Recorder />
      </SnapshotProvider>,
    );
    await waitFor(() => expect(seen.at(-1)).toBe('offline'));
    seen.length = 0;

    let retry: Promise<void> = Promise.resolve();
    await act(() => {
      retry = handle.refresh();
    });
    await waitFor(() => expect(seen).toContain('offline+retrying'));
    await act(() => retry);
    await waitFor(() => expect(seen.at(-1)).toBe('offline'));
    expect(seen.every((s) => s.startsWith('offline'))).toBe(true);

    jest.mocked(fetchSnapshot).mockResolvedValue(sampleSnapshot);
    await act(() => handle.refresh());
    expect(seen.at(-1)).toBe('ready');
  });

  it('ignores a saved snapshot that fails the shape check', async () => {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ...sampleSnapshot, vectors: null, model: 'old' }));
    jest.mocked(fetchSnapshot).mockRejectedValue(new SnapshotError('offline', 'Network request failed'));
    await renderProvider();
    await screen.findByText('offline none');
  });
});
