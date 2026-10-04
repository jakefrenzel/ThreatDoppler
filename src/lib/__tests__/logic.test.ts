import { beforeEach, describe, expect, it } from '@jest/globals';

import { copyFor } from '@/copy/wording';
import { sampleSnapshot } from '@/data/sample';
import { backtest, backtestSeries, expectedAlerts, notificationPreviews, personalIndex, ruleLabel, ruleSub } from '@/lib/alerts';
import { lineChart, movingAverage } from '@/lib/charts';
import { ago, signed, signedInt } from '@/lib/format';
import { threatFor } from '@/lib/threats';
import { defaultPrefs, defaultRules, rulesFromOnboarding, usePrefs } from '@/state/store';
import { bandFor } from '@/theme/tokens';

describe('bands', () => {
  it('uses the handoff thresholds', () => {
    expect([0, 24, 25, 49, 50, 69, 70, 84, 85, 100].map((v) => bandFor(v).name)).toEqual([
      'Low', 'Low', 'Guarded', 'Guarded', 'Elevated', 'Elevated', 'High', 'High', 'Severe', 'Severe',
    ]);
  });
});

describe('format', () => {
  it('signs numbers with a typographic minus', () => {
    expect(signed(6.1)).toBe('+6.1');
    expect(signed(-1)).toBe('−1.0');
    expect(signed(0)).toBe('0.0');
    expect(signed(-0.04)).toBe('0.0');
    expect(signedInt(-5)).toBe('−5');
    expect(signedInt(0)).toBe('0');
  });

  it('says how long ago', () => {
    const now = Date.parse('2026-10-04T12:00:00Z');
    expect(ago('2026-10-04T11:59:30Z', now)).toBe('JUST NOW');
    expect(ago('2026-10-04T11:35:00Z', now)).toBe('25 MIN AGO');
    expect(ago('2026-10-04T09:00:00Z', now)).toBe('3H AGO');
    expect(ago('2026-10-02T12:00:00Z', now)).toBe('2 DAYS AGO');
  });
});

describe('wording levels', () => {
  const headline = sampleSnapshot.events[0].headline;

  it('technical uses technical labels and event text', () => {
    const c = copyFor('technical');
    expect(c.L.d24).toBe('Δ24H');
    expect(c.event(headline)).toBe('14 new leak-site victims, 6 healthcare');
  });

  it('plain uses the wording map', () => {
    const c = copyFor('plain');
    expect(c.L.d24).toBe('1 DAY');
    expect(c.L.index('High')).toBe('LEVEL · HIGH');
    expect(c.L.vector).toBe('THREAT TYPE');
    expect(c.event(headline)).toBe('14 more organisations hit by ransomware, 6 hospitals');
  });

  it('standard uses technical labels with plain event text', () => {
    const c = copyFor('standard');
    expect(c.L.ci).toBe('90% CI');
    expect(c.event(headline)).toBe('14 more organisations hit by ransomware, 6 hospitals');
  });
});

