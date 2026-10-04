import { Pressable, View } from 'react-native';

import { PrimaryButton } from '@/components/controls';
import { glows } from '@/components/Glow';
import { SectionLabel } from '@/components/layout';
import { OnboardingFooter, OnboardingHeader } from '@/components/Onboarding';
import { IconTile } from '@/components/RadarMark';
import { Screen } from '@/components/Screen';
import { Mono, T } from '@/components/T';
import { useCopy } from '@/copy/wording';
import { useSnapshot } from '@/data/SnapshotProvider';
import { expectedAlerts, extraVolume, levelVolume, notificationPreviews } from '@/lib/alerts';
import { requestPushPermission } from '@/lib/notifications';
import { useOnboardingNav } from '@/lib/onboarding';
import { levelThreshold, usePrefs } from '@/state/store';
import { useColors } from '@/theme/ColorsProvider';

/** 02b Onboarding · Notifications. The OS prompt is only ever triggered from this button. */
export default function NotificationsStep() {
  const c = useColors();
  const copy = useCopy();
  const nav = useOnboardingNav();
  const { data } = useSnapshot();
  const prefs = usePrefs();

  const previews = data ? notificationPreviews(data, copy, prefs.sectors, prefs.regions) : [];
  const expected = expectedAlerts(prefs.alertLevel, prefs.extras, prefs.sectors.length > 0);
  const rows: [string, number][] = [[copy.L.levelRow(prefs.alertLevel, levelThreshold[prefs.alertLevel]), levelVolume[prefs.alertLevel]]];
  if (prefs.extras.sectorJumps && prefs.sectors.length) rows.push([copy.L.extraSectorJumps, extraVolume.sectorJumps]);
  if (prefs.extras.flaws) rows.push([copy.L.extraFlaws, extraVolume.flaws]);
  if (prefs.extras.morning) rows.push([copy.L.extraMorning, extraVolume.morning]);

  const allow = async () => {
    const result = await requestPushPermission();
    prefs.set('pushEnabled', result === 'granted');
    nav.finish();
  };
  const notNow = () => {
    prefs.set('pushEnabled', false);
    nav.finish();
  };

  return (
    <Screen glow={glows.onboarding} gap={0} bottom={44}>
      <OnboardingHeader
        step={4}
        eyebrow="STEP 4 OF 4 · NOTIFICATIONS"
        title="Allow notifications?"
        body="We only send the alerts you just picked. This is what they look like."
        onSkip={nav.skip}
      />
      <SectionLabel left="PREVIEW" right="LOCK SCREEN" style={{ paddingTop: 20 }} />
      <View style={{ gap: 6, paddingHorizontal: 16 }}>
        {previews.map((p, i) => (
          <View
            key={p.title}
            accessible
            accessibilityLabel={`Example notification: ${p.title}. ${p.body}`}
            style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 22, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line }}
          >
            <IconTile size={38} radius={10} mark={0.84} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T size={12} color={c.mute}>
                  ThreatDoppler
                </T>
                <T size={12} color={c.mute}>
                  {i === 0 ? 'now' : '2h ago'}
                </T>
              </View>
              <T size={14} weight={600}>
                {p.title}
              </T>
              <T size={13} leading={1.35} color={c.body}>
                {p.body}
              </T>
            </View>
          </View>
        ))}
      </View>
      <SectionLabel left="YOU'LL GET" right={`~${expected} A MONTH`} style={{ paddingTop: 18 }} />
      <View
        style={{
          marginHorizontal: 16,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 20,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.line,
        }}
      >
        {rows.map(([label, n], i) => (
          <View key={label} style={{ flexDirection: 'row', gap: 12, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <T size={13} style={{ flex: 1 }}>
              {label}
            </T>
            <Mono size={11} tracking={0} color={c.mute}>
              {`~${n}`}
            </Mono>
          </View>
        ))}
        {prefs.extras.quietHours && (
          <View style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.line }}>
            <T size={13} color={c.mute}>
              {`Silent ${prefs.quietHours.start}–${prefs.quietHours.end}, except Severe`}
            </T>
          </View>
        )}
      </View>
      <OnboardingFooter>
        <View style={{ gap: 6 }}>
          <PrimaryButton label="Allow notifications" icon="bell" onPress={allow} />
          <Pressable
            onPress={notNow}
            accessibilityRole="button"
            style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <T size={15} weight={500} color={c.mute}>
              Not now
            </T>
          </Pressable>
          <T size={12} color={c.dim} align="center">
            iOS will ask you to confirm. Change this any time in Settings.
          </T>
        </View>
      </OnboardingFooter>
    </Screen>
  );
}
