export type Wording = 'plain' | 'standard' | 'technical';

export type RoleId = 'soc' | 'student' | 'exec' | 'it' | 'smb' | 'curious';

export type SectorId =
  | 'health'
  | 'finance'
  | 'government'
  | 'technology'
  | 'energy'
  | 'telecom'
  | 'manufacturing'
  | 'education'
  | 'retail'
  | 'transport';

export type RegionId = 'nam' | 'apac' | 'europe' | 'mea' | 'latam';

export type VectorId = 'ransomware' | 'exploitation' | 'supply' | 'phishing' | 'ddos' | 'insider';

/** Copy that changes with the wording level. Standard uses technical labels with plain event text. */
export interface Worded {
  technical: string;
  plain: string;
}

export interface IndexSummary {
  value: number;
  delta24h: number;
  delta7d: number;
  ci: number;
}

export interface VectorScore {
  id: VectorId;
  weight: number;
  score: number;
  delta24h: number;
}

export interface AreaScore<Id extends string> {
  id: Id;
  score: number;
  delta24h: number;
  delta7d: number;
  /** Seven daily values, oldest first; the last one is today. */
  series7d: number[];
  /** Thirty daily values, oldest first. Used for rule back-tests. */
  series30d: number[];
  topVector: VectorId;
}

export interface ForecastDay {
  day: string; // FRI
  short: string; // F
  lo: number;
  hi: number;
  point: number;
  delta: number;
}

export type EventType = 'ransomware' | 'exploit' | 'ddos' | 'phishing' | 'supply' | 'breach';

export interface ThreatEvent {
  id: string;
  time: string; // HH:MM UTC
  type: EventType;
  /** Full title shown in the feed and on the detail sheet. */
  title: Worded;
  /** Short line used in the "latest events" block on Now. */
  headline: Worded;
  source: string;
  meta: string;
  impact: number;
  sectors: SectorId[];
  regions: RegionId[];
}

export interface ThreatStat {
  label: Worded;
  value: Worded;
  highlight?: boolean;
  mono?: boolean;
}

export interface ThreatDetail {
  id: string;
  tags: { label: Worded; primary?: boolean }[];
  title: Worded;
  stats: ThreatStat[];
  bins: { title: Worded; peak: string; values: number[] };
  targeted: { sector: SectorId; share: number }[];
  iocs: { kind: string; value: string }[];
  actions: Worded[];
}

export interface HistoryRange {
  key: '30D' | '90D' | '1Y' | '5Y';
  series: number[];
  /** What each point in `series` covers, e.g. "03 OCT", "WK OF 29 SEP", "SEP 2026". Shown while scrubbing. */
  pointLabels?: string[];
  /** Points per period label, e.g. weekly for 1Y. */
  unit: Worded;
  axis: { at: number; label: string }[];
  peak: { index: number; value: number; label: string };
  stats: {
    average: number;
    median: number;
    sd: number;
    percentile: number;
    high: number;
    low: number;
    daysAbove70: number;
    daysAbove85: number;
  };
  timeInBand: { band: 'low' | 'guarded' | 'elevated' | 'high' | 'severe'; share: number }[];
  peaks: { date: string; title: string; type: VectorId; value: number }[];
}

export interface Delivery {
  time: string;
  label: Worded;
  channels: string;
}

export interface Snapshot {
  model: string;
  updatedAt: string; // ISO
  index: IndexSummary;
  trend30: number[];
  vectors: VectorScore[];
  regions: AreaScore<RegionId>[];
  sectors: AreaScore<SectorId>[];
  forecast: ForecastDay[];
  forecastStats: { mae: number };
  vectorForecast: { id: VectorId; values: number[] }[];
  events: ThreatEvent[];
  eventMix: { type: EventType; count: number }[];
  newEvents: number;
  netImpact24h: number;
  history: HistoryRange[];
  threats: Record<string, ThreatDetail>;
  deliveries: Delivery[];
  /** When each data source last updated successfully (ISO), or null if never. Live data only. */
  sources?: Partial<Record<SourceId, string | null>>;
}

export type SourceId = 'kev' | 'epss' | 'ransomlook' | 'osv' | 'hibp' | 'radar';

/**
 * The file the backend publishes (snapshot/v1/latest.json), also returned by get_snapshot().
 * Written by supabase/functions/render-snapshot.
 */
export interface SnapshotFile {
  /** Bumped when the file changes in a way older app builds can't read. */
  schemaVersion: number;
  generatedAt: string; // ISO
  snapshot: Snapshot;
}
