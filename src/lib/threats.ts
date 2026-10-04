import { eventTypes } from '@/data/catalog';
import type { Snapshot, ThreatDetail, ThreatEvent } from '@/data/types';
import { signed } from './format';

const genericActions: Record<ThreatEvent['type'], ThreatDetail['actions']> = {
  ransomware: [
    { technical: 'Verify offline backups restore cleanly', plain: 'Check your backups work and are kept offline' },
    { technical: 'Review exposed remote access', plain: 'Review who can log in from outside' },
  ],
  exploit: [
    { technical: 'Check exposure and patch affected systems', plain: 'Find out if you use it, then update it' },
    { technical: 'Hunt for signs of compromise', plain: 'Ask IT to check for break-ins' },
  ],
  ddos: [
    { technical: 'Confirm DDoS mitigation is enabled upstream', plain: 'Check your web host is protecting your site' },
  ],
  phishing: [
    { technical: 'Block the lure domains at the mail gateway', plain: 'Warn staff about these emails' },
    { technical: 'Remind staff how to report suspicious mail', plain: 'Remind staff how to report odd emails' },
  ],
  supply: [
    { technical: 'Audit dependencies for the affected versions', plain: 'Ask IT whether you use the affected software' },
    { technical: 'Rotate secrets exposed to build systems', plain: 'Change passwords the software could see' },
  ],
};

/** Detail for an event. Falls back to a summary built from the event when the feed has no full report. */
export function threatFor(data: Snapshot, id: string): { event: ThreatEvent | undefined; detail: ThreatDetail } | null {
  const event = data.events.find((e) => e.id === id);
  // The id comes from the URL, so ignore inherited keys like "constructor" or "__proto__".
  const detail = Object.hasOwn(data.threats, id) ? data.threats[id] : undefined;
  if (detail) return { event, detail };
  if (!event) return null;
  const type = eventTypes[event.type];
  const share = event.sectors.length ? Math.round(100 / event.sectors.length) : 0;
  return {
    event,
    detail: {
      id,
      tags: [
        { label: { technical: `${type.chip} · Active`, plain: type.chip }, primary: true },
        { label: { technical: event.source, plain: event.source } },
        { label: { technical: `TODAY ${event.time} UTC`, plain: `TODAY ${event.time} UTC` } },
      ],
      title: event.title,
      stats: [
        { label: { technical: 'INDEX IMPACT', plain: 'LEVEL IMPACT' }, value: { technical: signed(event.impact), plain: signed(event.impact) }, highlight: true },
        { label: { technical: 'SECTORS', plain: 'SECTORS' }, value: { technical: String(event.sectors.length || 'All'), plain: String(event.sectors.length || 'All') } },
        { label: { technical: 'REGIONS', plain: 'REGIONS' }, value: { technical: String(event.regions.length), plain: String(event.regions.length) } },
      ],
      bins: {
        title: { technical: 'RELATED EVENTS · 12H BINS', plain: 'RELATED EVENTS · EVERY 12H' },
        peak: '',
        values: [],
      },
      targeted: event.sectors.map((sector) => ({ sector, share })),
      iocs: [],
      actions: genericActions[event.type],
    },
  };
}
