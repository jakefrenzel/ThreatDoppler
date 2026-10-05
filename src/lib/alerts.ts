import { regionNames, sectorNames, sectorPeople, vectorNames } from '@/data/catalog';
import type { RegionId, SectorId, Snapshot, VectorId } from '@/data/types';
import type { AlertLevel, AlertRule, Channel, Extras, RuleKind } from '@/state/store';
import { bandFor } from '@/theme/tokens';

import type { Copy } from '@/copy/wording';

/** Rough monthly alert volumes behind the step 3 hints (README 02a). */
export const levelVolume: Record<AlertLevel, number> = { severe: 1, high: 4, any: 12 };
export const extraVolume = { sectorJumps: 2, flaws: 3, morning: 30 };

export function expectedAlerts(level: AlertLevel, extras: Extras, hasSectors: boolean): number {
  let n = levelVolume[level];
  if (extras.sectorJumps && hasSectors) n += extraVolume.sectorJumps;
  if (extras.flaws) n += extraVolume.flaws;
  if (extras.morning) n += extraVolume.morning;
  return n;
}

const channelNames: Record<Channel, string> = { push: 'PUSH', email: 'EMAIL', slack: 'SLACK' };

function targetName(kind: RuleKind, id: string): string {
  if (kind === 'sector') return sectorNames[id as SectorId];
  if (kind === 'region') return regionNames[id as RegionId].medium;
  if (kind === 'vector') return vectorNames[id as VectorId];
  return id;
}

function targetList(rule: AlertRule): string {
  const names = rule.targets.map((id) => targetName(rule.kind, id));
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

export function ruleLabel(rule: AlertRule, copy: Copy): string {
  const plain = copy.isPlain;
  switch (rule.kind) {
    case 'index':
      if (rule.condition === 'band') return plain ? 'Level changes' : 'Global index changes band';
      return plain ? `Level reaches ${rule.value} (${bandFor(rule.value).name})` : `Global index ≥ ${rule.value}`;
    case 'vuln':
      return plain ? 'Flaws attackers are using now' : 'Exploited flaws, EPSS ≥ 0.5 or ransomware';
    case 'digest':
      if (rule.condition === 'weekly') return 'Weekly summary';
      return plain ? 'Morning summary' : 'Daily briefing';
    default: {
      const who = targetList(rule);
      const many = rule.targets.length > 1;
      if (rule.condition === 'jump') {
        return plain ? `${who} ${many ? 'jump' : 'jumps'} ${rule.value}+ in 1 day` : `${who} ${many ? 'move' : 'moves'} ±${rule.value} in 24h`;
      }
      return plain ? `${who} ${many ? 'reach' : 'reaches'} ${rule.value}` : `${who} ≥ ${rule.value}`;
    }
  }
}

export function ruleSub(rule: AlertRule): string {
  const channels = rule.channels.map((c) => channelNames[c]).join(', ');
  const head: Record<RuleKind, string> = {
    index: 'THRESHOLD',
    sector: 'SECTOR',
    region: 'REGION',
    vector: 'ATTACK TYPE',
    vuln: 'VULN',
    digest: rule.condition === 'weekly' ? 'MONDAY' : '07:00 LOCAL',
  };
  return `${head[rule.kind]} · ${channels || 'NO CHANNEL'}`;
}

/**
 * Counts how often a rule would have fired over the given daily series:
 * crossings above the threshold, or day-on-day rises of at least `value`.
 */
export function backtest(series: number[], condition: 'above' | 'jump', value: number): number {
  let hits = 0;
  for (let i = 1; i < series.length; i++) {
    if (condition === 'above' && series[i] >= value && series[i - 1] < value) hits++;
    if (condition === 'jump' && series[i] - series[i - 1] >= value) hits++;
  }
  return hits;
}

/** Daily series used by the New rule back-test, worst of the picked targets. */
export function backtestSeries(data: Snapshot, kind: 'index' | 'sector' | 'region' | 'vector', targets: string[]): number[][] {
  if (kind === 'index') return [data.trend30];
  if (kind === 'sector') return data.sectors.filter((s) => targets.includes(s.id)).map((s) => s.series30d);
  if (kind === 'region') return data.regions.filter((r) => targets.includes(r.id)).map((r) => r.series30d);
  // Attack types have no daily history in the sample data; scale the global trend by the type's score.
  return data.vectors
    .filter((v) => targets.includes(v.id))
    .map((v) => data.trend30.map((x) => Math.round((x * v.score) / data.index.value)));
}

/** Personal index: the mean score of the picked sectors (README 02, "Your index today"). */
export function personalIndex(data: Snapshot, sectors: SectorId[]): number | null {
  const picked = data.sectors.filter((s) => sectors.includes(s.id));
  if (picked.length === 0) return null;
  return Math.round(picked.reduce((a, s) => a + s.score, 0) / picked.length);
}

/** Lock-screen previews on 02b, written for the user's wording level and scope. */
export function notificationPreviews(data: Snapshot, copy: Copy, sectors: SectorId[], regions: RegionId[]) {
  const value = Math.round(data.index.value + data.index.delta24h * 0.9);
  const band = bandFor(value).name;
  // The biggest contributor to the index (score × weight).
  const top = [...data.vectors].sort((a, b) => b.score * b.weight - a.score * a.weight)[0];
  const sector = data.sectors.filter((s) => sectors.includes(s.id)).sort((a, b) => b.score - a.score)[0];
  const region = regions[0] ?? 'nam';
  const first = copy.isPlain
    ? {
        title: `Cyber risk is ${band}: ${value}`,
        body: `Up ${Math.round(data.index.delta24h)} in 1 day, mostly ${vectorNames[top.id].toLowerCase()}. Tap to see what it means for you.`,
      }
    : {
        title: `Global index ${value} · ${band}`,
        body: `Δ24H ${signedShort(data.index.delta24h)}, led by ${vectorNames[top.id].toLowerCase()} (wt ${top.weight.toFixed(2).slice(1)}). Tap for the breakdown.`,
      };
  if (!sector) return [first];
  const jumped = sector.score + 5;
  const second = copy.isPlain
    ? {
        title: `${sectorNames[sector.id]} jumped to ${jumped}`,
        body: `Attacks on ${sectorPeople[sector.id]} rose overnight in ${regionNames[region].full}.`,
      }
    : {
        title: `${sectorNames[sector.id]} sub-index ${jumped} (+5)`,
        body: `${vectorNames[sector.topVector]} activity up overnight · ${regionNames[region].short}.`,
      };
  return [first, second];
}

function signedShort(n: number) {
  return (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1);
}
