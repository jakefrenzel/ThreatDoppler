import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { TrendChart } from '@/components/charts';
import { ScrollLockContext } from '@/components/scrollLock';
import { nearestIndex } from '@/lib/charts';

jest.mock('@/lib/haptics', () => ({ selectionTick: jest.fn() }));

const values = [40, 45, 50, 55, 60];
const labels = ['01 OCT', '02 OCT', '03 OCT', '04 OCT', '05 OCT'];

/** The chart's touch surface, laid out 344 wide so screen x matches the viewBox. */
async function chartSurface() {
  const surface = screen.getByTestId('chart-surface');
  await fireEvent(surface, 'layout', { nativeEvent: { layout: { width: 344, height: 90 } } });
  return surface;
}

const touch = (x: number, y = 40) => ({ nativeEvent: { locationX: x, pageX: x, pageY: y } });

/** Text drawn in the chart's SVG, which lives on a content prop rather than as a text child. */
function svgTexts(): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const n = node as { props?: { content?: unknown }; children?: unknown };
    if (typeof n.props?.content === 'string') out.push(n.props.content);
    walk(n.children);
  };
  walk(screen.toJSON());
  return out;
}

describe('chart scrubbing', () => {
  it('finds the nearest point', () => {
    const points: [number, number][] = [[0, 0], [80, 0], [160, 0], [240, 0], [320, 0]];
    expect(nearestIndex(points, 0)).toBe(0);
    expect(nearestIndex(points, 119)).toBe(1);
    expect(nearestIndex(points, 121)).toBe(2);
    expect(nearestIndex(points, 999)).toBe(4);
  });

  it('shows the date and value under the finger, and clears on release', async () => {
    await render(<TrendChart values={values} labels={labels} />);
    const surface = await chartSurface();
    await fireEvent(surface, 'responderGrant', touch(162));
    expect(svgTexts()).toContain('03 OCT · 50.0');
    await fireEvent(surface, 'responderMove', touch(318));
    expect(svgTexts()).toContain('05 OCT · 60.0');
    await fireEvent(surface, 'responderRelease', touch(318));
    expect(svgTexts().filter((s) => s.includes('OCT ·'))).toEqual([]);
  });

  it('locks the page while scrubbing sideways, but lets a vertical swipe scroll', async () => {
    const lockScroll = jest.fn();
    await render(
      <ScrollLockContext.Provider value={lockScroll}>
        <TrendChart values={values} labels={labels} />
      </ScrollLockContext.Provider>,
    );
    const surface = await chartSurface();
    await fireEvent(surface, 'responderGrant', touch(100, 40));
    await fireEvent(surface, 'responderMove', touch(103, 80));
    expect(screen.getByTestId('chart-surface').props.onResponderTerminationRequest()).toBe(true);
    expect(lockScroll).not.toHaveBeenCalled();

    await fireEvent(surface, 'responderMove', touch(160, 82));
    expect(screen.getByTestId('chart-surface').props.onResponderTerminationRequest()).toBe(false);
    expect(lockScroll).toHaveBeenLastCalledWith(true);

    await fireEvent(surface, 'responderRelease', touch(160, 82));
    expect(lockScroll).toHaveBeenLastCalledWith(false);
    expect(lockScroll).toHaveBeenCalledTimes(2);
  });

  it('locks the page for a touch held still before moving, in any direction', async () => {
    const lockScroll = jest.fn();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    await render(
      <ScrollLockContext.Provider value={lockScroll}>
        <TrendChart values={values} labels={labels} />
      </ScrollLockContext.Provider>,
    );
    const surface = await chartSurface();
    await fireEvent(surface, 'responderGrant', touch(100, 40));
    now.mockReturnValue(1_400);
    await fireEvent(surface, 'responderMove', touch(102, 90));
    expect(lockScroll).toHaveBeenLastCalledWith(true);
    await fireEvent(surface, 'responderTerminate', touch(102, 90));
    expect(lockScroll).toHaveBeenLastCalledWith(false);
    now.mockRestore();
  });

  it('treats a quick still tap as a press', async () => {
    const onPress = jest.fn();
    await render(<TrendChart values={values} labels={labels} onPress={onPress} />);
    const surface = await chartSurface();
    await fireEvent(surface, 'responderGrant', touch(100));
    await fireEvent(surface, 'responderRelease', touch(100));
    expect(onPress).toHaveBeenCalledTimes(1);

    await fireEvent(surface, 'responderGrant', touch(100));
    await fireEvent(surface, 'responderMove', touch(200));
    await fireEvent(surface, 'responderRelease', touch(200));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows just the value when there are no dates', async () => {
    await render(<TrendChart values={values} />);
    await fireEvent(await chartSurface(), 'responderGrant', touch(0));
    expect(svgTexts()).toContain('40.0');
  });
});
