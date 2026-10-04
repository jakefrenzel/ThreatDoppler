import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { lightTap } from '@/lib/haptics';
import { useReduceMotion } from '@/lib/a11y';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { useColors } from '@/theme/ColorsProvider';
import { palette, radius, shadows } from '@/theme/tokens';
import { Icon } from './Icon';
import { AnimatedT, Mono, T } from './T';

const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The segmented highlight's slide, matching the tab bar. */
const SLIDE_MS = 200;

/**
 * 0 → 1 as `selected` flips, over the design's 150 ms ease-out for selectable rows, pills and
 * segments. Colours can't run on the native driver. It's a fade, not movement, so it stays on
 * under Reduce Motion.
 */
function useSelection(selected: boolean) {
  const progress = useAnimatedValue(selected ? 1 : 0);
  // Only a change fades; on mount the value already matches, so there's nothing to run.
  const last = useRef(selected);
  useEffect(() => {
    if (last.current === selected) return;
    last.current = selected;
    const fade = Animated.timing(progress, { toValue: selected ? 1 : 0, duration: 150, easing: EASE_OUT, useNativeDriver: false });
    fade.start();
    return () => fade.stop();
  }, [selected, progress]);
  return progress;
}

const mix = (progress: Animated.Value, off: string, on: string) => progress.interpolate({ inputRange: [0, 1], outputRange: [off, on] });

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
  const progress = useSelection(on);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: mix(progress, 'transparent', c.ember),
        borderWidth: 1.5,
        borderColor: mix(progress, c.dim, c.ember),
      }}
    >
      <Animated.View style={{ opacity: progress }}>
        <Icon name="check" size={size * 0.66} color={palette.onEmber} strokeWidth={3.5} />
      </Animated.View>
    </Animated.View>
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
  const progress = useSelection(selected);
  return (
    <AnimatedPressable
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
          backgroundColor: mix(progress, c.card, c.emberSoft),
          borderWidth: 1,
          borderColor: mix(progress, c.line, palette.emberLineStrong),
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
    </AnimatedPressable>
  );
}

export type SegmentedVariant = 'large' | 'medium' | 'compact' | 'mono';

const segmentStyles: Record<
  SegmentedVariant,
  {
    pad: number;
    outer: number;
    height?: number;
    inner: number;
    font: number;
    padX: number;
    padY?: number;
    gap: number;
    track: 'card' | 'soft';
    selected: 'ink' | 'card2';
    /** Equal-width segments (a `repeat(n, 1fr)` grid in the design) rather than each sized to its label. */
    equal: boolean;
  }
