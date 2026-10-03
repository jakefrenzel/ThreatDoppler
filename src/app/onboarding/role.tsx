import { View } from 'react-native';

import { PrimaryButton, Segmented } from '@/components/controls';
import { glows } from '@/components/Glow';
import { CardHeader, SectionLabel } from '@/components/layout';
import { OnboardingFooter, OnboardingHeader } from '@/components/Onboarding';
import { RolePicker } from '@/components/pickers';
import { Screen } from '@/components/Screen';
import { Mono, T } from '@/components/T';
import { wordingOptions, wordingPreview } from '@/copy/wording';
import { useOnboardingNav } from '@/lib/onboarding';
import { usePrefs } from '@/state/store';
import { useColors } from '@/theme/ColorsProvider';

/** 01 Onboarding · Role and wording */
export default function RoleStep() {
  const c = useColors();
  const nav = useOnboardingNav();
  const wording = usePrefs((s) => s.wording);
  const set = usePrefs((s) => s.set);

  return (
    <Screen glow={glows.onboarding} gap={0} bottom={44}>
      <OnboardingHeader
        step={1}
        eyebrow="STEP 1 OF 4 · ABOUT YOU"
        title="Who are you?"
        body="Pick your role and how you want things worded. The data and screens are the same for everyone."
        onSkip={nav.skip}
      />
      <SectionLabel left="ROLE" right="PICK ONE" style={{ paddingTop: 20 }} />
      <RolePicker />
      <SectionLabel left="WORDING" right="CHANGE ANY TIME" style={{ paddingTop: 18 }} />
      {/* The role never preselects a wording level; the user picks it here. */}
      <Segmented
        label="Wording"
        options={wordingOptions}
        value={wording}
        onChange={(v) => set('wording', v)}
        style={{ marginHorizontal: 16 }}
      />
      <View
        style={{
          marginTop: 10,
          marginHorizontal: 16,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 18,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.line,
        }}
      >
        <CardHeader left="TECHNICAL" right="PLAIN" style={{ paddingVertical: 4 }} />
        {wordingPreview.map(([tech, plain], i) => (
          <View
            key={tech}
            accessible
            accessibilityLabel={`${tech} becomes ${plain}`}
            style={{ flexDirection: 'row', gap: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}
          >
            <Mono size={11} tracking={0} color={c.mute} style={{ flex: 1, paddingVertical: 6 }}>
              {tech}
            </Mono>
            <T size={13} style={{ flex: 1.3, paddingVertical: 6 }}>
              {plain}
            </T>
          </View>
        ))}
      </View>
      <OnboardingFooter>
        <PrimaryButton label="Continue" onPress={() => nav.next('/onboarding/scope')} />
      </OnboardingFooter>
    </Screen>
  );
}
