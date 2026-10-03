import { useSnapshot } from '@/data/SnapshotProvider';
import { utcTime } from '@/lib/format';
import { GhostPill } from './controls';
import { Banner } from './states';

/** 13b: shown below the header while offline; cached content stays visible at 55% opacity. */
export function OfflineBanner() {
  const { data, refresh } = useSnapshot();
  const body = data ? `SHOWING SAVED DATA FROM ${utcTime(data.updatedAt)} UTC` : 'NO SAVED DATA YET';
  return (
    <Banner
      icon="wifiOff"
      title="You're offline"
      body={body}
      announce={`You're offline. ${data ? `Showing saved data from ${utcTime(data.updatedAt)} UTC.` : ''}`}
      action={<GhostPill ink label="Retry" onPress={refresh} />}
    />
  );
}

/** Opacity for cached content while offline. */
export const OFFLINE_OPACITY = 0.55;
