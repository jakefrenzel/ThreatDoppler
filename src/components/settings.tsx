import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useColors } from '@/theme/ColorsProvider';
import { CrossFadeText } from './CrossFadeText';
import { Icon } from './Icon';
import { CircleButton } from './layout';
import { Screen } from './Screen';
import { Mono, T } from './T';

/** Settings-style header: back button, eyebrow and a 22 pt title. */
export function SettingsHeader({ eyebrow, title }: { eyebrow?: string; title: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 4 }}>
      <CircleButton icon="chevronLeft" label="Back" strokeWidth={2} onPress={() => router.back()} />
      <View style={{ flexShrink: 1 }}>
        {/* On 11 the eyebrow names the wording level, so it cross-fades when that changes. */}
        {eyebrow ? (
          <CrossFadeText mono size={11} tracking={0.04} color={c.mute}>
            {eyebrow}
          </CrossFadeText>
        ) : null}
        <T size={22} weight={600} tracking={-0.02} accessibilityRole="header">
          {title}
        </T>
      </View>
    </View>
  );
}

export function GroupLabel({ children }: { children: string }) {
  const c = useColors();
  return (
    <Mono size={10} tracking={0.05} color={c.mute} style={{ paddingTop: 8, paddingHorizontal: 22 }}>
      {children}
    </Mono>
  );
}

export function Group({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginHorizontal: 14, paddingHorizontal: 14, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
      {children}
    </View>
  );
}

/** 44 pt row with a value and a chevron. */
export function NavRow({ label, value, onPress, first }: { label: string; value?: string; onPress: () => void; first?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: 44,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* The label keeps its width; a long value is cut short instead. */}
      <T size={14} weight={500} style={{ flexGrow: 1, flexShrink: 0 }}>
        {label}
      </T>
      {value ? (
        <T size={13} color={c.mute} numberOfLines={1} style={{ flexShrink: 1 }}>
          {value}
        </T>
      ) : null}
      <Icon name="chevronRight" size={16} color={c.dim} />
    </Pressable>
  );
}

/** A pushed settings page with the same chrome (no tab bar). */
export function SettingsPage({ title, eyebrow, children, footer }: { title: string; eyebrow?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Screen gap={8} bottom={28}>
      <SettingsHeader eyebrow={eyebrow} title={title} />
      {children}
      {footer}
    </Screen>
  );
}
