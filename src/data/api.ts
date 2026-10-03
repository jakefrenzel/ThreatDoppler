import { sampleSnapshot } from './sample';
import type { Snapshot } from './types';

/**
 * Fetches the latest snapshot. There is no backend yet, so this resolves the sample data
 * after a short delay to exercise the loading states.
 */
export async function fetchSnapshot(): Promise<Snapshot> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return sampleSnapshot;
}
