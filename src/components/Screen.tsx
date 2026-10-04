import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lightTap } from '@/lib/haptics';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { useColors } from '@/theme/ColorsProvider';
import { TAB_BAR_CLEARANCE, palette } from '@/theme/tokens';
import { Glow, glows, type GlowSpec } from './Glow';
import { RadarMark } from './RadarMark';
import { ScrollLockContext } from './scrollLock';

interface Props {
  children: ReactNode;
  glow?: GlowSpec | null;
  background?: string;
  /** Leave room for the floating tab bar. */
  tabBar?: boolean;
  /** Bottom padding when there is no tab bar (onboarding pins its button 44 pt from the bottom). */
  bottom?: number;
  gap?: number;
  /**
   * Pull to refresh. On iOS the radar mark stands in for the system spinner: it spins while
   * the user holds the pull past the threshold, and the refresh starts when they let go.
   */
  onRefresh?: () => void | Promise<void>;
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
  onRefresh,
  overlay,
  contentStyle,
  topInset = true,
}: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const scrollY = useAnimatedValue(0);
  const top = topInset ? Math.max(insets.top, 20) : 0;

  const pull = useMemo(
    () => scrollY.interpolate({ inputRange: [-PULL_THRESHOLD, -10, 0], outputRange: [1, 0, 0], extrapolate: 'clamp' }),
    [scrollY],
  );

  // armed: pulled past the threshold with the finger still down. refreshing: released while
  // armed, until onRefresh settles (and at least MIN_SPIN, so a fast fetch doesn't flicker).
  const [armed, setArmed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Set by a gesture that owns the touch for now (scrubbing a chart).
  const [scrollLocked, setScrollLocked] = useState(false);
  const dragging = useRef(false);
  const armedRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  const setArmedOnce = useCallback((next: boolean) => {
    if (armedRef.current === next) return;
    armedRef.current = next;
    setArmed(next);
    if (next) lightTap();
  }, []);

  const startRefresh = useCallback(() => {
    if (!onRefresh) return;
    setRefreshing(true);
    Promise.all([Promise.resolve(onRefresh()).catch(() => {}), new Promise((r) => setTimeout(r, MIN_SPIN))]).finally(() => {
      if (mounted.current) setRefreshing(false);
    });
  }, [onRefresh]);

  // Hold the content down below the mark while refreshing, then let it slide back up.
  const spacer = useAnimatedValue(0);
  useEffect(() => {
    Animated.timing(spacer, { toValue: refreshing ? HOLD_HEIGHT : 0, duration: 220, useNativeDriver: false }).start();
  }, [refreshing, spacer]);

  // The mark's opacity stays one native-driven node (pull fade + refresh hold). Swapping it
  // for a plain number while refreshing left the view stuck at the last value afterwards,
  // because the reattached node only pushes to native on the next scroll event.
  const hold = useAnimatedValue(0);
  useEffect(() => {
    Animated.timing(hold, { toValue: refreshing ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [refreshing, hold]);
  const markOpacity = useMemo(
    () => Animated.add(pull, hold).interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    [pull, hold],
  );

  const customPull = !!onRefresh && Platform.OS === 'ios';

  // Arm while the finger holds the pull past the threshold; disarm if it goes back up.
  useEffect(() => {
    if (!customPull || refreshing) return;
    const id = scrollY.addListener(({ value }) => {
      if (dragging.current) setArmedOnce(value <= -PULL_THRESHOLD);
    });
    return () => scrollY.removeListener(id);
  }, [customPull, refreshing, scrollY, setArmedOnce]);

  const hasRefresh = !!onRefresh;
  const onScroll = useMemo(
    () =>
      hasRefresh ? Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }) : undefined,
    [hasRefresh, scrollY],
  );

  return (
    <View style={[styles.root, { backgroundColor: background ?? c.bg }]}>
      {glow && <Glow spec={glow} />}
      {onRefresh && (
        <Animated.View
          pointerEvents="none"
          style={[styles.pull, { top: top + 6, opacity: markOpacity }]}
        >
          <RadarMark size={28} spinning={armed || refreshing} />
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
        scrollEnabled={!scrollLocked}
        alwaysBounceVertical={!!onRefresh}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={customPull ? () => void (dragging.current = true) : undefined}
        onScrollEndDrag={
          customPull
            ? () => {
                dragging.current = false;
                if (armedRef.current) {
                  setArmedOnce(false);
                  startRefresh();
                }
              }
            : undefined
        }
        refreshControl={
          // Android can't overscroll, so it keeps the system control (which already waits
          // for release before refreshing).
          onRefresh && Platform.OS === 'android' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={startRefresh}
              tintColor="transparent"
              colors={[palette.ember]}
              progressBackgroundColor={palette.sheet}
            />
          ) : undefined
        }
      >
        {customPull && <Animated.View style={{ height: spacer, marginBottom: -gap }} />}
        <ScrollLockContext.Provider value={setScrollLocked}>{children}</ScrollLockContext.Provider>
      </Animated.ScrollView>
      {overlay}
    </View>
  );
}

/** How far past the top the user pulls before releasing triggers a refresh. */
const PULL_THRESHOLD = 70;
/** Room left above the content for the mark while a refresh runs. */
const HOLD_HEIGHT = 44;
const MIN_SPIN = 600;

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  pull: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1 },
});