describe('alerts', () => {
  it('estimates ~9 a month for the design defaults', () => {
    expect(expectedAlerts('high', defaultPrefs.extras, true)).toBe(9);
    expect(expectedAlerts('severe', { sectorJumps: false, flaws: false, morning: false, quietHours: true }, true)).toBe(1);
  });

  it('back-tests Health above 85 as 2 alerts in 30 days', () => {
    const [health] = backtestSeries(sampleSnapshot, 'sector', ['health']);
    expect(health).toHaveLength(30);
    expect(backtest(health, 'above', 85)).toBe(2);
  });

  it('counts day-on-day jumps', () => {
    expect(backtest([50, 56, 57, 63, 60], 'jump', 5)).toBe(2);
  });

  it('computes the personal index from picked sectors', () => {
    expect(personalIndex(sampleSnapshot, ['finance', 'health', 'energy'])).toBe(76);
    expect(personalIndex(sampleSnapshot, [])).toBeNull();
  });

  it('labels rules for each wording level', () => {
    const [global, health, finance, cve] = defaultRules;
    const tech = copyFor('technical');
    const plain = copyFor('plain');
    expect(ruleLabel(global, tech)).toBe('Global index ≥ 75');
    expect(ruleLabel(health, tech)).toBe('Health ≥ 80');
    expect(ruleLabel(finance, tech)).toBe('Finance moves ±5 in 24h');
    expect(ruleLabel(cve, tech)).toBe('Exploited CVE, CVSS ≥ 9.0');
    expect(ruleLabel(cve, plain)).toBe('Flaws attackers are using now');
    expect(ruleSub(cve)).toBe('VULN · PUSH, SLACK');
  });

  it('turns onboarding picks into rules', () => {
    const rules = rulesFromOnboarding({ ...defaultPrefs, alertLevel: 'severe' });
    expect(rules[0]).toMatchObject({ kind: 'index', condition: 'above', value: 85, global: true });
    expect(rules.find((r) => r.kind === 'digest')?.enabled).toBe(false);
    expect(rules.find((r) => r.kind === 'sector')?.targets).toEqual(defaultPrefs.sectors);
  });

  it('writes plain notification previews from the user scope', () => {
    const [first, second] = notificationPreviews(sampleSnapshot, copyFor('plain'), ['finance', 'health'], ['nam']);
    expect(first.body).toContain('mostly ransomware');
    expect(second.title).toBe('Health jumped to 86');
    expect(second.body).toBe('Attacks on hospitals rose overnight in North America.');
  });
});

describe('charts', () => {
  it('maps the 30-day series onto the design viewBox', () => {
    const chart = lineChart([90, 70, 50], 320, 90, (v) => (90 - v) * 1.8);
    expect(chart.line).toBe('M0 0L160 36L320 72');
    expect(chart.area.endsWith('L320 90L0 90Z')).toBe(true);
  });

  it('computes a trailing moving average', () => {
    expect(movingAverage([4, 8, 12, 16, 20], 4)).toEqual([4, 6, 8, 10, 14]);
  });
});

describe('threat detail', () => {
  it('returns the full report when one exists', () => {
    expect(threatFor(sampleSnapshot, 'edge-vpn')?.detail.iocs).toHaveLength(4);
  });

  it('builds a summary for events without a report', () => {
    const found = threatFor(sampleSnapshot, 'bank-floods');
    expect(found?.detail.title.technical).toBe('Application-layer floods on European banks');
    expect(found?.detail.targeted).toEqual([{ sector: 'finance', share: 100 }]);
  });

  it('returns null for unknown ids', () => {
    expect(threatFor(sampleSnapshot, 'nope')).toBeNull();
  });

  it('ignores inherited object keys in deep links', () => {
    for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(threatFor(sampleSnapshot, id)).toBeNull();
    }
  });
});

describe('redo setup', () => {
  beforeEach(() => {
    usePrefs.setState(defaultPrefs);
  });

  it('keeps rules made in New rule and replaces the ones setup made', () => {
    const { addRule, completeOnboarding } = usePrefs.getState();
    addRule({ kind: 'region', condition: 'jump', targets: ['apac'], value: 7, channels: ['slack'], enabled: true });
    completeOnboarding();

    const { rules } = usePrefs.getState();
    expect(rules[0]).toMatchObject({ kind: 'region', targets: ['apac'], channels: ['slack'], custom: true });
    expect(rules.slice(1).every((r) => !r.custom)).toBe(true);
    // The design's sample rules are gone, swapped for the ones built from the step 3 picks.
    expect(rules.some((r) => r.id === 'r-health')).toBe(false);
    expect(rules).toHaveLength(1 + rulesFromOnboarding(defaultPrefs).length);
  });

  it('does not stack up setup rules when it runs twice', () => {
    const { completeOnboarding } = usePrefs.getState();
    completeOnboarding();
    const once = usePrefs.getState().rules.length;
    completeOnboarding();
    expect(usePrefs.getState().rules).toHaveLength(once);
  });
});
