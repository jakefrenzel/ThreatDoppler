import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Segmented } from '@/components/controls';

const wording = [
  { value: 'plain', label: 'Plain' },
  { value: 'standard', label: 'Standard' },
  { value: 'technical', label: 'Technical' },
] as const;

/** Bold label widths, as a phone would measure them. */
const boldWidths = { plain: 30, standard: 55, technical: 60 };

const widthOf = (name: string) => StyleSheet.flatten(screen.getByRole('tab', { name }).props.style).width;

async function measureLabels() {
  for (const [value, width] of Object.entries(boldWidths)) {
    await fireEvent(screen.getByTestId(`segment-measure-${value}`, { includeHiddenElements: true }), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width, height: 16 } },
    });
  }
}

describe('Segmented widths', () => {
  it('gives every segment the widest label when it is not stretched (11 wording)', async () => {
    await render(<Segmented label="Wording" variant="medium" stretch={false} options={[...wording]} value="plain" onChange={() => {}} />);
    await measureLabels();
    // Widest bold label (60) plus the medium variant's 8 pt padding on each side.
    for (const { label } of wording) expect(widthOf(label)).toBe(76);
  });

  it('leaves stretched controls to flex (01 wording)', async () => {
    await render(<Segmented label="Wording" options={[...wording]} value="plain" onChange={() => {}} />);
    expect(screen.queryByTestId('segment-measure-plain', { includeHiddenElements: true })).toBeNull();
    expect(widthOf('Plain')).toBeUndefined();
  });

  it('keeps label-sized segments where the design has them (09, 10)', async () => {
    await render(
      <Segmented
        label="Time range"
        variant="mono"
        stretch={false}
        options={[
          { value: '30D', label: '30D' },
          { value: '1Y', label: '1Y' },
        ]}
        value="1Y"
        onChange={() => {}}
      />,
    );
    expect(screen.queryByTestId('segment-measure-30D', { includeHiddenElements: true })).toBeNull();
    expect(widthOf('30D')).toBeUndefined();
  });
});
