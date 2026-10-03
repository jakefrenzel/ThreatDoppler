import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Lucide-style stroke icons (24 grid, round caps and joins), copied from the design.
export type IconName =
  | 'activity'
  | 'calendar'
  | 'rss'
  | 'bell'
  | 'bellOff'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'x'
  | 'check'
  | 'copy'
  | 'plus'
  | 'arrowRight'
  | 'sliders'
  | 'wifiOff';

interface Props {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color, strokeWidth = 2 }: Props) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {name === 'activity' && <Path {...p} d="M22 12h-4l-3 9L9 3l-3 9H2" />}
      {name === 'calendar' && (
        <>
          <Rect {...p} x={3} y={4} width={18} height={18} rx={3} />
          <Path {...p} d="M16 2v4M8 2v4M3 10h18" />
        </>
      )}
      {name === 'rss' && (
        <>
          <Path {...p} d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
          <Circle {...p} cx={5} cy={19} r={1} />
        </>
      )}
      {name === 'bell' && <Path {...p} d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />}
      {name === 'bellOff' && (
        <Path
          {...p}
          d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7M10.3 21a1.94 1.94 0 0 0 3.4 0M2 2l20 20"
        />
      )}
      {name === 'chevronDown' && <Path {...p} d="m6 9 6 6 6-6" />}
      {name === 'chevronLeft' && <Path {...p} d="m15 18-6-6 6-6" />}
      {name === 'chevronRight' && <Path {...p} d="m9 6 6 6-6 6" />}
      {name === 'x' && <Path {...p} d="M18 6 6 18M6 6l12 12" />}
      {name === 'check' && <Path {...p} d="M20 6 9 17l-5-5" />}
      {name === 'copy' && (
        <>
          <Rect {...p} x={9} y={9} width={13} height={13} rx={2} />
          <Path {...p} d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      )}
      {name === 'plus' && <Path {...p} d="M12 5v14M5 12h14" />}
      {name === 'arrowRight' && <Path {...p} d="M5 12h14M12 5l7 7-7 7" />}
      {name === 'sliders' && (
        <>
          <Path {...p} d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
          <Circle {...p} cx={15} cy={6} r={2} />
          <Circle {...p} cx={9} cy={12} r={2} />
          <Circle {...p} cx={17} cy={18} r={2} />
        </>
      )}
      {name === 'wifiOff' && (
        <Path
          {...p}
          d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2-1.5M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5M2 2l20 20"
        />
      )}
    </Svg>
  );
}
