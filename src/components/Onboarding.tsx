import { Pressable, View } from 'react-native';

import { useColors } from '@/theme/ColorsProvider';
import { Mono, T } from './T';

/** Four-step progress: done/active steps are 22 × 6 ember bars, the rest 6 × 6 dim dots. */
function Progress({ step }: { step: number }) {
  const c = useColors();
  return (
    <View
      style={{ flexDirection: 'row', gap: 6, flex: 1 }}
      accessible
      accessibilityLabel={`Step ${step} of 4`}
    >
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={{ width: i <= step ? 22 : 6, height: 6, borderRadius: 3, backgroundColor: i <= step ? c.ember : c.dim }} />
      ))}
    </View>
  );
}

export function OnboardingHeader({
  step,
  eyebrow,
  title,
  body,
  onSkip,
}: {
  step: number;
  eyebrow: string;
  title: string;
  body: string;
  onSkip?: () => void;
}) {
  const c = useColors();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 20 }}>
        <Progress step={step} />
        {onSkip && (
          <Pressable onPress={onSkip} accessibilityRole="button" accessibilityLabel="Skip setup" hitSlop={12}>
            <T size={14} weight={500} color={c.mute}>
              Skip
            </T>
          </Pressable>
        )}
      </View>
      <View style={{ paddingTop: 16, paddingHorizontal: 20 }}>
        <Mono size={11} tracking={0.08} color={c.ember}>
          {eyebrow}
        </Mono>
        <T size={30} weight={600} leading={1.08} tracking={-0.03} accessibilityRole="header" style={{ marginVertical: 8 }}>
          {title}
        </T>
        <T size={14} leading={1.45} color={c.mute}>
          {body}
        </T>
      </View>
    </View>
  );
}

/** Pinned bottom block (Continue button and summary card). */
export function OnboardingFooter({ children }: { children: React.ReactNode }) {
  return <View style={{ marginTop: 'auto', paddingTop: 16, paddingHorizontal: 16, gap: 10 }}>{children}</View>;
}

/** "Your index today 76 · HIGH · +4 VS GLOBAL" style summary card. */
export function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  const c = useColors();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}, ${note.toLowerCase()}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 18,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <T size={13} color={c.mute}>
        {label}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <T size={22} weight={600}>
          {value}
        </T>
        <Mono size={11} tracking={0} color={c.ember}>
          {note}
        </Mono>
      </View>
    </View>
  );
}
