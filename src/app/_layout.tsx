import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk/400Regular';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PushSync } from '@/components/PushSync';
import { SnapshotProvider } from '@/data/SnapshotProvider';
import { ColorsProvider } from '@/theme/ColorsProvider';
import { palette } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Catches render errors from every route, so one broken screen doesn't take down the app.
export { ErrorScreen as ErrorBoundary } from '@/components/ErrorScreen';

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: palette.bg, card: palette.bg, primary: palette.ember, text: palette.ink, border: palette.line },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });
  const ready = fontsLoaded || !!fontError;

  // The native splash only covers font loading; the animated 00 Splash takes over from there.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ColorsProvider>
        <SnapshotProvider>
          <ThemeProvider value={navTheme}>
            <StatusBar style="light" />
            <PushSync />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
              <Stack.Screen name="index" options={{ animation: 'none' }} />
              <Stack.Screen name="onboarding" options={{ animation: 'fade', animationDuration: 200 }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'fade', animationDuration: 200 }} />
              <Stack.Screen name="threat/[id]" options={{ presentation: 'modal', contentStyle: { backgroundColor: palette.sheet } }} />
              <Stack.Screen name="new-rule" options={{ presentation: 'modal', contentStyle: { backgroundColor: palette.bg } }} />
            </Stack>
          </ThemeProvider>
        </SnapshotProvider>
      </ColorsProvider>
    </SafeAreaProvider>
  );
}
