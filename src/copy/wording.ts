// Wording levels change copy only; layout and data stay the same (README "Wording levels").
// Standard is not mocked in the design. Following the README suggestion it uses Technical
// labels with event text written in Plain. Plain strings without a mapping in the handoff
// are suggestions and should be confirmed with design.
import { usePrefs } from '@/state/store';
import type { Wording, Worded } from '@/data/types';
import { localDay, localTime, signed, utcTime } from '@/lib/format';

const technical = {
  nowEyebrow: (iso: string, model: string) => `MODEL ${model} · ${utcTime(iso)} UTC`,
  index: (_band: string) => 'INDEX',
  myIndex: 'YOU',
  d24: 'Δ24H',
  d7: 'Δ7D',
  ci: '90% CI',
  trendTitle: '30-DAY TREND',
  trendStats: (min: number, max: number, sd: number) => `MIN ${min} · MAX ${max} · σ ${sd}`,
  vector: 'VECTOR',
  weight: 'WT',
  score: 'SCORE',

  forecastEyebrow: (model: string) => `GLOBAL · 7 DAYS · MODEL ${model}`,
  peak: (day: string) => `PEAK · ${day}`,
  low: (day: string) => `LOW · ${day}`,
  mean: 'MEAN',
  mae: 'MAE 7D',
  rangeHead: '90% RANGE · ● POINT',
  point: 'PT',
  outlook: 'VECTOR OUTLOOK',
  outlookSub: 'SUB-INDEX BY DAY',

  feedMix: (n: number) => `${n} EVENTS · 24H`,
  netImpact: (n: number) => `NET IMPACT ${signed(n)}`,

  threshold: 'GLOBAL THRESHOLD',

  breakdownHead: (kind: 'sectors' | 'regions'): string => (kind === 'sectors' ? 'SECTOR · TOP VECTOR' : 'REGION · TOP VECTOR'),

  historyUnitSuffix: '4-WK AVG DASHED',
  stat: {
    average: 'AVERAGE',
    median: 'MEDIAN',
    sd: 'STD DEV',
    percentile: 'PERCENTILE',
    high: 'HIGH',
    low: 'LOW',
    above70: 'DAYS ≥ 70',
    above85: 'DAYS ≥ 85',
  },
  percentileValue: (p: number) => `${p}th`,
  timeInBand: 'TIME IN BAND',

  iocs: 'IOCS',
  targeted: 'TARGETED',
  actions: 'ACTIONS',

  extraSectorJumps: 'Sector jumps',
  extraSectorJumpsSub: (sectors: string) => `${sectors} · Δ24H ≥ +5`,
  extraFlaws: 'Exploited vulnerabilities (KEV)',
  extraMorning: 'Daily briefing',
  levelRow: (level: 'severe' | 'high' | 'any', threshold: number) =>
    level === 'any' ? 'Index changes band' : `Index ≥ ${threshold}`,
};

type Labels = typeof technical;

const plain: Labels = {
  nowEyebrow: (iso: string) => `${localDay(iso)} · UPDATED ${localTime(iso)}`,
  index: (band: string) => `LEVEL · ${band.toUpperCase()}`,
  myIndex: 'YOU',
  d24: '1 DAY',
  d7: '1 WEEK',
  ci: '± RANGE',
  trendTitle: 'LAST 30 DAYS',
  trendStats: (min: number, max: number) => `LOWEST ${min} · HIGHEST ${max}`,
  vector: 'THREAT TYPE',
  weight: 'SHARE',
  score: 'LEVEL',

  forecastEyebrow: () => 'GLOBAL · NEXT 7 DAYS',
  peak: (day: string) => `HIGHEST · ${day}`,
  low: (day: string) => `LOWEST · ${day}`,
  mean: 'AVERAGE',
  mae: 'USUAL MISS',
  rangeHead: 'LIKELY RANGE · ● BEST GUESS',
  point: 'EST',
  outlook: 'THREAT TYPES AHEAD',
  outlookSub: 'LEVEL BY DAY',

  feedMix: (n: number) => `${n} EVENTS TODAY`,
  netImpact: (n: number) => `LEVEL CHANGE ${signed(n)}`,

  threshold: 'ALERT ME FROM',

  breakdownHead: (kind: 'sectors' | 'regions') => (kind === 'sectors' ? 'SECTOR · TOP THREAT' : 'REGION · TOP THREAT'),

  historyUnitSuffix: '4-WEEK AVERAGE DASHED',
  stat: {
    average: 'AVERAGE',
    median: 'MIDDLE',
    sd: 'USUAL SWING',
    percentile: 'HIGHER THAN',
    high: 'HIGHEST',
    low: 'LOWEST',
    above70: 'DAYS HIGH+',
    above85: 'DAYS SEVERE',
  },
  percentileValue: (p: number) => `${p}%`,
  timeInBand: 'TIME AT EACH LEVEL',

  iocs: 'ATTACK CLUES',
  targeted: 'WHO IS HIT',
  actions: 'WHAT TO DO',

  extraSectorJumps: 'Jumps in your sectors',
  extraSectorJumpsSub: (sectors: string) => `${sectors} · UP 5+ IN 1 DAY`,
  extraFlaws: 'Flaws attackers are using now',
  extraMorning: 'Morning summary',
  levelRow: (level: 'severe' | 'high' | 'any') =>
    level === 'severe' ? 'Index is Severe' : level === 'high' ? 'Index is High or worse' : 'Index changes level',
};

export interface Copy {
  level: Wording;
  L: Labels;
  /** Pick the label variant (Technical for technical and standard). */
  label: (w: Worded) => string;
  /** Pick the event-text variant (Plain for plain and standard). */
  event: (w: Worded) => string;
  isPlain: boolean;
}

export function copyFor(level: Wording): Copy {
  const labelKey = level === 'plain' ? 'plain' : 'technical';
  const eventKey = level === 'technical' ? 'technical' : 'plain';
  return {
    level,
    L: level === 'plain' ? plain : technical,
    label: (w) => w[labelKey],
    event: (w) => w[eventKey],
    isPlain: level === 'plain',
  };
}

export function useCopy(): Copy {
  const level = usePrefs((s) => s.wording);
  return copyFor(level);
}

/** The preview table on 01 (Technical → Plain). */
export const wordingPreview: [string, string][] = [
  ['Δ24H', '1 day'],
  ['VECTOR', 'Threat type'],
  ['90% CI', '± range'],
  ['IOC', 'Attack clue'],
  ['EPSS 0.94', 'Very likely to be used'],
];

export const wordingOptions: { value: Wording; label: string }[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'standard', label: 'Standard' },
  { value: 'technical', label: 'Technical' },
];
