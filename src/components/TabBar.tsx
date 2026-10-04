import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useReduceMotion } from '@/lib/a11y';
import { lightTap } from '@/lib/haptics';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
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

const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
/** The highlight's slide between tabs. The screen switches at once; the highlight follows. */
const SLIDE_MS = 200;
/** Icon and label colour, and the Reduce Motion cross-fade (as for segments in the design). */
const FADE_MS = 150;

interface Props {
  activeRoute: string;
  onSelect: (name: string, isActive: boolean) => void;
}

/**
 * Floating pill tab bar: 64 pt high, 16 pt from the sides, 30 pt from the bottom, blurred. The
 * ember highlight slides to the active tab, whether it was tapped or changed from code; under
 * Reduce Motion it cross-fades between tabs instead.
 */
export function TabBar({ activeRoute, onSelect }: Props) {
  const c = useColors();
  const reduceMotion = useReduceMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const slide = useAnimatedValue(0);
  const placed = useRef(false);

  const target = layouts[activeRoute];
  const targetX = target?.x;
  useEffect(() => {
    if (targetX === undefined) return;
    // The first placement (and any move under Reduce Motion, where the pill isn't shown) jumps.
    if (!placed.current || reduceMotion) {
      placed.current = true;
      slide.setValue(targetX);
      return;
    }
    const move = Animated.timing(slide, { toValue: targetX, duration: SLIDE_MS, easing: EASE_OUT, useNativeDriver: true });
    move.start();
    return () => move.stop();
  }, [targetX, reduceMotion, slide]);

  const onTabLayout = (name: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => (prev[name]?.x === x && prev[name]?.width === width ? prev : { ...prev, [name]: { x, width } }));
  };

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
      {/* No padding or border here, so the pill and the tabs' measured x share one origin. */}
      <View style={styles.row}>
        {!reduceMotion && target && (
          <Animated.View
            testID="tab-highlight"
            pointerEvents="none"
            style={[styles.highlight, { width: target.width, backgroundColor: c.emberSoft, transform: [{ translateX: slide }] }]}
          />
        )}
        {tabs.map((tab) => {
          const active = tab.name === activeRoute;
          return (
            <Tab
              key={tab.name}
              tab={tab}
              active={active}
              reduceMotion={reduceMotion}
              onLayout={onTabLayout(tab.name)}
              onPress={() => {
                if (!active) lightTap();
                onSelect(tab.name, active);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function Tab({
  tab,
  active,
  reduceMotion,
  onLayout,
  onPress,
}: {
  tab: (typeof tabs)[number];
  active: boolean;
  reduceMotion: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
  onPress: () => void;
}) {
  const c = useColors();
  const on = useAnimatedValue(active ? 1 : 0);
  useEffect(() => {
    const fade = Animated.timing(on, { toValue: active ? 1 : 0, duration: FADE_MS, easing: EASE_OUT, useNativeDriver: true });
    fade.start();
    return () => fade.stop();
  }, [active, on]);
  const off = on.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      style={styles.tab}
    >
      {/* Under Reduce Motion each tab fades its own highlight instead of the pill sliding. */}
      {reduceMotion && <Animated.View style={[styles.fill, { borderRadius: 26, backgroundColor: c.emberSoft, opacity: on }]} />}
      {/* Mute and ember copies cross-fade. Both fill the tab, so the bolder ember label never
          has to fit the mute label's width. */}
      <Animated.View style={[styles.fill, styles.content, { opacity: off }]}>
        <Icon name={tab.icon} size={20} color={c.mute} />
        <T size={11} weight={500} color={c.mute} numberOfLines={1}>
          {tab.label}
        </T>
      </Animated.View>
      <Animated.View style={[styles.fill, styles.content, { opacity: on }]}>
        <Icon name={tab.icon} size={20} color={c.ember} />
        <T size={11} weight={600} color={c.ember} numberOfLines={1}>
          {tab.label}
        </T>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    padding: 6,
    borderRadius: 32,
    borderWidth: 1,
    boxShadow: shadows.tabBar,
  },
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 32, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row', gap: 4 },
  highlight: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 26 },
  tab: { flex: 1, borderRadius: 26 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  content: { alignItems: 'center', justifyContent: 'center', gap: 3 },
});
