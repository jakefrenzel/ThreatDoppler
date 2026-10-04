import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { RegionId, RoleId, SectorId, VectorId, Wording } from '@/data/types';

export type Channel = 'push' | 'email' | 'slack';
export type RuleKind = 'index' | 'sector' | 'region' | 'vector' | 'vuln' | 'digest';
export type RuleCondition = 'above' | 'jump' | 'band' | 'daily' | 'weekly';

export interface AlertRule {
  id: string;
  kind: RuleKind;
  condition: RuleCondition;
  /** Sector, region or attack-type ids, depending on kind. */
  targets: (SectorId | RegionId | VectorId)[];
  /** Threshold for "above", jump size for "jump", CVSS floor for "vuln". */
  value: number;
  channels: Channel[];
  enabled: boolean;
  /** The rule driven by the global threshold slider on Alerts. */
  global?: boolean;
  /** Made in New rule. Redo setup keeps these and replaces the rest. */
  custom?: boolean;
}

export type AlertLevel = 'severe' | 'high' | 'any';

export interface Extras {
  sectorJumps: boolean;
  flaws: boolean;
  morning: boolean;
  quietHours: boolean;
}

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface ChannelState {
  email: { connected: boolean; detail: string };
  slack: { connected: boolean; detail: string };
}

export interface Prefs {
  onboarded: boolean;
  role: RoleId | null;
  wording: Wording;
  sectors: SectorId[];
  regions: RegionId[];
  showMyIndex: boolean;
  alertLevel: AlertLevel;
  extras: Extras;
  globalThreshold: number;
  rules: AlertRule[];
  channels: ChannelState;
  /** App-level push preference. Delivery also needs the OS permission. */
  pushEnabled: boolean;
  quietHours: QuietHours;
}

interface Actions {
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  toggleSector: (id: SectorId) => void;
  toggleRegion: (id: RegionId) => void;
  setExtra: (key: keyof Extras, value: boolean) => void;
  setThreshold: (value: number) => void;
  toggleRule: (id: string) => void;
  addRule: (rule: Omit<AlertRule, 'id'>) => void;
  connectChannel: (channel: 'email' | 'slack', detail: string) => void;
  /** Finishes onboarding and turns the step 3 picks into alert rules, keeping rules made in New rule. */
  completeOnboarding: () => void;
  /** Skip: straight to Now with the default settings. */
  skipOnboarding: () => void;
}

export const levelThreshold: Record<AlertLevel, number> = { severe: 85, high: 75, any: 25 };

let counter = 0;
const newId = () => `r${Date.now().toString(36)}${(counter++).toString(36)}`;

// Matches the sample state shown on 07 Alerts.
export const defaultRules: AlertRule[] = [
  { id: 'r-global', kind: 'index', condition: 'above', targets: [], value: 75, channels: ['push', 'email'], enabled: true, global: true },
  { id: 'r-health', kind: 'sector', condition: 'above', targets: ['health'], value: 80, channels: ['push'], enabled: true },
  { id: 'r-finance', kind: 'sector', condition: 'jump', targets: ['finance'], value: 5, channels: ['email'], enabled: true },
  { id: 'r-cve', kind: 'vuln', condition: 'above', targets: [], value: 9, channels: ['push', 'slack'], enabled: true },
  { id: 'r-daily', kind: 'digest', condition: 'daily', targets: [], value: 0, channels: ['email'], enabled: true },
  { id: 'r-weekly', kind: 'digest', condition: 'weekly', targets: [], value: 0, channels: ['email'], enabled: false },
];

export const defaultPrefs: Prefs = {
  onboarded: false,
  role: null,
  wording: 'standard',
  sectors: ['finance', 'health', 'energy'],
  regions: ['nam', 'europe'],
  showMyIndex: true,
  alertLevel: 'high',
  extras: { sectorJumps: true, flaws: true, morning: false, quietHours: true },
  globalThreshold: 75,
  rules: defaultRules,
  channels: {
    email: { connected: true, detail: '2 recipients' },
    slack: { connected: true, detail: '#soc-alerts' },
  },
  pushEnabled: true,
  quietHours: { enabled: true, start: '22:00', end: '06:30' },
};

export function rulesFromOnboarding(prefs: Pick<Prefs, 'alertLevel' | 'extras' | 'sectors' | 'regions'>): AlertRule[] {
  const { alertLevel, extras, sectors, regions } = prefs;
  const rules: AlertRule[] = [
    alertLevel === 'any'
      ? { id: newId(), kind: 'index', condition: 'band', targets: [], value: 0, channels: ['push'], enabled: true }
      : {
          id: newId(),
          kind: 'index',
          condition: 'above',
          targets: [],
          value: levelThreshold[alertLevel],
          channels: ['push'],
          enabled: true,
          global: true,
        },
  ];
  rules.push({ id: newId(), kind: 'sector', condition: 'jump', targets: sectors, value: 5, channels: ['push'], enabled: extras.sectorJumps && sectors.length > 0 });
  rules.push({ id: newId(), kind: 'vuln', condition: 'above', targets: regions, value: 9, channels: ['push'], enabled: extras.flaws });
  rules.push({ id: newId(), kind: 'digest', condition: 'daily', targets: [], value: 0, channels: ['push'], enabled: extras.morning });
  return rules;
}

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export const usePrefs = create<Prefs & Actions>()(
  persist(
    (set, get) => ({
      ...defaultPrefs,
      set: (key, value) => set({ [key]: value } as Partial<Prefs>),
      toggleSector: (id) => set({ sectors: toggle(get().sectors, id) }),
      toggleRegion: (id) => set({ regions: toggle(get().regions, id) }),
      setExtra: (key, value) => set({ extras: { ...get().extras, [key]: value } }),
      setThreshold: (value) =>
        set({
          globalThreshold: value,
          rules: get().rules.map((r) => (r.global ? { ...r, value } : r)),
        }),
      toggleRule: (id) => set({ rules: get().rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) }),
      addRule: (rule) => set({ rules: [{ ...rule, id: newId(), custom: true }, ...get().rules] }),
      connectChannel: (channel, detail) =>
        set({ channels: { ...get().channels, [channel]: { connected: true, detail } } }),
      completeOnboarding: () => {
        const s = get();
        const threshold = s.alertLevel === 'any' ? s.globalThreshold : levelThreshold[s.alertLevel];
        set({
          onboarded: true,
          globalThreshold: threshold,
          rules: [...s.rules.filter((r) => r.custom), ...rulesFromOnboarding(s)],
          quietHours: { ...s.quietHours, enabled: s.extras.quietHours },
        });
      },
      skipOnboarding: () => set({ onboarded: true }),
    }),
    {
      name: 'td.prefs.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { set: _s, toggleSector: _a, toggleRegion: _b, setExtra: _c, setThreshold: _d, toggleRule: _e, addRule: _f, connectChannel: _g, completeOnboarding: _h, skipOnboarding: _i, ...prefs } = s;
        return prefs;
      },
    },
  ),
);

export function usePrefsHydrated() {
  return useSyncExternalStore(
    (onChange) => usePrefs.persist.onFinishHydration(onChange),
    () => usePrefs.persist.hasHydrated(),
  );
}
