import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useReduceMotion } from '@/lib/a11y';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { useColors } from '@/theme/ColorsProvider';
import { palette } from '@/theme/tokens';
import { GhostPill } from './controls';
import { Icon, type IconName } from './Icon';
import { RadarMark } from './RadarMark';
import { Mono, T } from './T';

const SKELETON = 'rgba(255,244,235,0.08)';

/** A skeleton bar. */
export function Bone({ width = '100%', height = 8, radius, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width, height, borderRadius: radius ?? height / 2, backgroundColor: SKELETON }, style]} />;
}

/** Skeleton card with a 6% white shimmer sweeping left to right (1.4 s loop). */
export function SkeletonCard({ children, style, radius = 24 }: { children: ReactNode; style?: StyleProp<ViewStyle>; radius?: number }) {
  const c = useColors();
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const sweep = useAnimatedValue(0);
  useEffect(() => {
    if (reduceMotion || !width) return;
    const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [sweep, reduceMotion, width]);
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[{ borderRadius: radius, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }, style]}
    >
      {children}
      {!reduceMotion && width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { width: width * 0.6, transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.6, width] }) }] },
          ]}
        >
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
                <Stop offset={0} stopColor="#fff" stopOpacity={0} />
                <Stop offset={0.5} stopColor="#fff" stopOpacity={0.06} />
                <Stop offset={1} stopColor="#fff" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#shimmer)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

/** Banner that slides down from under the header (250 ms) and is announced to VoiceOver. */
export function Banner({
  icon,
  title,
  body,
  action,
  tone = 'neutral',
  announce,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
  tone?: 'neutral' | 'ember';
  announce: string;
}) {
  const c = useColors();
  const reduceMotion = useReduceMotion();
  const enter = useAnimatedValue(0);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(announce);
    Animated.timing(enter, { toValue: 1, duration: reduceMotion ? 150 : 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter, announce, reduceMotion]);
  const ember = tone === 'ember';
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{
        marginHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: ember ? 12 : 10,
        paddingLeft: 14,
        paddingRight: 10,
        borderRadius: ember ? 20 : 18,
        backgroundColor: ember ? c.emberSoft : c.card2,
        borderWidth: 1,
        borderColor: ember ? palette.emberLineStrong : c.line,
        opacity: enter,
        transform: reduceMotion ? [] : [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
      }}
    >
      <Icon name={icon} size={ember ? 20 : 18} color={ember ? c.ember : c.mute} />
      <View style={{ flex: 1, gap: ember ? 2 : 1 }}>
        <T size={14} weight={600}>
          {title}
        </T>
        {ember ? (
          <T size={12} leading={1.35} color={c.body}>
            {body}
          </T>
        ) : (
          <Mono size={9} tracking={0} color={c.mute}>
            {body}
          </Mono>
        )}
      </View>
      {action}
    </Animated.View>
  );
}

/** Centred empty state: 64 pt radar mark, a one-line title, a short explanation and a way out. */
export function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  const c = useColors();
  return (
    <View
      style={{
        marginTop: 6,
        marginHorizontal: 14,
        paddingTop: 40,
        paddingHorizontal: 24,
        paddingBottom: 28,
        alignItems: 'center',
        gap: 14,
        borderRadius: 24,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <RadarMark size={64} />
      <T size={18} weight={600} tracking={-0.01} align="center">
        {title}
      </T>
      <T size={13} leading={1.45} color={c.mute} align="center" style={{ maxWidth: 260 }}>
        {body}
      </T>
      <View style={{ marginTop: 4 }}>
        <GhostPill label={action} onPress={onAction} />
      </View>
    </View>
  );
}
