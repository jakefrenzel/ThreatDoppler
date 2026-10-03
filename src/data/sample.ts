// Fictional sample data from the design handoff. It stands in for the backend until one exists.
import type {
  AreaScore,
  HistoryRange,
  RegionId,
  SectorId,
  Snapshot,
  ThreatDetail,
  ThreatEvent,
  VectorId,
} from './types';

/** Small deterministic PRNG so generated series are stable between launches. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// 7-day series shape from the design: a straight climb of d7 points plus a small wiggle.
const WIGGLE = [0, 1, -1, 1, 0, -1, 0];
function series7(score: number, d7: number) {
  return WIGGLE.map((w, k) => round1(score - d7 + (d7 * k) / 6 + (k === 6 ? 0 : w)));
}

function series30(score: number, d7: number, seed: number, head?: number[]) {
  const last7 = series7(score, d7);
  if (head) return [...head, ...last7];
  const rand = mulberry32(seed);
  const out: number[] = [];
  let v = last7[0] + (rand() - 0.5) * 8;
  for (let i = 0; i < 23; i++) {
    v += (rand() - 0.5) * 5 + (last7[0] - v) * 0.15;
    out.push(round1(v));
  }
  return [...out, ...last7];
}

const sectorRows: [SectorId, number, number, number, VectorId][] = [
  // id, score, Δ24h, Δ7d, top vector
  ['health', 81, 5, 9, 'ransomware'],
  ['finance', 78, 3, 6, 'ddos'],
  ['government', 74, 2, 5, 'exploitation'],
  ['technology', 71, 1, 3, 'supply'],
  ['energy', 69, -1, 4, 'exploitation'],
  ['telecom', 66, 0, 1, 'ddos'],
  ['manufacturing', 64, 2, 5, 'ransomware'],
  ['education', 62, -2, -3, 'phishing'],
  ['retail', 58, -1, -1, 'phishing'],
  ['transport', 55, 0, 2, 'ransomware'],
];

// Health's 30 days are fixed so the New rule back-test matches the design ("2 times" above 85).
const HEALTH_HEAD = [74, 75, 77, 76, 78, 80, 82, 86, 84, 81, 79, 78, 80, 83, 82, 79, 77, 78, 80, 82, 86, 83, 76];

const sectors: AreaScore<SectorId>[] = sectorRows.map(([id, score, d24, d7, topVector], i) => ({
  id,
  score,
  delta24h: d24,
  delta7d: d7,
  series7d: series7(score, d7),
  series30d: series30(score, d7, 101 + i, id === 'health' ? HEALTH_HEAD : undefined),
  topVector,
}));

const regionRows: [RegionId, number, number, number, VectorId][] = [
  ['nam', 76, 3, 6, 'ransomware'],
  ['apac', 74, 2, 4, 'exploitation'],
  ['europe', 71, 1, 5, 'ddos'],
  ['mea', 68, 0, 2, 'phishing'],
  ['latam', 63, -1, -2, 'ransomware'],
];

const regions: AreaScore<RegionId>[] = regionRows.map(([id, score, d24, d7, topVector], i) => ({
  id,
  score,
  delta24h: d24,
  delta7d: d7,
  series7d: series7(score, d7),
  series30d: series30(score, d7, 201 + i),
  topVector,
}));

const trend30 = [55, 57, 56, 54, 58, 60, 59, 62, 61, 58, 57, 60, 62, 64, 63, 61, 63, 65, 66, 64, 62, 63, 65, 67, 68, 66, 65, 66, 69, 72];

const weekly1y = [
  48, 50, 47, 52, 55, 53, 50, 46, 44, 42, 40, 38, 41, 45, 49, 52, 56, 60, 58, 63, 67, 72, 80, 88, 79, 70, 64, 60, 58,
  55, 53, 51, 49, 47, 45, 43, 40, 36, 31, 38, 46, 58, 70, 83, 76, 66, 60, 57, 59, 62, 66, 72,
];

function generated(n: number, seed: number, end: number, base: number, swing: number) {
  const rand = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const wave = Math.sin((i / n) * Math.PI * 5 + seed) * swing;
    out.push(round1(Math.max(20, Math.min(92, base + wave + (rand() - 0.5) * swing * 0.6))));
  }
  out[n - 1] = end;
  return out;
}

function summarize(series: number[], daysPerPoint: number): HistoryRange['stats'] & {
  timeInBand: HistoryRange['timeInBand'];
} {
  const n = series.length;
  const sorted = [...series].sort((a, b) => a - b);
  const average = series.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const sd = Math.sqrt(series.reduce((a, b) => a + (b - average) ** 2, 0) / n);
  const last = series[n - 1];
  const share = (lo: number, hi: number) => Math.round((series.filter((v) => v >= lo && v < hi).length / n) * 100);
  const timeInBand: HistoryRange['timeInBand'] = [
    { band: 'low' as const, share: share(0, 25) },
    { band: 'guarded' as const, share: share(25, 50) },
    { band: 'elevated' as const, share: share(50, 70) },
    { band: 'high' as const, share: share(70, 85) },
    { band: 'severe' as const, share: share(85, 101) },
  ].filter((b) => b.share > 0);
  return {
    average: Math.round(average),
    median: Math.round(median),
    sd: round1(sd),
    percentile: Math.round((series.filter((v) => v < last).length / n) * 100),
    high: Math.round(sorted[n - 1]),
    low: Math.round(sorted[0]),
    daysAbove70: series.filter((v) => v >= 70).length * daysPerPoint,
    daysAbove85: series.filter((v) => v >= 85).length * daysPerPoint,
    timeInBand,
  };
}

function peakOf(series: number[]) {
  let index = 0;
  series.forEach((v, i) => {
    if (v > series[index]) index = i;
  });
  return { index, value: Math.round(series[index]) };
}

const s90 = generated(90, 7, 72, 61, 7);
const s5y = generated(60, 11, 72, 52, 12);
const sum90 = summarize(s90, 1);
const sum5y = summarize(s5y, 30);

const history: HistoryRange[] = [
  {
    key: '30D',
    series: trend30,
    unit: { technical: 'DAILY INDEX', plain: 'DAILY LEVEL' },
    axis: [
      { at: 0, label: '03 SEP' },
      { at: 0.33, label: '13 SEP' },
      { at: 0.66, label: '23 SEP' },
      { at: 0.9, label: '02 OCT' },
    ],
    peak: { index: 29, value: 72, label: '72 · 02 OCT' },
    stats: { average: 62, median: 62, sd: 4.6, percentile: 97, high: 72, low: 54, daysAbove70: 1, daysAbove85: 0 },
    timeInBand: [
      { band: 'elevated', share: 97 },
      { band: 'high', share: 3 },
    ],
    peaks: [
      { date: '02 OCT', title: 'Edge VPN zero-day under mass exploitation', type: 'exploitation', value: 72 },
      { date: '01 OCT', title: 'Ransomware leak-site surge, healthcare', type: 'ransomware', value: 69 },
      { date: '25 SEP', title: 'Bank DDoS campaign across Europe', type: 'ddos', value: 68 },
    ],
  },
  {
    key: '90D',
    series: s90,
    unit: { technical: 'DAILY INDEX', plain: 'DAILY LEVEL' },
    axis: [
      { at: 0, label: 'JUL' },
      { at: 0.33, label: 'AUG' },
      { at: 0.66, label: 'SEP' },
      { at: 0.92, label: 'OCT' },
    ],
    peak: { ...peakOf(s90), label: '' },
    stats: sum90,
    timeInBand: sum90.timeInBand,
    peaks: [
      { date: '05 AUG', title: 'Ransomware wave against hospitals', type: 'ransomware', value: 83 },
      { date: '02 OCT', title: 'Edge VPN zero-day under mass exploitation', type: 'exploitation', value: 72 },
      { date: '19 JUL', title: 'Telecom DDoS during peak traffic', type: 'ddos', value: 70 },
    ],
  },
  {
    key: '1Y',
    series: weekly1y,
    unit: { technical: 'WEEKLY INDEX', plain: 'WEEKLY LEVEL' },
    axis: [
      { at: 0, label: 'OCT' },
      { at: 78 / 322, label: 'JAN' },
      { at: 157 / 322, label: 'APR' },
      { at: 236 / 322, label: 'JUL' },
      { at: 304 / 322, label: 'OCT' },
    ],
    peak: { index: 23, value: 88, label: '88 · 14 MAR' },
    stats: { average: 57, median: 56, sd: 13.2, percentile: 78, high: 88, low: 31, daysAbove70: 63, daysAbove85: 9 },
    timeInBand: [
      { band: 'guarded', share: 21 },
      { band: 'elevated', share: 52 },
      { band: 'high', share: 21 },
      { band: 'severe', share: 6 },
    ],
    peaks: [
      { date: '14 MAR', title: 'Build-server supply-chain compromise', type: 'supply', value: 88 },
      { date: '05 AUG', title: 'Ransomware wave against hospitals', type: 'ransomware', value: 83 },
      { date: '28 FEB', title: 'Mail server zero-day exploited', type: 'exploitation', value: 80 },
    ],
  },
  {
    key: '5Y',
    series: s5y,
    unit: { technical: 'MONTHLY INDEX', plain: 'MONTHLY LEVEL' },
    axis: [
      { at: 0, label: '2021' },
      { at: 0.2, label: '2022' },
      { at: 0.4, label: '2023' },
      { at: 0.6, label: '2024' },
      { at: 0.8, label: '2025' },
    ],
    peak: { ...peakOf(s5y), label: '' },
    stats: sum5y,
    timeInBand: sum5y.timeInBand,
    peaks: [
      { date: 'MAR 25', title: 'Build-server supply-chain compromise', type: 'supply', value: 88 },
      { date: 'DEC 23', title: 'File-transfer software mass exploitation', type: 'exploitation', value: 86 },
      { date: 'MAY 22', title: 'Ransomware against national agencies', type: 'ransomware', value: 84 },
    ],
  },
];
for (const r of history) {
  if (!r.peak.label) r.peak.label = `${r.peak.value} · ${r.peaks[0].date}`;
}

const events: ThreatEvent[] = [
  {
    id: 'leak-sites',
    time: '09:31',
    type: 'ransomware',
    title: {
      technical: '14 new victims posted to leak sites',
      plain: '14 more organisations hit by ransomware',
    },
    headline: {
      technical: '14 new leak-site victims, 6 healthcare',
      plain: '14 more organisations hit by ransomware, 6 hospitals',
    },
    source: 'LEAK MONITOR',
    meta: 'HEALTH 6 · MFG 4',
    impact: 0.6,
    sectors: ['health', 'manufacturing'],
    regions: ['nam', 'europe'],
  },
  {
    id: 'edge-vpn',
    time: '09:12',
    type: 'exploit',
    title: {
      technical: 'Edge VPN scanning up 38% in six hours',
      plain: 'Attacks on office VPNs up 38% this morning',
    },
    headline: {
      technical: 'Edge VPN scanning up 38% in 6h',
      plain: 'Attacks on office VPNs up 38% this morning',
    },
    source: 'HONEYNET',
    meta: '18.4K IPS',
    impact: 0.4,
    sectors: ['government', 'finance', 'energy'],
    regions: ['nam', 'europe', 'apac'],
  },
  {
    id: 'bank-floods',
    time: '08:55',
    type: 'ddos',
    title: {
      technical: 'Application-layer floods on European banks',
      plain: 'Fake traffic is flooding European bank websites',
    },
    headline: {
      technical: 'L7 floods on European banks',
      plain: 'Fake traffic flooding European bank websites',
    },
    source: 'CDN TELEMETRY',
    meta: 'FINANCE',
    impact: 0.2,
    sectors: ['finance'],
    regions: ['europe'],
  },
  {
    id: 'payroll-lures',
    time: '08:20',
    type: 'phishing',
    title: {
      technical: 'Payroll-themed lures aimed at HR teams',
      plain: 'Fake payroll emails aimed at HR teams',
    },
    headline: {
      technical: 'Payroll-themed lures aimed at HR',
      plain: 'Fake payroll emails aimed at HR teams',
    },
    source: 'MAIL SENSORS',
    meta: 'CROSS-SECTOR',
    impact: -0.1,
    sectors: [],
    regions: ['nam', 'europe', 'apac', 'mea', 'latam'],
  },
  {
    id: 'registry-packages',
    time: '07:48',
    type: 'supply',
    title: {
      technical: 'Malicious package versions pulled from registry',
      plain: 'Booby-trapped code removed from a public download site',
    },
    headline: {
      technical: 'Malicious package versions pulled',
      plain: 'Booby-trapped code removed from a download site',
    },
    source: 'REGISTRY ADVISORY',
    meta: 'TECH',
    impact: 0.3,
    sectors: ['technology'],
    regions: ['nam', 'europe'],
  },
  {
    id: 'cert-energy',
    time: '07:02',
    type: 'exploit',
    title: {
      technical: 'National CERT guidance for energy operators',
      plain: 'Government warning issued to energy companies',
    },
    headline: {
      technical: 'CERT guidance for energy operators',
      plain: 'Government warning to energy companies',
    },
    source: 'CERT',
    meta: 'ENERGY · N. AM',
    impact: 0,
    sectors: ['energy'],
    regions: ['nam'],
  },
  {
    id: 'logistics-claim',
    time: '06:40',
    type: 'ransomware',
    title: {
      technical: 'Group claims attack on regional logistics firm',
      plain: 'Ransomware gang says it hit a delivery company',
    },
    headline: {
      technical: 'Group claims logistics firm attack',
      plain: 'Ransomware gang says it hit a delivery company',
    },
    source: 'LEAK MONITOR',
    meta: 'TRANSPORT',
    impact: 0.2,
    sectors: ['transport'],
    regions: ['europe'],
  },
  {
    id: 'mail-poc',
    time: '06:05',
    type: 'exploit',
    title: {
      technical: 'Proof-of-concept published for mail server flaw',
      plain: 'Step-by-step attack on a mail server flaw is now public',
    },
    headline: {
      technical: 'PoC published for mail server flaw',
      plain: 'Attack steps for a mail server flaw now public',
    },
    source: 'RESEARCH',
    meta: 'CVSS 8.1',
    impact: 0.3,
    sectors: ['technology'],
    regions: ['nam', 'europe', 'apac'],
  },
];

const t = (technical: string, plain: string = technical) => ({ technical, plain });

const threats: Record<string, ThreatDetail> = {
  'edge-vpn': {
    id: 'edge-vpn',
    tags: [
      { label: t('Exploitation · Active', 'Being used now'), primary: true },
      { label: t('CVSS 9.8', 'SEVERITY 9.8 / 10') },
      { label: t('KEV LISTED', 'KNOWN TO BE USED') },
      { label: t('SINCE 29 SEP') },
    ],
    title: t('Edge VPN zero-day under mass exploitation', 'Attackers are breaking into office VPNs'),
    stats: [
      { label: t('INDEX IMPACT', 'LEVEL IMPACT'), value: t('+3.0'), highlight: true },
      { label: t('SCANNING IPS', 'ATTACKERS LOOKING'), value: t('18.4k') },
      { label: t('EXPOSED', 'OPEN TO ATTACK'), value: t('41k') },
      { label: t('PATCHED', 'FIXED'), value: t('37%') },
      { label: t('CONFIRMED VICTIMS', 'KNOWN VICTIMS'), value: t('212') },
      { label: t('EPSS', 'CHANCE OF USE'), value: t('0.94', 'Very likely'), mono: true },
    ],
    bins: {
      title: t('EXPLOIT ATTEMPTS · 12H BINS', 'ATTACK ATTEMPTS · EVERY 12H'),
      peak: 'PEAK 4.1K/H',
      values: [4, 6, 8, 12, 20, 26, 38, 45, 52, 58, 64, 72, 86, 100],
    },
    targeted: [
      { sector: 'government', share: 38 },
      { sector: 'finance', share: 27 },
      { sector: 'energy', share: 19 },
    ],
    iocs: [
      { kind: 'IP RANGE', value: '203.0.113.0/24' },
      { kind: 'IP', value: '198.51.100.17' },
      { kind: 'SHA-256', value: 'a3f9e1…7b0c21e' },
      { kind: 'DOMAIN', value: 'update-gw[.]example' },
    ],
    actions: [
      t('Rotate VPN credentials and revoke sessions', 'Change VPN passwords and sign everyone out'),
      t('Patch or take affected appliances offline', 'Update the VPN box, or switch it off until you can'),
      t('Hunt for web shells on edge hosts since 29 Sep', 'Ask IT to check the VPN box for break-ins since 29 Sep'),
    ],
  },
  'leak-sites': {
    id: 'leak-sites',
    tags: [
      { label: t('Ransomware · Active', 'Happening now'), primary: true },
      { label: t('3 GROUPS') },
      { label: t('SINCE 01 OCT') },
    ],
    title: t('14 new victims posted to ransomware leak sites', '14 more organisations hit by ransomware'),
    stats: [
      { label: t('INDEX IMPACT', 'LEVEL IMPACT'), value: t('+0.6'), highlight: true },
      { label: t('NEW VICTIMS', 'NEW VICTIMS'), value: t('14') },
      { label: t('HEALTHCARE', 'HOSPITALS'), value: t('6') },
      { label: t('MANUFACTURING', 'FACTORIES'), value: t('4') },
      { label: t('ACTIVE GROUPS', 'GANGS ACTIVE'), value: t('3') },
      { label: t('DATA POSTED', 'DATA LEAKED'), value: t('2.1 TB') },
    ],
    bins: {
      title: t('LEAK-SITE POSTS · 12H BINS', 'NEW VICTIMS · EVERY 12H'),
      peak: 'PEAK 9 / 12H',
      values: [10, 12, 8, 14, 20, 18, 26, 30, 24, 40, 52, 60, 78, 100],
    },
    targeted: [
      { sector: 'health', share: 43 },
      { sector: 'manufacturing', share: 29 },
      { sector: 'retail', share: 14 },
    ],
    iocs: [
      { kind: 'DOMAIN', value: 'leak-blog[.]example' },
      { kind: 'IP', value: '192.0.2.44' },
      { kind: 'SHA-256', value: '9c41d0…e2a7f11' },
    ],
    actions: [
      t('Verify offline backups restore cleanly', 'Check your backups work and are kept offline'),
      t('Review remote access to clinical systems', 'Review who can log in to hospital systems from outside'),
      t('Brief staff on extortion calls and emails', 'Warn staff about threatening calls and emails'),
    ],
  },
};

export const sampleSnapshot: Snapshot = {
  model: '3.2',
  updatedAt: '2026-10-02T09:40:00Z',
  index: { value: 72.4, delta24h: 6.1, delta7d: 11.3, ci: 4.2 },
  trend30,
  vectors: [
    { id: 'ransomware', weight: 0.3, score: 84, delta24h: 5.2 },
    { id: 'exploitation', weight: 0.25, score: 79, delta24h: 7.8 },
    { id: 'supply', weight: 0.1, score: 66, delta24h: 2.1 },
    { id: 'phishing', weight: 0.15, score: 61, delta24h: -1.0 },
    { id: 'ddos', weight: 0.1, score: 55, delta24h: 0.4 },
    { id: 'insider', weight: 0.1, score: 48, delta24h: 0 },
  ],
  regions,
  sectors,
  forecast: [
    { day: 'FRI', short: 'F', lo: 70, hi: 74, point: 72, delta: 6 },
    { day: 'SAT', short: 'S', lo: 71, hi: 77, point: 74, delta: 2 },
    { day: 'SUN', short: 'S', lo: 74, hi: 82, point: 78, delta: 4 },
    { day: 'MON', short: 'M', lo: 76, hi: 86, point: 81, delta: 3 },
    { day: 'TUE', short: 'T', lo: 70, hi: 82, point: 76, delta: -5 },
    { day: 'WED', short: 'W', lo: 63, hi: 77, point: 70, delta: -6 },
    { day: 'THU', short: 'T', lo: 60, hi: 76, point: 68, delta: -2 },
  ],
  forecastStats: { mae: 3.1 },
  vectorForecast: [
    { id: 'ransomware', values: [84, 86, 88, 90, 85, 80, 77] },
    { id: 'exploitation', values: [79, 80, 82, 83, 78, 72, 68] },
    { id: 'phishing', values: [61, 58, 57, 63, 62, 60, 59] },
    { id: 'ddos', values: [55, 57, 60, 66, 62, 58, 55] },
    { id: 'supply', values: [66, 66, 65, 67, 66, 64, 63] },
  ],
  events,
  eventMix: [
    { type: 'ransomware', count: 41 },
    { type: 'exploit', count: 28 },
    { type: 'phishing', count: 63 },
    { type: 'ddos', count: 17 },
    { type: 'supply', count: 6 },
  ],
  newEvents: 6,
  netImpact24h: 3.2,
  history,
  threats,
  deliveries: [
    { time: '09:12', label: t('Exploited CVE, CVSS 9.8', 'Flaw attackers are using, severity 9.8'), channels: 'PUSH · SLACK' },
    { time: '07:00', label: t('Daily briefing', 'Morning summary'), channels: 'EMAIL' },
  ],
};
