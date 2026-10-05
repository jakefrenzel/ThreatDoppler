import type { SourceId } from './types';

/**
 * Where live data comes from, with the credit each licence asks for. Shown on About · Data sources,
 * and on every event's detail page. When a source is added or dropped, update this list and
 * "Before monetising" in docs/backend-plan.md.
 */
export interface DataSource {
  /** Key in Snapshot.sources, for "last updated". VCDB has no live feed. */
  id: SourceId | 'vcdb';
  name: string;
  what: string;
  licence: string;
  url: string;
  /** How the source appears as an event's `source`. */
  eventLabel?: string;
}

export const dataSources: DataSource[] = [
  {
    id: 'kev',
    name: 'CISA Known Exploited Vulnerabilities',
    what: 'Flaws attackers are using, and which ones ransomware uses',
    licence: 'Public domain (CC0). CISA does not endorse ThreatDoppler.',
    url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    eventLabel: 'CISA KEV',
  },
  {
    id: 'epss',
    name: 'FIRST EPSS',
    what: 'The chance each flaw will be exploited',
    licence: 'EPSS scores from FIRST, first.org/epss',
    url: 'https://www.first.org/epss',
  },
  {
    id: 'ransomlook',
    name: 'RansomLook',
    what: 'Ransomware leak-site posts, and their sectors from the descriptions groups post. ThreatDoppler keeps counts only, never victim names or descriptions.',
    licence: 'CC BY 4.0',
    url: 'https://www.ransomlook.io',
    eventLabel: 'RANSOMLOOK',
  },
  {
    id: 'osv',
    name: 'OpenSSF Malicious Packages, via OSV',
    what: 'Malicious software packages',
    licence: 'Apache License 2.0',
    url: 'https://osv.dev',
    eventLabel: 'OSV',
  },
  {
    id: 'hibp',
    name: 'Have I Been Pwned',
    what: 'Data breaches',
    licence: 'CC BY 4.0',
    url: 'https://haveibeenpwned.com',
    eventLabel: 'HAVE I BEEN PWNED',
  },
  {
    id: 'radar',
    name: 'Cloudflare Radar',
    what: 'DDoS attacks, overall and by industry and target country, and malicious email',
    licence: 'CC BY-NC 4.0',
    url: 'https://radar.cloudflare.com',
    eventLabel: 'CLOUDFLARE RADAR',
  },
  {
    id: 'vcdb',
    name: 'VERIS Community Database',
    what: 'Each sector’s and region’s usual mix of attack types',
    licence: 'CC BY-SA 4.0',
    url: 'https://github.com/vz-risk/VCDB',
  },
];

/** The source behind an event, from its `source` label. */
export const sourceForEvent = (label: string) => dataSources.find((s) => s.eventLabel === label);
