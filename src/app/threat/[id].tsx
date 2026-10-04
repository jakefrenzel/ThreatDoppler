import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glow, glows } from '@/components/Glow';
import { Icon } from '@/components/Icon';
import { Card, CardHeader, CircleButton } from '@/components/layout';
import { Mono, T } from '@/components/T';
import { Tile } from '@/components/data';
import { useCopy } from '@/copy/wording';
import { sectorNames } from '@/data/catalog';
import { useSnapshot } from '@/data/SnapshotProvider';
import { sourceForEvent } from '@/data/sources';
import { lightTap } from '@/lib/haptics';
import { threatFor } from '@/lib/threats';
import { useColors } from '@/theme/ColorsProvider';
import { palette } from '@/theme/tokens';

function binColor(v: number) {
  if (v < 10) return palette.card2;
  if (v < 30) return palette.b2;
  if (v < 60) return palette.b3;
  if (v < 80) return palette.b4;
  return palette.b5;
}

/** 08 Threat detail (modal sheet). */
export default function ThreatDetailSheet() {
  const c = useColors();
  const copy = useCopy();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useSnapshot();
  const found = data && id ? threatFor(data, id) : null;
  // Each source's licence asks for credit (HIBP: a visible link) wherever its data is shown.
  const source = found?.event ? sourceForEvent(found.event.source) : undefined;
  const [done, setDone] = useState<Record<number, boolean>>({});

  const close = () => router.back();

  return (
    <View style={{ flex: 1, backgroundColor: palette.sheet, borderTopLeftRadius: 34, borderTopRightRadius: 34, overflow: 'hidden' }}>
      <Glow spec={glows.sheet} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingHorizontal: 18 }}>
        <View style={{ width: 34 }} />
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.dim }} />
        <CircleButton icon="x" label="Close" size={34} iconSize={16} onPress={close} />
      </View>
      {!found ? (
        <View style={{ padding: 18 }}>
          <T size={15} color={c.mute}>
            This event is no longer in the feed.
          </T>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 10, paddingHorizontal: 18, paddingTop: 10, paddingBottom: insets.bottom + 24 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {found.detail.tags.map((tag) =>
              tag.primary ? (
                <View key={tag.label.technical} style={{ paddingVertical: 4, paddingHorizontal: 11, borderRadius: 12, backgroundColor: c.emberSoft }}>
                  <T size={12} weight={600} color={c.ember}>
                    {copy.label(tag.label)}
                  </T>
                </View>
              ) : (
                <View
                  key={tag.label.technical}
                  style={{ paddingVertical: 4, paddingHorizontal: 11, borderRadius: 12, backgroundColor: c.card2, justifyContent: 'center' }}
                >
                  <Mono size={10} tracking={0} color={c.mute}>
                    {copy.label(tag.label)}
                  </Mono>
                </View>
              ),
            )}
          </View>
          <T size={24} weight={600} leading={1.12} tracking={-0.02} accessibilityRole="header">
            {copy.event(found.detail.title)}
          </T>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {found.detail.stats.map((s) => {
              const mono = s.mono && !copy.isPlain;
              return (
                <Tile
                  key={s.label.technical}
                  highlight={s.highlight}
                  label={copy.label(s.label)}
                  value={copy.label(s.value)}
                  valueSize={mono ? 16 : 18}
                  valueMono={mono}
                  style={{ flexBasis: '31%' }}
                />
              );
            })}
          </View>

          {found.detail.bins.values.length > 0 && (
            <Card inset={0} padding={[10, 14]}>
              <CardHeader left={copy.label(found.detail.bins.title)} right={found.detail.bins.peak} style={{ paddingBottom: 8 }} />
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={`${copy.label(found.detail.bins.title)}, rising over the last 7 days. ${found.detail.bins.peak}`}
                style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 52 }}
              >
                {found.detail.bins.values.map((v, i) => (
                  <View key={i} style={{ flex: 1, height: `${v}%`, borderRadius: 4, backgroundColor: binColor(v) }} />
                ))}
              </View>
            </Card>
          )}

          {found.detail.targeted.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Mono size={9} tracking={0} color={c.mute} style={{ marginRight: 2 }}>
                {copy.L.targeted}
              </Mono>
              {found.detail.targeted.map((t) => (
                <View key={t.sector} style={{ flexDirection: 'row', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12, backgroundColor: c.card2 }}>
                  <T size={12}>{sectorNames[t.sector]}</T>
                  <T mono size={12} color={c.mute}>
                    {`${t.share}%`}
                  </T>
                </View>
              ))}
            </View>
          )}

          {found.detail.iocs.length > 0 && (
            <Card inset={0} padding={[8, 14, 4]}>
              <CardHeader left={copy.L.iocs} right="TAP TO COPY" style={{ paddingBottom: 2 }} />
              {found.detail.iocs.map((ioc) => (
                <Pressable
                  key={ioc.value}
                  onPress={async () => {
                    await Clipboard.setStringAsync(ioc.value).catch(() => {});
                    lightTap();
                    AccessibilityInfo.announceForAccessibility(`Copied ${ioc.kind}`);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${ioc.kind} ${ioc.value}`}
                  accessibilityHint="Copies to the clipboard"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.line }}
                >
                  <Mono size={9} tracking={0} color={c.mute} style={{ width: 62 }}>
                    {ioc.kind}
                  </Mono>
                  <T mono size={12} style={{ flex: 1 }} numberOfLines={1}>
                    {ioc.value}
                  </T>
                  <Icon name="copy" size={14} color={c.mute} />
                </Pressable>
              ))}
            </Card>
          )}

          <View>
            <CardHeader
              left={copy.L.actions}
              right={`${found.detail.actions.filter((_, i) => done[i]).length} OF ${found.detail.actions.length} DONE`}
              style={{ paddingBottom: 2 }}
            />
            {found.detail.actions.map((a, i) => {
              const checked = !!done[i];
              return (
                <Pressable
                  key={a.technical}
                  onPress={() => {
                    lightTap();
                    setDone({ ...done, [i]: !checked });
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, minHeight: 44 }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: checked ? c.ember : 'transparent',
                      borderWidth: checked ? 0 : 2,
                      borderColor: c.ember,
                    }}
                  >
                    {checked && <Icon name="check" size={12} color={palette.onEmber} strokeWidth={3.5} />}
                  </View>
                  <T
                    size={13}
                    leading={1.35}
                    color={checked ? c.mute : c.ink}
                    style={{ flex: 1, textDecorationLine: checked ? 'line-through' : 'none' }}
                  >
                    {copy.label(a)}
                  </T>
                </Pressable>
              );
            })}
          </View>
          {source && (
            <Pressable
              onPress={() => Linking.openURL(source.url)}
              accessibilityRole="link"
              accessibilityLabel={`Source: ${source.name}, ${source.licence}. Opens ${source.url}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}
            >
              <Mono size={10} tracking={0} color={c.mute} style={{ flex: 1 }}>
                {`SOURCE · ${source.name.toUpperCase()} · ${source.url.replace(/^https:\/\/(www\.)?/, '')}`}
              </Mono>
              <Icon name="chevronRight" size={12} color={c.dim} />
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}
