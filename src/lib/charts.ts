const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

export interface LineChart {
  points: [number, number][];
  line: string;
  area: string;
}

/** Evenly spaced line + closed area path, as in the design's renderVals(). */
export function lineChart(values: number[], width: number, height: number, y: (v: number) => number): LineChart {
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((v, i) => [i * step, y(v)] as [number, number]);
  const line = 'M' + points.map(([x, yy]) => `${f1(x)} ${f1(yy)}`).join('L');
  return { points, line, area: `${line}L${width} ${height}L0 ${height}Z` };
}

/**
 * Value range for the 30-day trend chart: the design's 40–90, widened to the nearest 10 when
 * values fall outside it (live data can be anywhere from 0 to 100).
 */
export function trendDomain(values: number[]): [number, number] {
  const lo = Math.max(0, Math.min(40, Math.floor(Math.min(...values) / 10) * 10));
  const hi = Math.min(100, Math.max(90, Math.ceil(Math.max(...values) / 10) * 10));
  return [lo, hi];
}

/** The point whose x is nearest to `x` (points in x order). */
export function nearestIndex(points: [number, number][], x: number): number {
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i][0] - x) < Math.abs(points[best][0] - x)) best = i;
  }
  return best;
}

/** Trailing moving average over `window` points. */
export function movingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** Polyline points for a sparkline normalised to its own min/max. */
export function sparkline(values: number[], width: number, height: number, pad = 1): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = values.length - 1 || 1;
  return values
    .map((v, k) => `${f1((k * (width - 2 * pad)) / n + pad)},${f1(height - pad - ((v - min) / span) * (height - 2 * pad))}`)
    .join(' ');
}

export function seriesStats(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return { min, max, mean, sd };
}
