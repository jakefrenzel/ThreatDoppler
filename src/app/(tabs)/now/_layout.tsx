import { Stack } from 'expo-router';

import { palette } from '@/theme/tokens';

/** Now pushes 09 Breakdown and 10 History with the tab bar still showing (as in the design). */
export default function NowStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }} />;
}
