import { Text, type TextProps, type TextStyle } from 'react-native';

import { useColors } from '@/theme/ColorsProvider';
import { fonts, type Weight } from '@/theme/tokens';

export interface TProps extends TextProps {
  size?: number;
  weight?: Weight;
  mono?: boolean;
  color?: string;
  /** Letter spacing in em, as in the design. */
  tracking?: number;
  /** Line height as a multiple of the font size. */
  leading?: number;
  align?: TextStyle['textAlign'];
}

/** Text in Space Grotesk (UI and numbers) or JetBrains Mono (labels, timestamps, deltas). Scales with Dynamic Type. */
export function T({ size = 14, weight = 400, mono, color, tracking, leading, align, style, ...rest }: TProps) {
  const c = useColors();
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: (mono ? fonts.mono : fonts.sans)[weight],
          fontSize: size,
          color: color ?? c.ink,
          letterSpacing: tracking !== undefined ? tracking * size : undefined,
          lineHeight: leading !== undefined ? leading * size : undefined,
          textAlign: align,
        },
        style,
      ]}
    />
  );
}

/** Uppercase mono label (9–11 pt, .04–.08em). */
export function Mono({ size = 10, tracking = 0.04, ...rest }: TProps) {
  return <T mono size={size} tracking={tracking} {...rest} />;
}