> = {
  // 01 wording
  large: { pad: 4, outer: 21, height: 34, inner: 17, font: 13, padX: 8, gap: 4, track: 'card', selected: 'ink', equal: true },
  // 11 wording, 12 rule type
  medium: { pad: 3, outer: 17, height: 28, inner: 14, font: 12, padX: 8, gap: 3, track: 'soft', selected: 'ink', equal: true },
  // 09 Sectors / Regions
  compact: { pad: 3, outer: 18, inner: 15, font: 12, padX: 12, padY: 6, gap: 0, track: 'card', selected: 'card2', equal: false },
  // 10 time range
  mono: { pad: 3, outer: 16, inner: 13, font: 11, padX: 9, padY: 5, gap: 0, track: 'card', selected: 'card2', equal: false },
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
  const reduceMotion = useReduceMotion();
  const s = segmentStyles[variant];
  const h = height ?? s.height;
  const ink = s.selected === 'ink';

  // Stretched, flex already makes equal segments. Unstretched, segment widths come from bold copies
  // of the labels (the widest weight) measured outside the layout: equal controls (11 wording) give
  // every segment the widest label, label-sized ones (09, 10) give each its own. Either way a label
  // turning bold is never squeezed and widths don't change with the selection, so the highlight
  // has a fixed place to slide to.
  const measureLabels = !stretch;
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});
  const measured = options.map((o) => labelWidths[o.value]);
  const allMeasured = measureLabels && measured.every((w) => w !== undefined);
  const widest = allMeasured ? Math.max(...measured) : 0;
  const widthOf = (key: string) => (allMeasured ? Math.ceil(s.equal ? widest : labelWidths[key]) + 2 * s.padX : undefined);

  // The highlight slides to the selected segment, as on the tab bar. Under Reduce Motion each
  // segment fades its own highlight instead.
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const sliding = !reduceMotion && options.every((o) => layouts[o.value] !== undefined);
  const slideX = useAnimatedValue(0);
  const slideW = useAnimatedValue(0);
  const placed = useRef(false);
  const lastValue = useRef(value);
  const targetX = layouts[value]?.x;
  const targetW = layouts[value]?.width;
  // A layout effect, so the highlight is in place before the first frame it's drawn.
  useLayoutEffect(() => {
    const selectionChanged = lastValue.current !== value;
    lastValue.current = value;
    if (!sliding || targetX === undefined || targetW === undefined) {
      placed.current = false;
      return;
    }
    // Only a new selection slides. Layout changes (Settings applying equal widths as it opens, a
    // text size change) just move the highlight into place.
    if (!placed.current || !selectionChanged) {
      placed.current = true;
      slideX.setValue(targetX);
      slideW.setValue(targetW);
      return;
    }
    // JS driver: each label's colour is read off the highlight's position below, and colour can't
    // run on the native driver. The slides are short and these screens are light.
    const move = Animated.parallel([
      Animated.timing(slideX, { toValue: targetX, duration: SLIDE_MS, easing: EASE_OUT, useNativeDriver: false }),
      Animated.timing(slideW, { toValue: targetW, duration: SLIDE_MS, easing: EASE_OUT, useNativeDriver: false }),
    ]);
    move.start();
    return () => move.stop();
  }, [sliding, value, targetX, targetW, slideX, slideW]);

  // A label is fully "on" with the highlight over it and fully "off" once the highlight reaches a
  // neighbour, so dark text on the ink highlight only ever shows where the highlight is.
  const labelColour = (index: number) => {
    const at = (i: number) => layouts[options[i].value];
    const self = at(index);
    if (!sliding || !self) return undefined;
    const prevX = index > 0 ? at(index - 1).x : self.x - self.width;
    const nextX = index < options.length - 1 ? at(index + 1).x : self.x + self.width;
    return slideX.interpolate({
      inputRange: [prevX, self.x, nextX],
      outputRange: [c.mute, ink ? c.bg : c.ink, c.mute],
      extrapolate: 'clamp',
    });
  };

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[
        {
          padding: s.pad,
          borderRadius: s.outer,
          backgroundColor: s.track === 'card' ? c.card : palette.segmentTrack,
          borderWidth: 1,
          borderColor: c.line,
        },
        style,
      ]}
    >
      {measureLabels && (
        // Wide enough that no label wraps or truncates while it's measured.
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', top: 0, left: 0, width: 1000, opacity: 0 }}
        >
          {options.map((o) => (
            <T
              key={o.value}
              testID={`segment-measure-${o.value}`}
              mono={variant === 'mono'}
              size={s.font}
              weight={600}
              numberOfLines={1}
              style={{ alignSelf: 'flex-start' }}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                setLabelWidths((prev) => (prev[o.value] === w ? prev : { ...prev, [o.value]: w }));
              }}
            >
              {o.label}
            </T>
          ))}
        </View>
      )}
      {/* No padding or border here, so the highlight and the segments' measured x share one origin. */}
      <View style={{ flexDirection: 'row', gap: s.gap }}>
        {sliding && (
          <Animated.View
            testID="segment-highlight"
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: slideW,
              borderRadius: s.inner,
              backgroundColor: ink ? c.ink : c.card2,
              transform: [{ translateX: slideX }],
            }}
          />
        )}
        {options.map((o, i) => (
          <Segment
            key={o.value}
            label={o.label}
            on={o.value === value}
            variant={variant}
            stretch={stretch}
            width={widthOf(o.value)}
            height={h}
            fill={!sliding}
            colour={labelColour(i)}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setLayouts((prev) => (prev[o.value]?.x === x && prev[o.value]?.width === width ? prev : { ...prev, [o.value]: { x, width } }));
            }}
            onPress={() => {
              if (o.value !== value) lightTap();
              onChange(o.value);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Segment({
  label,
  on,
  variant,
  stretch,
  width,
  height,
  fill,
  colour,
  onLayout,
  onPress,
}: {
  label: string;
  on: boolean;
  variant: SegmentedVariant;
  stretch: boolean;
  width?: number;
  height?: number;
  /** Draw this segment's own highlight (Reduce Motion, or before the sliding one is placed). */
  fill: boolean;
  /** Label colour driven by the sliding highlight; otherwise it fades with the selection. */
  colour?: Animated.AnimatedInterpolation<string>;
  onLayout: (e: LayoutChangeEvent) => void;
  onPress: () => void;
}) {
  const c = useColors();
  const s = segmentStyles[variant];
  const ink = s.selected === 'ink';
  const progress = useSelection(on);
  return (
    <AnimatedPressable
      onPress={onPress}
      onLayout={onLayout}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6 }}
      style={{
        flex: stretch ? 1 : undefined,
        width,
        height,
        paddingHorizontal: s.padX,
        paddingVertical: s.padY,
        borderRadius: s.inner,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: fill ? mix(progress, 'transparent', ink ? c.ink : c.card2) : 'transparent',
      }}
    >
      {/* Weight can't tween, so it switches with the selection while the colour changes. */}
      <AnimatedT
        mono={variant === 'mono'}
        size={s.font}
        weight={on ? 600 : 400}
        color={colour ?? mix(progress, c.mute, ink ? c.bg : c.ink)}
        numberOfLines={1}
      >
        {label}
      </AnimatedT>
    </AnimatedPressable>
  );
}

/** 34 pt multi-select pill (regions, rule targets). */
export function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const progress = useSelection(selected);
  return (
    <AnimatedPressable
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
        backgroundColor: mix(progress, c.card, c.ember),
        borderWidth: 1,
        borderColor: mix(progress, c.line, c.ember),
      }}
    >
      <AnimatedT size={13} weight={500} color={mix(progress, c.ink, palette.onEmber)} numberOfLines={1}>
        {label}
      </AnimatedT>
    </AnimatedPressable>
  );
}

/** Feed filter chip with a count. */
export function Chip({ label, count, selected, onPress }: { label: string; count?: number; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const progress = useSelection(selected);
  const text = mix(progress, c.ink, c.bg);
  return (
    <AnimatedPressable
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
        backgroundColor: mix(progress, c.card2, c.ink),
      }}
    >
      <AnimatedT size={12} weight={selected ? 600 : 400} color={text}>
        {label}
      </AnimatedT>
      {count !== undefined && (
        <AnimatedT mono size={12} color={text} style={{ opacity: 0.6 }}>
          {count}
        </AnimatedT>
      )}
    </AnimatedPressable>
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
export function GhostPill({
  label,
  onPress,
  ink,
  busy,
}: {
  label: string;
  onPress: () => void;
  ink?: boolean;
  /** Working on it: dimmed and not pressable, with the same label so nothing around it moves. */
  busy?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!busy, disabled: !!busy }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => ({
        paddingVertical: ink ? 8 : 10,
        paddingHorizontal: ink ? 14 : 18,
        borderRadius: ink ? 16 : 20,
        backgroundColor: ink ? c.ink : c.card2,
        opacity: busy ? 0.45 : pressed ? 0.75 : 1,
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
