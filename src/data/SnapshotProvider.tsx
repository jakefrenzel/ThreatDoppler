import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { fetchSnapshot } from './api';
import type { Snapshot } from './types';

const CACHE_KEY = 'td.snapshot.v1';

export type SnapshotStatus = 'loading' | 'ready' | 'refreshing' | 'offline';

interface SnapshotContextValue {
  data: Snapshot | null;
  status: SnapshotStatus;
  /** True once the first fetch (or cache read) has settled, whatever the outcome. */
  settled: boolean;
  refresh: () => Promise<void>;
}

const SnapshotContext = createContext<SnapshotContextValue | null>(null);

export function SnapshotProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<SnapshotStatus>('loading');
  const [settled, setSettled] = useState(false);
  const dataRef = useRef<Snapshot | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const load = useCallback(async () => {
    setStatus(dataRef.current ? 'refreshing' : 'loading');
    try {
      const net = await NetInfo.fetch();
      if (net.isConnected === false) throw new Error('offline');
      const next = await fetchSnapshot();
      setData(next);
      setStatus('ready');
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
    } catch {
      setStatus('offline');
    } finally {
      setSettled(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Show cached data straight away, then fetch fresh data on top of it.
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (!cancelled && raw && !dataRef.current) setData(JSON.parse(raw) as Snapshot);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) load();
      });

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === false) setStatus('offline');
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [load]);

  const value = useMemo(() => ({ data, status, settled, refresh: load }), [data, status, settled, load]);
  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
}

export function useSnapshot() {
  const ctx = useContext(SnapshotContext);
  if (!ctx) throw new Error('useSnapshot must be used inside SnapshotProvider');
  return ctx;
}
