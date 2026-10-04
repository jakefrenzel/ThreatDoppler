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
  const statusRef = useRef<SnapshotStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Calls made while a load is running (Retry, pull to refresh, reconnecting) share it.
  const inFlight = useRef<Promise<void> | null>(null);
  const load = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
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
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
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

    // Go offline when the connection drops, and fetch again as soon as it comes back.
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === false) {
        statusRef.current = 'offline';
        setStatus('offline');
      } else if (state.isConnected && statusRef.current === 'offline') load();
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
