import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '@/theme/ColorsProvider';
import { radius } from '@/theme/tokens';
import { Icon } from './Icon';
import { Mono, T } from './T';

/** Tab-screen header: mono eyebrow over a 22 pt title, with optional controls on the right. */
export function Header({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 10 }}>
      <View style={{ flexShrink: 1 }}>
        <Mono size={11} color={c.mute}>
          {eyebrow}
        </Mono>
        <T size={22} weight={600} tracking={-0.02} accessibilityRole="header">
          {title}
        </T>
      </View>
      {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{right}</View> : null}
    </View>
  );
}

/** 36 pt round button; the hit area is padded to 44 pt. */
export function CircleButton({
  icon,
  onPress,
  label,
  size = 36,
  iconSize = 18,
  strokeWidth = 2.5,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  onPress: () => void;
  label: string;
  size?: number;
  iconSize?: number;
  strokeWidth?: number;
}) {
  const c = useColors();
  const slop = Math.max(0, (44 - size) / 2);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={slop}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.card2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={iconSize} color={c.ink} strokeWidth={strokeWidth} />
    </Pressable>
  );
}

/** Detail-screen header: back button, title and optional controls (09, 10). */
export function BackHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10 }}>
      <CircleButton icon="chevronLeft" label="Back" onPress={onBack} />
      <T size={22} weight={600} tracking={-0.02} accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </T>
      {right}
    </View>
  );
}

/** "Global ▾" style pill in the header. */
export function HeaderPill({ label, onPress, accessibilityLabel }: { label: string; onPress?: () => void; accessibilityLabel?: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: c.card2,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <T size={13} weight={500}>
        {label}
      </T>
      <Icon name="chevronDown" size={14} color={c.ink} />
    </Pressable>
  );
}

export function Card({
  children,
  style,
  padding = [12, 14],
  inset = 14,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: [number, number] | [number, number, number];
  inset?: number;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          marginHorizontal: inset,
          paddingTop: padding[0],
          paddingHorizontal: padding[1],
          paddingBottom: padding[2] ?? padding[0],
          borderRadius: radius.card,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Mono 10 header row with a label on the left and context on the right. */
export function CardHeader({ left, right, style }: { left: string; right?: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, style]}>
      <Mono size={10} tracking={0.05} color={c.mute} style={{ flexShrink: 1 }}>
        {left}
      </Mono>
      {right ? (
        <Mono size={10} tracking={0.05} color={c.mute} align="right">
          {right}
        </Mono>
      ) : null}
    </View>
  );
}

/** Section label above a card or group (padding 20 20 8 in onboarding). */
export function SectionLabel({ left, right, style }: { left: string; right?: string; style?: StyleProp<ViewStyle> }) {
  return <CardHeader left={left} right={right} style={[{ paddingHorizontal: 20, paddingBottom: 8 }, style]} />;
}

/** Hairline-separated rows inside a card. */
export function Row({ children, first, style }: { children: ReactNode; first?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ borderTopWidth: first ? 0 : 1, borderTopColor: c.line }, style]}>{children}</View>;
}
