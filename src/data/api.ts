import { fetchLiveSnapshot, SnapshotError } from './live';
import { sampleSnapshot } from './sample';
import type { Snapshot } from './types';

/**
 * Where the snapshot comes from. Live data needs EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (in .env.local, or the EAS build profile). Sample data is
 * used with EXPO_PUBLIC_SAMPLE_DATA=1, or in development when live data isn't configured.
 */
export function dataSource(): 'live' | 'sample' {
  if (process.env.EXPO_PUBLIC_SAMPLE_DATA === '1') return 'sample';
  if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return 'live';
  return __DEV__ ? 'sample' : 'live';
}

/** Fetches the latest snapshot. Throws SnapshotError, saying whether it was offline or a service problem. */
export async function fetchSnapshot(): Promise<Snapshot> {
  if (dataSource() === 'sample') {
    // A short delay exercises the loading states.
    await new Promise((resolve) => setTimeout(resolve, 700));
    return sampleSnapshot;
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new SnapshotError('service', 'Live data is not configured in this build');
  return fetchLiveSnapshot({ url, publishableKey });
}
