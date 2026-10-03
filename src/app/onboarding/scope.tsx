import { PrimaryButton } from '@/components/controls';
import { glows } from '@/components/Glow';
import { SectionLabel } from '@/components/layout';
import { OnboardingFooter, OnboardingHeader, SummaryCard } from '@/components/Onboarding';
import { RegionPicker, SectorPicker } from '@/components/pickers';
import { Screen } from '@/components/Screen';
import { sectorOrder } from '@/data/catalog';
import { useSnapshot } from '@/data/SnapshotProvider';
import { personalIndex } from '@/lib/alerts';
import { signedInt } from '@/lib/format';
import { useOnboardingNav } from '@/lib/onboarding';
import { usePrefs } from '@/state/store';
import { bandFor } from '@/theme/tokens';

/** 02 Onboarding · Scope */
export default function ScopeStep() {
  const nav = useOnboardingNav();
  const { data } = useSnapshot();
  const sectors = usePrefs((s) => s.sectors);
  const regions = usePrefs((s) => s.regions);

  const list = data?.sectors ?? sectorOrder.map((id) => ({ id, score: NaN }));
  const mine = data ? personalIndex(data, sectors) : null;
  const global = data ? Math.round(data.index.value) : null;

  return (
    <Screen glow={glows.onboarding} gap={0} bottom={44}>
      <OnboardingHeader
        step={2}
        eyebrow="STEP 2 OF 4 · SCOPE"
        title="Set your scope"
        body="Your picks weight the briefing and alerts, and add a personal index next to the global one."
        onSkip={nav.skip}
      />
      <SectionLabel left="SECTORS" right={`${sectors.length} OF 10${data ? ' · TODAY' : ''}`} style={{ paddingTop: 20 }} />
      <SectorPicker sectors={list} />
      <SectionLabel left="REGIONS" right={`${regions.length} OF 5`} style={{ paddingTop: 18 }} />
      <RegionPicker />
      <OnboardingFooter>
        {mine !== null && global !== null ? (
          <SummaryCard
            label="Your index today"
            value={String(mine)}
            note={`${bandFor(mine).name.toUpperCase()} · ${signedInt(mine - global)} VS GLOBAL`}
          />
        ) : global !== null ? (
          <SummaryCard label="Global index today" value={String(global)} note={bandFor(global).name.toUpperCase()} />
        ) : null}
        <PrimaryButton label="Continue" onPress={() => nav.next('/onboarding/alerts')} />
      </OnboardingFooter>
    </Screen>
  );
}
