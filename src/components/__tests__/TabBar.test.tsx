import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';

import { TabBar, tabs } from '@/components/TabBar';

const TAB_WIDTH = 80;
const GAP = 4;
const xOf = (name: string) => tabs.findIndex((t) => t.name === name) * (TAB_WIDTH + GAP);

/** Feeds each tab the layout it would get on a phone, which is what positions the highlight. */
async function layOutTabs() {
  for (const tab of tabs) {
    await fireEvent(screen.getByRole('tab', { name: tab.label }), 'layout', {
      nativeEvent: { layout: { x: xOf(tab.name), y: 0, width: TAB_WIDTH, height: 50 } },
    });
  }
}

const highlightX = () => {
  const style = StyleSheet.flatten(screen.getByTestId('tab-highlight').props.style);
  return (style.transform as { translateX: number }[])[0].translateX;
};

describe('TabBar', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marks the active tab and reports taps', async () => {
    const onSelect = jest.fn();
    await render(<TabBar activeRoute="now" onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: 'Now' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('tab', { name: 'Feed' }).props.accessibilityState).toEqual({ selected: false });

    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    expect(onSelect).toHaveBeenLastCalledWith('feed', false);
    await fireEvent.press(screen.getByRole('tab', { name: 'Now' }));
    expect(onSelect).toHaveBeenLastCalledWith('now', true);
  });

  it('puts the highlight under the active tab, then slides it when the tab changes', async () => {
    const view = await render(<TabBar activeRoute="forecast" onSelect={() => {}} />);
    await layOutTabs();
    // First placement jumps straight there.
    expect(highlightX()).toBe(xOf('forecast'));

    // A change from code (e.g. Settings → Alert rules) slides it too, not just a tap. The slide
    // runs on the native driver, which doesn't write back to props in tests, so check the
    // animation it starts rather than the final position.
    const timing = jest.spyOn(Animated, 'timing');
    await view.rerender(<TabBar activeRoute="alerts" onSelect={() => {}} />);
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: xOf('alerts'), useNativeDriver: true }),
    );
  });

  it('cross-fades instead of sliding under Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<TabBar activeRoute="now" onSelect={() => {}} />);
    await layOutTabs();
    expect(screen.queryByTestId('tab-highlight')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Now' }).props.accessibilityState).toEqual({ selected: true });
  });
});
