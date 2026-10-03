import { router, useLocalSearchParams, type Href } from 'expo-router';

import { usePrefs } from '@/state/store';

/**
 * Navigation for the 01 → 02 → 02a → 02b flow. "Redo setup" in Settings runs the same
 * screens with `redo=1`, starting from the current values.
 */
export function useOnboardingNav() {
  const { redo } = useLocalSearchParams<{ redo?: string }>();
  const isRedo = redo === '1';

  const next = (path: '/onboarding/scope' | '/onboarding/alerts' | '/onboarding/notifications') =>
    router.push((isRedo ? `${path}?redo=1` : path) as Href);

  const leave = () => {
    if (isRedo) router.dismissTo('/now');
    else router.replace('/now');
  };

  const skip = () => {
    if (isRedo) {
      router.dismissTo('/settings');
      return;
    }
    usePrefs.getState().skipOnboarding();
    router.replace('/now');
  };

  const finish = () => {
    usePrefs.getState().completeOnboarding();
    leave();
  };

  return { isRedo, next, skip, finish };
}
