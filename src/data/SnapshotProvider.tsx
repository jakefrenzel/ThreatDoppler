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

/** How long a failed retry shows as busy at least. */
const MIN_RETRY_MS = 600;

interface SnapshotContextValue {
  data: Snapshot | null;
  status: SnapshotStatus;
  /** True once the first fetch (or cache read) has settled, whatever the outcome. */
  settled: boolean;
  refresh: () => Promise<void>;
  /** A retry is running after a failure; status stays offline or error meanwhile. */
  retrying: boolean;
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

  // A retry after a failure keeps the offline/error status (so banners and dimmed content stay
  // put) and only sets this, until it succeeds or fails again.
  const [retrying, setRetrying] = useState(false);

  // Calls made while a load is running (Retry, pull to refresh, reconnecting) share it.
  const inFlight = useRef<Promise<void> | null>(null);
  const load = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      const retry = statusRef.current === 'offline' || statusRef.current === 'error';
      const started = Date.now();
      if (retry) setRetrying(true);
      else setStatus(dataRef.current ? 'refreshing' : 'loading');
      try {
        const net = await NetInfo.fetch();
        if (net.isConnected === false) throw new Error('offline');
        const next = await fetchSnapshot();
        setData(next);
        setStatus('ready');
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
      } catch (e) {
        // A retry that fails at once still shows as busy briefly, so Retry visibly did something.
        if (retry) await new Promise((r) => setTimeout(r, Math.max(0, MIN_RETRY_MS - (Date.now() - started))));
        setStatus(e instanceof SnapshotError && e.kind === 'service' ? 'error' : 'offline');
      } finally {
        setRetrying(false);
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

  const value = useMemo(() => ({ data, status, settled, refresh: load, retrying }), [data, status, settled, load, retrying]);
  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
}

export function useSnapshot() {
  const ctx = useContext(SnapshotContext);
  if (!ctx) throw new Error('useSnapshot must be used inside SnapshotProvider');
  return ctx;
}
