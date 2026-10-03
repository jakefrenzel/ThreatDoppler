import { type ReactNode } from 'react';
import { Animated, Platform, RefreshControl, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { useColors } from '@/theme/ColorsProvider';
import { TAB_BAR_CLEARANCE, palette } from '@/theme/tokens';
import { Glow, glows, type GlowSpec } from './Glow';
import { RadarMark } from './RadarMark';

interface Props {
  children: ReactNode;
  glow?: GlowSpec | null;
  background?: string;
  /** Leave room for the floating tab bar. */
  tabBar?: boolean;
  /** Bottom padding when there is no tab bar (onboarding pins its button 44 pt from the bottom). */
  bottom?: number;
  gap?: number;
  /** Pull to refresh with the spinning radar mark in place of the system spinner. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Content drawn outside the scroll view, e.g. a pinned footer. */
  overlay?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  topInset?: boolean;
}

/**
 * Screen chrome: the sky background, safe-area top padding and a scroll view. Screens are
 * designed to fit without scrolling at the default text size; the scroll view only moves
 * when content is taller than the screen (larger Dynamic Type sizes).
 */
export function Screen({
  children,
  glow = glows.sky,
  background,
  tabBar = false,
  bottom = 24,
  gap = 10,
  refreshing = false,
  onRefresh,
  overlay,
  contentStyle,
  topInset = true,
}: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const scrollY = useAnimatedValue(0);
  const top = topInset ? Math.max(insets.top, 20) : 0;

  const pull = scrollY.interpolate({ inputRange: [-70, -10, 0], outputRange: [1, 0, 0], extrapolate: 'clamp' });

  return (
    <View style={[styles.root, { backgroundColor: background ?? c.bg }]}>
      {glow && <Glow spec={glow} />}
      {onRefresh && (
        <Animated.View
          pointerEvents="none"
          style={[styles.pull, { top: top + 6, opacity: refreshing ? 1 : pull }]}
        >
          <RadarMark size={28} spinning={refreshing} />
        </Animated.View>
      )}
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={[
          {
            flexGrow: 1,
            gap,
            paddingTop: top,
            paddingBottom: tabBar ? TAB_BAR_CLEARANCE : bottom,
          },
          contentStyle,
        ]}
        alwaysBounceVertical={!!onRefresh}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onRefresh ? Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }) : undefined}
        refreshControl={
          onRefresh && Platform.OS !== 'web' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="transparent"
              colors={[palette.ember]}
              progressBackgroundColor={palette.sheet}
            />
          ) : undefined
        }
      >
        {children}
      </Animated.ScrollView>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  pull: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1 },
});
