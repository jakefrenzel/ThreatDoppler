import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

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

  it('sizes label-sized segments to their own bold label (09, 10), so widths stay put as the selection moves', async () => {
    const ranges = [
      { value: '30D', label: '30D' },
      { value: '1Y', label: '1Y' },
    ];
    await render(<Segmented label="Time range" variant="mono" stretch={false} options={ranges} value="1Y" onChange={() => {}} />);
    for (const [value, width] of [['30D', 24], ['1Y', 16]] as const) {
      await fireEvent(screen.getByTestId(`segment-measure-${value}`, { includeHiddenElements: true }), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width, height: 14 } },
      });
    }
    // Own bold width plus the mono variant's 9 pt padding on each side.
    expect(widthOf('30D')).toBe(42);
    expect(widthOf('1Y')).toBe(34);
  });
});

describe('Segmented highlight', () => {
  const SEGMENT = 100;
  const GAP = 4;
  const xOf = (i: number) => i * (SEGMENT + GAP);
  const INK_TEXT = 'rgba(17, 14, 13, 1)'; // --bg, on the ink highlight
  const MUTE_TEXT = 'rgba(169, 159, 151, 1)';

  const renderWording = (value: (typeof wording)[number]['value']) => (
    <Segmented label="Wording" options={[...wording]} value={value} onChange={() => {}} />
  );

  /** Feeds each segment the layout it would get on a phone, which is what places the highlight. */
  async function layOutSegments(offset = 0) {
    for (const [i, { label }] of wording.entries()) {
      await fireEvent(screen.getByRole('tab', { name: label }), 'layout', {
        nativeEvent: { layout: { x: xOf(i) + offset, y: 0, width: SEGMENT, height: 34 } },
      });
    }
  }

  const highlight = () => {
    const style = StyleSheet.flatten(screen.getByTestId('segment-highlight').props.style);
    return { x: (style.transform as { translateX: number }[])[0].translateX, width: style.width };
  };
  const textColour = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style).color;
  const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('starts under the selected segment without sliding', async () => {
    await render(renderWording('standard'));
    await layOutSegments();
    expect(highlight()).toEqual({ x: xOf(1), width: SEGMENT });
  });

  it('slides to a new selection, and the labels change colour with it', async () => {
    const view = await render(renderWording('plain'));
    await layOutSegments();

    await view.rerender(renderWording('technical'));
    await advance(60);
    const midway = highlight().x;
    expect(midway).toBeGreaterThan(xOf(0));
    expect(midway).toBeLessThan(xOf(2));

    await advance(300);
    expect(highlight().x).toBe(xOf(2));
    // Dark text only where the ink highlight now sits.
    expect(textColour('Technical')).toBe(INK_TEXT);
    expect(textColour('Plain')).toBe(MUTE_TEXT);
    expect(textColour('Standard')).toBe(MUTE_TEXT);
  });

  it('jumps rather than slides when only the layout changes', async () => {
    await render(renderWording('standard'));
    await layOutSegments();
    // E.g. Settings applying equal widths as it opens, or a text size change.
    await layOutSegments(10);
    expect(highlight().x).toBe(xOf(1) + 10);
  });

  it('cross-fades each segment under Reduce Motion instead of sliding', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const view = await render(renderWording('plain'));
    await layOutSegments();
    expect(screen.queryByTestId('segment-highlight')).toBeNull();

    await view.rerender(renderWording('technical'));
    await advance(300);
    expect(textColour('Technical')).toBe(INK_TEXT);
  });
});
