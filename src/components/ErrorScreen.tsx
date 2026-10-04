import { router, type ErrorBoundaryProps } from 'expo-router';
import { View } from 'react-native';

import { palette } from '@/theme/tokens';
import { GhostPill, PrimaryButton } from './controls';
import { RadarMark } from './RadarMark';
import { T } from './T';

/**
 * Shown when a screen throws while rendering. It replaces the root layout, so it can't rely on
 * the providers there (snapshot, safe-area insets); everything is centred and uses the base palette.
 * "Try again" re-renders the same route, which only helps for one-off failures, so going back to
 * Now is the main way out.
 */
export function ErrorScreen({ retry }: ErrorBoundaryProps) {
  const backToNow = () => {
    router.replace('/now');
    retry();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, justifyContent: 'center', padding: 24, gap: 14 }}>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <RadarMark size={64} />
        <T size={22} weight={600} tracking={-0.02} align="center" accessibilityRole="header">
          Something went wrong
        </T>
        <T size={14} leading={1.45} color={palette.mute} align="center" style={{ maxWidth: 300 }}>
          This screen couldn&apos;t be shown. Your settings and alert rules are safe.
        </T>
      </View>
      <View style={{ gap: 10, marginTop: 10 }}>
        <PrimaryButton label="Back to Now" onPress={backToNow} />
        <View style={{ alignItems: 'center' }}>
          <GhostPill label="Try again" onPress={retry} />
        </View>
      </View>
    </View>
  );
}
