import { useSnapshot } from '@/data/SnapshotProvider';
import { utcTime } from '@/lib/format';
import { GhostPill } from './controls';
import { Banner } from './states';

/**
 * Shown below the header when the latest data couldn't be fetched; cached content stays visible
 * at 55% opacity. 13b covers being offline; a service problem uses the same layout.
 */
export function StatusBanner() {
  const { data, status, refresh, retrying } = useSnapshot();
  if (status !== 'offline' && status !== 'error') return null;
  const saved = data ? `Showing saved data from ${utcTime(data.updatedAt)} UTC.` : '';
  const body = data ? `SHOWING SAVED DATA FROM ${utcTime(data.updatedAt)} UTC` : 'NO SAVED DATA YET';
  // While retrying, the banner and its text stay exactly as they are; only the button dims.
  const action = <GhostPill ink label="Retry" onPress={refresh} busy={retrying} />;
  return status === 'offline' ? (
    <Banner icon="wifiOff" title="You're offline" body={body} announce={`You're offline. ${saved}`} action={action} />
  ) : (
    <Banner
      icon="activity"
      title="Live data unavailable"
      body={body}
      announce={`Live data is unavailable right now. ${saved}`}
      action={action}
    />
  );
}

/** Opacity for cached content while offline or while the service is unavailable. */
export const OFFLINE_OPACITY = 0.55;
