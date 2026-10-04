import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { dataSource, fetchSnapshot } from './api';
import { SnapshotError } from './live';
import type { Snapshot } from './types';
import { isSnapshot } from './validate';

// Per source, so sample data cached in development is never shown as live (and vice versa).
const CACHE_KEY = `td.snapshot.v2.${dataSource()}`;

/** offline: no connection. error: connected, but the service failed or sent data this build can't use. */
export type SnapshotStatus = 'loading' | 'ready' | 'refreshing' | 'offline' | 'error';

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
      } catch (e) {
        setStatus(e instanceof SnapshotError && e.kind === 'service' ? 'error' : 'offline');
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
        if (cancelled || !raw || dataRef.current) return;
        // A cache from an older build, or a damaged one, is dropped rather than shown.
        const cached: unknown = JSON.parse(raw);
        if (isSnapshot(cached)) setData(cached);
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
