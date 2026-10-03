import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, View } from 'react-native';

import { lightTap } from '@/lib/haptics';
import { useColors } from '@/theme/ColorsProvider';
import { TAB_BAR, palette, shadows } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { T } from './T';

export const tabs: { name: string; label: string; icon: IconName }[] = [
  { name: 'now', label: 'Now', icon: 'activity' },
  { name: 'forecast', label: 'Forecast', icon: 'calendar' },
  { name: 'feed', label: 'Feed', icon: 'rss' },
  { name: 'alerts', label: 'Alerts', icon: 'bell' },
];

interface Props {
  activeRoute: string;
  onSelect: (name: string, isActive: boolean) => void;
}

/** Floating pill tab bar: 64 pt high, 16 pt from the sides, 30 pt from the bottom, blurred. */
export function TabBar({ activeRoute, onSelect }: Props) {
  const c = useColors();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        { left: TAB_BAR.side, right: TAB_BAR.side, bottom: TAB_BAR.bottom, height: TAB_BAR.height, borderColor: c.line },
      ]}
    >
      <View style={styles.clip}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.tabBar }]} />
      </View>
      {tabs.map((tab) => {
        const active = tab.name === activeRoute;
        const color = active ? c.ember : c.mute;
        return (
          <Pressable
            key={tab.name}
            onPress={() => {
              if (!active) lightTap();
              onSelect(tab.name, active);
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && { backgroundColor: c.emberSoft }]}
          >
            <Icon name={tab.icon} size={20} color={color} />
            <T size={11} weight={active ? 600 : 500} color={color} numberOfLines={1}>
              {tab.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 4,
    padding: 6,
    borderRadius: 32,
    borderWidth: 1,
    boxShadow: shadows.tabBar,
  },
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 32, overflow: 'hidden' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 26 },
});
