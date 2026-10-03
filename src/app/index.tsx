import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RadarMark } from '@/components/RadarMark';
import { Mono } from '@/components/T';
import { Wordmark } from '@/components/Wordmark';
import { useSnapshot } from '@/data/SnapshotProvider';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { usePrefs, usePrefsHydrated } from '@/state/store';
import { useColors } from '@/theme/ColorsProvider';

/** 00 Splash: shown until the first index loads, then onboarding (first launch) or Now. */
export default function Splash() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const hydrated = usePrefsHydrated();
  const { settled } = useSnapshot();
  const fade = useAnimatedValue(1);
  const left = useRef(false);

  useEffect(() => {
    if (!hydrated || !settled || left.current) return;
    left.current = true;
    const onboarded = usePrefs.getState().onboarded;
    Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      router.replace(onboarded ? '/now' : '/onboarding/role');
    });
  }, [hydrated, settled, fade]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Animated.View style={{ flex: 1, alignItems: 'center', opacity: fade }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <RadarMark size={140} spinning />
          <Wordmark size={32} />
        </View>
        <Mono size={11} tracking={0.08} color={c.mute} style={{ paddingBottom: Math.max(56, insets.bottom + 22) }}>
          {"SCANNING TODAY'S THREATS"}
        </Mono>
      </Animated.View>
    </View>
  );
}
