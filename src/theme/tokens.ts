// Design tokens from the handoff (README "Design tokens").

export const palette = {
  bg: '#110E0D',
  page: '#0A0807',
  sheet: '#171311',
  backdrop: '#070605',
  card: 'rgba(255,244,235,0.055)',
  card2: 'rgba(255,244,235,0.10)',
  line: 'rgba(255,244,235,0.10)',
  ink: '#F6EFE8',
  mute: '#A99F97',
  dim: '#6F6660',
  ember: '#FF6B35',
  emberSoft: 'rgba(255,107,53,0.16)',
  emberLine: 'rgba(255,107,53,0.4)',
  emberLineStrong: 'rgba(255,107,53,0.45)',
  onEmber: '#1A0E09',
  body: '#D6CDC6',
  track: 'rgba(255,244,235,0.08)',
  toggleOff: 'rgba(255,244,235,0.16)',
  tabBar: 'rgba(36,29,26,0.8)',
  segmentTrack: 'rgba(255,244,235,0.06)',
  iconTileLine: 'rgba(255,244,235,0.12)',
  // Bands: Low, Guarded, Elevated, High, Severe.
  b1: '#7F9C86',
  b2: '#CDB97E',
  b3: '#F2A65A',
  b4: '#FF6B35',
  b5: '#E8364A',
};

export type Palette = typeof palette;

// Increase Contrast: raise --line to .2, --card to .09, swap --dim text for --mute.
export const highContrastPalette: Palette = {
  ...palette,
  card: 'rgba(255,244,235,0.09)',
  line: 'rgba(255,244,235,0.20)',
  dim: palette.mute,
};

export type BandKey = 'low' | 'guarded' | 'elevated' | 'high' | 'severe';

export interface Band {
  key: BandKey;
  name: string;
  min: number;
  color: string;
}

export const bands: Band[] = [
  { key: 'low', name: 'Low', min: 0, color: palette.b1 },
  { key: 'guarded', name: 'Guarded', min: 25, color: palette.b2 },
  { key: 'elevated', name: 'Elevated', min: 50, color: palette.b3 },
  { key: 'high', name: 'High', min: 70, color: palette.b4 },
  { key: 'severe', name: 'Severe', min: 85, color: palette.b5 },
];

export const bandColor = { b1: palette.b1, b2: palette.b2, b3: palette.b3, b4: palette.b4, b5: palette.b5 };

export function bandFor(score: number): Band {
  for (let i = bands.length - 1; i >= 0; i--) {
    if (score >= bands[i].min) return bands[i];
  }
  return bands[0];
}

// Heat gradient: linear-gradient(90deg,#7F9C86 0%,#CDB97E 25%,#F2A65A 50%,#FF6B35 70%,#E8364A 88%)
export const heatStops: [number, string][] = [
  [0, '#7F9C86'],
  [0.25, '#CDB97E'],
  [0.5, '#F2A65A'],
  [0.7, '#FF6B35'],
  [0.88, '#E8364A'],
];

export const fonts = {
  sans: {
    400: 'SpaceGrotesk_400Regular',
    500: 'SpaceGrotesk_500Medium',
    600: 'SpaceGrotesk_600SemiBold',
  },
  mono: {
    400: 'JetBrainsMono_400Regular',
    500: 'JetBrainsMono_500Medium',
    600: 'JetBrainsMono_600SemiBold',
  },
} as const;

export type Weight = 400 | 500 | 600;

export const radius = {
  heat: 7,
  chip: 12,
  row: 14,
  tile: 16,
  tileLg: 18,
  group: 20,
  card: 24,
  button: 28,
  tabBar: 32,
  sheet: 34,
};

export const space = {
  screenGap: 10,
  cardMargin: 14,
  headerPad: 20,
};

export const shadows = {
  tabBar: '0px 14px 34px rgba(0,0,0,0.5)',
  knob: '0px 0px 0px 4px rgba(255,107,53,0.35), 0px 4px 12px rgba(0,0,0,0.5)',
  toggleKnob: '0px 2px 6px rgba(0,0,0,0.3)',
};

export const TAB_BAR = { height: 64, bottom: 30, side: 16 };
// Space reserved under scrolling content so the floating tab bar never covers it.
export const TAB_BAR_CLEARANCE = TAB_BAR.height + TAB_BAR.bottom + 12;
