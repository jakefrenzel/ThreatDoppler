import { useEffect, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { lightTap } from '@/lib/haptics';
import { useReduceMotion } from '@/lib/a11y';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { useColors } from '@/theme/ColorsProvider';
import { palette, radius, shadows } from '@/theme/tokens';
import { Icon } from './Icon';
import { Mono, T } from './T';

const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);

/** 42 × 26 switch with a sliding 20 pt knob. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const reduceMotion = useReduceMotion();
  const anim = useAnimatedValue(value ? 1 : 0);
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: reduceMotion ? 0 : 150, easing: EASE_OUT, useNativeDriver: false }).start();
  }, [value, anim, reduceMotion]);
  return (
    <Pressable
      onPress={() => {
        lightTap();
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={9}
    >
      <Animated.View
        style={{
          width: 42,
          height: 26,
          padding: 3,
          borderRadius: 13,
          backgroundColor: anim.interpolate({ inputRange: [0, 1], outputRange: [palette.toggleOff, palette.ember] }),
        }}
      >
        <Animated.View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#fff',
            boxShadow: shadows.toggleKnob,
            transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) }],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

/** Label + optional mono sub-line + toggle. Rows are separated by hairlines. */
export function ToggleRow({
  label,
  sub,
  value,
  onChange,
  first,
  labelWeight = 600,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  first?: boolean;
  labelWeight?: 500 | 600;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 9,
        minHeight: 44,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.line,
      }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <T size={14} weight={labelWeight}>
          {label}
        </T>
        {sub ? (
          <Mono size={9} tracking={0} color={c.mute}>
            {sub}
          </Mono>
        ) : null}
      </View>
      <Toggle value={value} onChange={onChange} label={label} />
    </View>
  );
}

/** 18 pt radio: off is a 1.5 pt dim ring, on is filled ember with a check. Decorative. */
export function Radio({ on, size = 18 }: { on: boolean; size?: number }) {
  const c = useColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: on ? c.ember : 'transparent',
        borderWidth: 1.5,
        borderColor: on ? c.ember : c.dim,
      }}
    >
      {on && <Icon name="check" size={size * 0.66} color={palette.onEmber} strokeWidth={3.5} />}
    </View>
  );
}

/** Onboarding selectable row (44 pt, radius 14). */
export function SelectableRow({
  label,
  selected,
  onPress,
  multi,
  leading,
  trailing,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        lightTap();
        onPress();
      }}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected, checked: selected }}
      accessibilityLabel={label}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 44,
          paddingHorizontal: 12,
          borderRadius: radius.row,
          backgroundColor: selected ? c.emberSoft : c.card,
          borderWidth: 1,
          borderColor: selected ? palette.emberLineStrong : c.line,
        },
        style,
      ]}
    >
      <Radio on={selected} />
      {leading}
      <T size={14} weight={500} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
        {label}
      </T>
      {trailing}
    </Pressable>
  );
}

export type SegmentedVariant = 'large' | 'medium' | 'compact' | 'mono';

const segmentStyles: Record<
  SegmentedVariant,
  { pad: number; outer: number; height?: number; inner: number; font: number; padX: number; padY?: number; gap: number; track: 'card' | 'soft'; selected: 'ink' | 'card2' }
