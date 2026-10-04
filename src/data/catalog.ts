import { bandColor, palette } from '@/theme/tokens';

import type { EventType, RegionId, RoleId, SectorId, VectorId } from './types';

export const roles: { id: RoleId; name: string }[] = [
  { id: 'soc', name: 'SOC analyst' },
  { id: 'student', name: 'Student' },
  { id: 'exec', name: 'Executive' },
  { id: 'it', name: 'IT / developer' },
  { id: 'smb', name: 'Small business' },
  { id: 'curious', name: 'Just curious' },
];

export const roleName = (id: RoleId | null) => roles.find((r) => r.id === id)?.name ?? 'Not set';

export const sectorNames: Record<SectorId, string> = {
  health: 'Health',
  finance: 'Finance',
  government: 'Government',
  technology: 'Technology',
  energy: 'Energy',
  telecom: 'Telecom',
  manufacturing: 'Manufacturing',
  education: 'Education',
  retail: 'Retail',
  transport: 'Transport',
};

/** Short names where a cell is too narrow for the full one. */
export const sectorShort: Partial<Record<SectorId, string>> = {
  government: 'Gov',
  technology: 'Tech',
  manufacturing: 'Mfg',
};

/** Who gets hit, in plain words. Used for plain notification copy. */
export const sectorPeople: Record<SectorId, string> = {
  health: 'hospitals',
  finance: 'banks',
  government: 'government offices',
  technology: 'tech companies',
  energy: 'energy companies',
  telecom: 'phone and internet providers',
  manufacturing: 'factories',
  education: 'schools and universities',
  retail: 'shops',
  transport: 'transport companies',
};

export const sectorOrder: SectorId[] = [
  'finance',
  'health',
  'energy',
  'government',
  'technology',
  'manufacturing',
  'retail',
  'education',
  'telecom',
  'transport',
];

export const regionNames: Record<RegionId, { full: string; medium: string; short: string }> = {
  nam: { full: 'North America', medium: 'N. America', short: 'N. AM' },
  europe: { full: 'Europe', medium: 'Europe', short: 'EUROPE' },
  apac: { full: 'APAC', medium: 'APAC', short: 'APAC' },
  mea: { full: 'Middle East & Africa', medium: 'MEA', short: 'MEA' },
  latam: { full: 'Latin America', medium: 'LATAM', short: 'LATAM' },
};

export const regionOrder: RegionId[] = ['nam', 'europe', 'apac', 'mea', 'latam'];

export const vectorNames: Record<VectorId, string> = {
  ransomware: 'Ransomware',
  exploitation: 'Exploitation',
  supply: 'Supply chain',
  phishing: 'Phishing',
  ddos: 'DDoS',
  insider: 'Insider / other',
};

export const vectorOrder: VectorId[] = ['ransomware', 'exploitation', 'supply', 'phishing', 'ddos', 'insider'];

export const eventTypes: Record<
  EventType,
  { label: string; chip: string; mix: string; color: string; vector: VectorId }
> = {
  ransomware: { label: 'RANSOMWARE', chip: 'Ransomware', mix: 'RANSOM', color: bandColor.b5, vector: 'ransomware' },
  exploit: { label: 'EXPLOIT', chip: 'Exploits', mix: 'EXPLOIT', color: palette.ember, vector: 'exploitation' },
  phishing: { label: 'PHISHING', chip: 'Phishing', mix: 'PHISH', color: bandColor.b2, vector: 'phishing' },
  ddos: { label: 'DDOS', chip: 'DDoS', mix: 'DDOS', color: bandColor.b3, vector: 'ddos' },
  supply: { label: 'SUPPLY CHAIN', chip: 'Supply chain', mix: 'SUPPLY', color: palette.mute, vector: 'supply' },
  breach: { label: 'BREACH', chip: 'Breaches', mix: 'BREACH', color: bandColor.b1, vector: 'insider' },
};

export const eventTypeOrder: EventType[] = ['ransomware', 'exploit', 'phishing', 'ddos', 'supply', 'breach'];
