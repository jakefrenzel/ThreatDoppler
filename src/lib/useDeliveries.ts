import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { dataSource } from '@/data/api';
import type { Snapshot } from '@/data/types';
import { localTime } from './format';
import { fetchDeliveries } from './push';

export interface DeliveryRow {
  key: string;
  time: string;
  label: { technical: string; plain: string };
  channels: string;
}

const statusLabel: Record<string, string> = {
  held: 'HELD',
  queued: 'PUSH',
  sent: 'PUSH',
  delivered: 'PUSH',
  failed: 'FAILED',
};

/**
 * "Recent deliveries" on Alerts: this device's pushes from the last week, refreshed whenever the tab
 * is opened. Sample data keeps its fictional deliveries.
 */
export function useDeliveries(data: Snapshot | null, token: string | null): DeliveryRow[] {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const sample = dataSource() === 'sample';

  useFocusEffect(
    useCallback(() => {
      if (sample || !token) return;
      let cancelled = false;
      fetchDeliveries(token)
        .then((list) => {
          if (cancelled) return;
          setRows(
            list.map((d, i) => ({
              key: `${d.at}-${i}`,
              time: localTime(d.at),
              label: { technical: d.title, plain: d.title },
              channels: statusLabel[d.status] ?? 'PUSH',
            })),
          );
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [sample, token]),
  );

  if (sample) return (data?.deliveries ?? []).map((d) => ({ key: d.time + d.channels, ...d }));
  return token ? rows : [];
}