> = {
  // 01 wording
  large: { pad: 4, outer: 21, height: 34, inner: 17, font: 13, padX: 8, gap: 4, track: 'card', selected: 'ink' },
  // 11 wording, 12 rule type
  medium: { pad: 3, outer: 17, height: 28, inner: 14, font: 12, padX: 8, gap: 3, track: 'soft', selected: 'ink' },
  // 09 Sectors / Regions
  compact: { pad: 3, outer: 18, inner: 15, font: 12, padX: 12, padY: 6, gap: 0, track: 'card', selected: 'card2' },
  // 10 time range
  mono: { pad: 3, outer: 16, inner: 13, font: 11, padX: 9, padY: 5, gap: 0, track: 'card', selected: 'card2' },
};

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  variant = 'large',
  stretch = true,
  height,
  label,
  style,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  variant?: SegmentedVariant;
  stretch?: boolean;
  height?: number;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const s = segmentStyles[variant];
  const h = height ?? s.height;
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[
        {
          flexDirection: 'row',
          gap: s.gap,
          padding: s.pad,
          borderRadius: s.outer,
          backgroundColor: s.track === 'card' ? c.card : palette.segmentTrack,
          borderWidth: 1,
          borderColor: c.line,
        },
        style,
      ]}
    >
      {options.map((o) => {
        const on = o.value === value;
        const onInk = on && s.selected === 'ink';
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!on) lightTap();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            hitSlop={{ top: 6, bottom: 6 }}
            style={{
              flex: stretch ? 1 : undefined,
              height: h,
              paddingHorizontal: s.padX,
              paddingVertical: s.padY,
              borderRadius: s.inner,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? (onInk ? c.ink : c.card2) : 'transparent',
            }}
          >
            <T
              mono={variant === 'mono'}
              size={s.font}
              weight={on ? 600 : 400}
              color={onInk ? c.bg : on ? c.ink : c.mute}
              numberOfLines={1}
            >
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 34 pt multi-select pill (regions, rule targets). */
export function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        lightTap();
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      hitSlop={{ top: 5, bottom: 5 }}
      style={{
        height: 34,
        paddingHorizontal: 14,
        borderRadius: 17,
        justifyContent: 'center',
        backgroundColor: selected ? c.ember : c.card,
        borderWidth: 1,
        borderColor: selected ? c.ember : c.line,
      }}
    >
      <T size={13} weight={500} color={selected ? palette.onEmber : c.ink} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

/** Feed filter chip with a count. */
export function Chip({ label, count, selected, onPress }: { label: string; count?: number; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      hitSlop={{ top: 6, bottom: 6 }}
      style={{
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: selected ? c.ink : c.card2,
      }}
    >
      <T size={12} weight={selected ? 600 : 400} color={selected ? c.bg : c.ink}>
        {label}
      </T>
      {count !== undefined && (
        <T mono size={12} color={selected ? c.bg : c.ink} style={{ opacity: 0.6 }}>
          {count}
        </T>
      )}
    </Pressable>
  );
}

/** 56 pt Ember button with a round arrow well; scales to .97 with a light haptic. */
export function PrimaryButton({
  label,
  onPress,
  icon = 'arrowRight',
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: 'arrowRight' | 'bell';
  disabled?: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const scale = useAnimatedValue(1);
  const to = (v: number) =>
    Animated.timing(scale, { toValue: v, duration: reduceMotion ? 0 : 100, useNativeDriver: true }).start();
  return (
    <Pressable
      onPress={() => {
        lightTap();
        onPress();
      }}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 56,
          paddingLeft: 24,
          paddingRight: 9,
          borderRadius: radius.button,
          backgroundColor: palette.ember,
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale }],
        }}
      >
        <T size={17} weight={600} color={palette.onEmber}>
          {label}
        </T>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: 'rgba(26,14,9,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={18} color={palette.onEmber} strokeWidth={2.5} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** Small filled ember pill button (New rule, Save, Turn on). */
export function EmberPill({
  label,
  onPress,
  icon,
  disabled,
  size = 13,
}: {
  label: string;
  onPress: () => void;
  icon?: 'plus';
  disabled?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      onPress={() => {
        lightTap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: size >= 14 ? 16 : 14,
        borderRadius: 20,
        backgroundColor: palette.ember,
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      {icon && <Icon name={icon} size={14} color={palette.onEmber} strokeWidth={2.5} />}
      <T size={size} weight={600} color={palette.onEmber} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

/** Neutral pill button (Retry, Show all). */
export function GhostPill({ label, onPress, ink }: { label: string; onPress: () => void; ink?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => ({
        paddingVertical: ink ? 8 : 10,
        paddingHorizontal: ink ? 14 : 18,
        borderRadius: ink ? 16 : 20,
        backgroundColor: ink ? c.ink : c.card2,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <T size={13} weight={600} color={ink ? c.bg : c.ink}>
        {label}
      </T>
    </Pressable>
  );
}

/** Mono label used inside tiles and headers. */
export function Label({ children, color, size = 10 }: { children: string; color?: string; size?: number }) {
  const c = useColors();
  return (
    <Mono size={size} color={color ?? c.mute}>
      {children}
    </Mono>
  );
}
