import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { palette } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: palette.bg } }}
      tabBar={({ state, navigation }) => {
        const active = state.routes[state.index];
        return (
          <TabBar
            activeRoute={active.name}
            onSelect={(name, isActive) => {
              const route = state.routes.find((r) => r.name === name);
              if (!route) return;
              // Re-tapping the active tab pops its stack back to the top.
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isActive && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
          />
        );
      }}
    >
      <Tabs.Screen name="now" options={{ title: 'Now' }} />
      <Tabs.Screen name="forecast" options={{ title: 'Forecast' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
    </Tabs>
  );
}
