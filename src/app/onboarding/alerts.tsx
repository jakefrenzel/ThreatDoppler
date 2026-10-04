import { View } from 'react-native';

import { PrimaryButton, SelectableRow, ToggleRow } from '@/components/controls';
import { BandDot } from '@/components/data';
import { glows } from '@/components/Glow';
import { SectionLabel } from '@/components/layout';
import { OnboardingFooter, OnboardingHeader, SummaryCard } from '@/components/Onboarding';
import { Screen } from '@/components/Screen';
import { Mono } from '@/components/T';
import { useCopy } from '@/copy/wording';
import { regionNames, sectorNames } from '@/data/catalog';
import { expectedAlerts, levelVolume } from '@/lib/alerts';
import { joinUpper } from '@/lib/format';
import { useOnboardingNav } from '@/lib/onboarding';
import { usePrefs, type AlertLevel } from '@/state/store';
import { useColors } from '@/theme/ColorsProvider';
import { bandColor } from '@/theme/tokens';

const levels: { value: AlertLevel; label: string; hint: string; color: string }[] = [
  { value: 'severe', label: 'Severe only', hint: `85+ · ~${levelVolume.severe} A MONTH`, color: bandColor.b5 },
  { value: 'high', label: 'High or worse', hint: `75+ · ~${levelVolume.high} A MONTH`, color: bandColor.b4 },
  { value: 'any', label: 'Any level change', hint: `~${levelVolume.any} A MONTH`, color: bandColor.b3 },
];

/** 02a Onboarding · Alert defaults */
export default function AlertsStep() {
  const c = useColors();
  const copy = useCopy();
  const nav = useOnboardingNav();
  const level = usePrefs((s) => s.alertLevel);
  const extras = usePrefs((s) => s.extras);
  const sectors = usePrefs((s) => s.sectors);
  const regions = usePrefs((s) => s.regions);
  const quiet = usePrefs((s) => s.quietHours);
  const set = usePrefs((s) => s.set);
  const setExtra = usePrefs((s) => s.setExtra);

  const onCount = Object.values(extras).filter(Boolean).length;
  const expected = expectedAlerts(level, extras, sectors.length > 0);
  const sectorList = sectors.length ? joinUpper(sectors.map((s) => sectorNames[s])) : 'NO SECTORS PICKED';
  const regionList = regions.length ? joinUpper(regions.map((r) => regionNames[r].medium)) : 'ALL REGIONS';

  return (
    <Screen glow={glows.onboarding} gap={0} bottom={44}>
      <OnboardingHeader
        step={3}
        eyebrow="STEP 3 OF 4 · ALERTS"
        title="When should we tell you?"
        body="Pick a starting point. You can change every rule later in Alerts."
        onSkip={nav.skip}
      />
      <SectionLabel left="ALERT ME WHEN THE INDEX IS" right="PICK ONE" style={{ paddingTop: 20 }} />
      <View accessibilityRole="radiogroup" style={{ gap: 6, paddingHorizontal: 16 }}>
        {levels.map((l) => {
          const on = level === l.value;
          return (
            <SelectableRow
              key={l.value}
              label={l.label}
              selected={on}
              onPress={() => set('alertLevel', l.value)}
              leading={<BandDot color={l.color} size={8} />}
              trailing={
                <Mono size={11} tracking={0} color={on ? c.ember : c.mute}>
                  {l.hint}
                </Mono>
              }
            />
          );
        })}
      </View>
      <SectionLabel left="ALSO TELL ME ABOUT" right={`${onCount} ON`} style={{ paddingTop: 18 }} />
      <View
        style={{
          marginHorizontal: 16,
          paddingVertical: 2,
          paddingHorizontal: 14,
          borderRadius: 20,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.line,
        }}
      >
        <ToggleRow
          first
          label={copy.L.extraSectorJumps}
          sub={copy.L.extraSectorJumpsSub(sectorList)}
          value={extras.sectorJumps}
          onChange={(v) => setExtra('sectorJumps', v)}
        />
        <ToggleRow
          label={copy.L.extraFlaws}
          sub={`IN YOUR REGIONS · ${regionList}`}
          value={extras.flaws}
          onChange={(v) => setExtra('flaws', v)}
        />
        <ToggleRow label={copy.L.extraMorning} sub="EVERY DAY AT 07:00" value={extras.morning} onChange={(v) => setExtra('morning', v)} />
        <ToggleRow
          label="Quiet hours"
          sub={`${quiet.start}–${quiet.end} · SEVERE STILL COMES THROUGH`}
          value={extras.quietHours}
          onChange={(v) => setExtra('quietHours', v)}
        />
      </View>
      <OnboardingFooter>
        <SummaryCard label="Expected alerts" value={`~${expected}`} note="A MONTH" />
        <PrimaryButton label="Continue" onPress={() => nav.next('/onboarding/notifications')} />
      </OnboardingFooter>
    </Screen>
  );
}
