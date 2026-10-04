import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Pill, Segmented } from '@/components/controls';
import { CrossFadeText } from '@/components/CrossFadeText';

const EMBER = 'rgba(255, 107, 53, 1)';
const CARD = 'rgba(255, 244, 235, 0.055)';

const styleOf = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

describe('selection colour transitions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('a pill fades to ember over 150 ms instead of snapping', async () => {
    const view = await render(<Pill label="APAC" selected={false} onPress={() => {}} />);
    const pill = () => screen.getByRole('checkbox', { name: 'APAC' });
    expect(styleOf(pill()).backgroundColor).toBe(CARD);

    await view.rerender(<Pill label="APAC" selected onPress={() => {}} />);
    await advance(60);
    const midway = styleOf(pill()).backgroundColor;
    expect(midway).not.toBe(CARD);
    expect(midway).not.toBe(EMBER);

    await advance(200);
    expect(styleOf(pill()).backgroundColor).toBe(EMBER);
  });

  it('a segment fades its text colour along with its background', async () => {
    const options = [
      { value: 'plain', label: 'Plain' },
      { value: 'technical', label: 'Technical' },
    ];
    const view = await render(<Segmented label="Wording" options={options} value="plain" onChange={() => {}} />);
    const textColour = () => styleOf(screen.getByText('Technical')).color;
    const before = textColour();

    await view.rerender(<Segmented label="Wording" options={options} value="technical" onChange={() => {}} />);
    await advance(60);
    const midway = textColour();
    await advance(200);
    const after = textColour();

    expect(after).not.toBe(before);
    expect(midway).not.toBe(before);
    expect(midway).not.toBe(after);
  });
});

describe('CrossFadeText', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the new string at once and fades the old one out on top', async () => {
    const view = await render(<CrossFadeText>SOC ANALYST · STANDARD WORDING</CrossFadeText>);
    expect(screen.queryByText('SOC ANALYST · STANDARD WORDING', { includeHiddenElements: true })).toBeTruthy();

    await view.rerender(<CrossFadeText>SOC ANALYST · PLAIN WORDING</CrossFadeText>);
    // Screen readers only get the new string; the old one is still drawn while it fades.
    expect(screen.getByText('SOC ANALYST · PLAIN WORDING')).toBeTruthy();
    expect(screen.queryByText('SOC ANALYST · STANDARD WORDING')).toBeNull();
    expect(screen.queryByText('SOC ANALYST · STANDARD WORDING', { includeHiddenElements: true })).toBeTruthy();

    await advance(400);
    expect(screen.queryByText('SOC ANALYST · STANDARD WORDING', { includeHiddenElements: true })).toBeNull();
  });

  it('does not animate on first render', async () => {
    await render(<CrossFadeText>PROFILE</CrossFadeText>);
    expect(screen.getAllByText('PROFILE', { includeHiddenElements: true })).toHaveLength(1);
  });
});
