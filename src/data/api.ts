import { fetchSnapshotFile, liveSnapshotUrl, overlayLive } from './live';
import { sampleSnapshot } from './sample';
import type { Snapshot } from './types';

/**
 * Fetches the latest snapshot. By default this resolves the sample data after a short delay, to
 * exercise the loading states. With EXPO_PUBLIC_LIVE_DATA=1 and EXPO_PUBLIC_SUPABASE_URL set (in
 * .env.local), it reads the published snapshot and lays it over the sample data, since the
 * backend doesn't compute every part yet.
 */
export async function fetchSnapshot(): Promise<Snapshot> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (process.env.EXPO_PUBLIC_LIVE_DATA === '1' && supabaseUrl) {
    const file = await fetchSnapshotFile(liveSnapshotUrl(supabaseUrl));
    return overlayLive(sampleSnapshot, file.snapshot);
  }
  await new Promise((resolve) => setTimeout(resolve, 700));
  return sampleSnapshot;
}
