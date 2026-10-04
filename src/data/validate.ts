import { eventTypes, regionNames, sectorNames, vectorNames } from './catalog';
import type { Snapshot } from './types';

// Checks data from the network or the cache before the app uses it, so a bad or outdated file
// shows the error state instead of crashing a screen. It checks what screens rely on: types,
// known ids (so catalog lookups can't fail) and non-empty arrays where screens index into them.

type Check = (v: unknown) => boolean;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const str: Check = (v) => typeof v === 'string';
const arrayOf = (item: Check, min = 0): Check => (v) => Array.isArray(v) && v.length >= min && v.every(item);
const oneOf = (values: Record<string, unknown>): Check => (v) => typeof v === 'string' && Object.hasOwn(values, v);
const shape = (fields: Record<string, Check>): Check => (v) =>
  isObject(v) && Object.entries(fields).every(([key, check]) => check(v[key]));
const worded = shape({ technical: str, plain: str });

const area = (ids: Record<string, unknown>) =>
  shape({
    id: oneOf(ids),
    score: num,
    delta24h: num,
    delta7d: num,
    series7d: arrayOf(num),
    series30d: arrayOf(num),
    topVector: oneOf(vectorNames),
  });

const event = shape({
  id: str,
  time: str,
  type: oneOf(eventTypes),
  title: worded,
  headline: worded,
  source: str,
  meta: str,
  impact: num,
  sectors: arrayOf(oneOf(sectorNames)),
  regions: arrayOf(oneOf(regionNames)),
});

const detail = shape({
  id: str,
  tags: arrayOf(shape({ label: worded })),
  title: worded,
  stats: arrayOf(shape({ label: worded, value: worded })),
  bins: shape({ title: worded, peak: str, values: arrayOf(num) }),
  targeted: arrayOf(shape({ sector: oneOf(sectorNames), share: num })),
  iocs: arrayOf(shape({ kind: str, value: str })),
  actions: arrayOf(worded),
});

const history = shape({
  key: oneOf({ '30D': 1, '90D': 1, '1Y': 1, '5Y': 1 }),
  series: arrayOf(num, 1),
  unit: worded,
  axis: arrayOf(shape({ at: num, label: str })),
  peak: shape({ index: num, value: num, label: str }),
  stats: shape({
    average: num, median: num, sd: num, percentile: num, high: num, low: num, daysAbove70: num, daysAbove85: num,
  }),
  timeInBand: arrayOf(shape({ band: str, share: num })),
  peaks: arrayOf(shape({ date: str, title: str, type: oneOf(vectorNames), value: num })),
});

const snapshot = shape({
  model: str,
  updatedAt: (v) => str(v) && !Number.isNaN(Date.parse(v as string)),
  index: shape({ value: num, delta24h: num, delta7d: num, ci: num }),
  trend30: arrayOf(num, 2),
  vectors: arrayOf(shape({ id: oneOf(vectorNames), weight: num, score: num, delta24h: num })),
  regions: arrayOf(area(regionNames)),
  sectors: arrayOf(area(sectorNames)),
  forecast: arrayOf(shape({ day: str, short: str, lo: num, hi: num, point: num, delta: num })),
  forecastStats: shape({ mae: num }),
  vectorForecast: arrayOf(shape({ id: oneOf(vectorNames), values: arrayOf(num) })),
  events: arrayOf(event),
  eventMix: arrayOf(shape({ type: oneOf(eventTypes), count: num })),
  newEvents: num,
  netImpact24h: num,
  // The Now screen reads the 30-day range's stats.
  history: (v) => arrayOf(history, 1)(v) && (v as { key: string }[]).some((h) => h.key === '30D'),
  threats: (v) => isObject(v) && Object.values(v).every(detail),
  deliveries: arrayOf(shape({ time: str, label: worded, channels: str })),
});

export function isSnapshot(v: unknown): v is Snapshot {
  return snapshot(v);
}
