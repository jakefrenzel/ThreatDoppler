// Damped-trend forecasts (Gardner and McKenzie's damped Holt method) with empirical error ranges.
//   level_t = a*y_t + (1-a)*(level_{t-1} + phi*trend_{t-1})
//   trend_t = b*(level_t - level_{t-1}) + (1-b)*phi*trend_{t-1}
//   forecast_{t+h} = level_t + (phi + phi^2 + ... + phi^h) * trend_t
// Parameters are fitted by grid search on one-step errors. The 90% range for each horizon comes
// from the model's own errors at that horizon over the last 180 forecast origins.

export interface Params {
  alpha: number;
  beta: number;
  phi: number;
}

export const HORIZON = 7;
const FIT_DAYS = 365;
const ERROR_ORIGINS = 180;
const ALPHAS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const BETAS = [0.01, 0.05, 0.1, 0.2, 0.3];
const PHIS = [0.8, 0.9, 0.95, 0.98];

const clamp = (v: number) => Math.min(100, Math.max(0, v));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Level and trend after each observation. */
function states(y: number[], p: Params): { level: number; trend: number }[] {
  const out: { level: number; trend: number }[] = [];
  let level = y[0];
  let trend = y.length > 1 ? y[1] - y[0] : 0;
  for (const value of y) {
    const prev = level;
    level = p.alpha * value + (1 - p.alpha) * (prev + p.phi * trend);
    trend = p.beta * (level - prev) + (1 - p.beta) * p.phi * trend;
    out.push({ level, trend });
  }
  return out;
}

function project(s: { level: number; trend: number }, p: Params, h: number): number {
  let damp = 0;
  let f = 1;
  for (let k = 1; k <= h; k++) {
    f *= p.phi;
    damp += f;
  }
  return s.level + damp * s.trend;
}

export function fit(series: number[]): Params {
  const y = series.slice(-FIT_DAYS);
  let best: Params = { alpha: 0.5, beta: 0.1, phi: 0.9 };
  let bestSse = Infinity;
  for (const alpha of ALPHAS) {
    for (const beta of BETAS) {
      for (const phi of PHIS) {
        const p = { alpha, beta, phi };
        const s = states(y, p);
        let sse = 0;
        for (let t = 1; t < y.length; t++) sse += (y[t] - project(s[t - 1], p, 1)) ** 2;
        if (sse < bestSse) [best, bestSse] = [p, sse];
      }
    }
  }
  return best;
}

/** Errors (actual minus forecast) for each horizon, from origins ending `skip` days before the end. */
function errors(y: number[], p: Params, origins: number, skip = 0): number[][] {
  const s = states(y, p);
  const byHorizon: number[][] = Array.from({ length: HORIZON }, () => []);
  const last = y.length - 1 - skip;
  for (let o = Math.max(0, last - HORIZON - origins + 1); o <= last - 1; o++) {
    for (let h = 1; h <= HORIZON && o + h <= last; h++) {
      byHorizon[h - 1].push(y[o + h] - clamp(project(s[o], p, h)));
    }
  }
  return byHorizon;
}

const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
};

export interface Forecast {
  point: number[];
  lo: number[];
  hi: number[];
  /** Mean absolute error over all horizons in the last 180 origins (a backtest). */
  mae: number;
}

/** Forecast of the next 7 values after the series, with 90% ranges. */
export function forecast(series: number[], params = fit(series)): Forecast {
  const s = states(series, params);
  const errs = errors(series, params, ERROR_ORIGINS);
  const point: number[] = [];
  const lo: number[] = [];
  const hi: number[] = [];
  for (let h = 1; h <= HORIZON; h++) {
    const p = clamp(project(s[s.length - 1], params, h));
    point.push(round1(p));
    lo.push(round1(clamp(p + quantile(errs[h - 1], 0.05))));
    hi.push(round1(clamp(p + quantile(errs[h - 1], 0.95))));
  }
  const all = errs.flat();
  const mae = all.length ? round1(all.reduce((a, e) => a + Math.abs(e), 0) / all.length) : 0;
  return { point, lo, hi, mae };
}

/**
 * How often the 90% range contained what happened, over the last `days` forecast origins, each
 * using ranges built only from errors before it. Used to check the method, not by the app.
 */
export function coverage(series: number[], days = 365): number {
  const params = fit(series.slice(0, series.length - days));
  const s = states(series, params);
  let inside = 0;
  let total = 0;
  for (let o = series.length - days; o < series.length - HORIZON; o++) {
    const errs = errors(series.slice(0, o + 1), params, ERROR_ORIGINS);
    for (let h = 1; h <= HORIZON; h++) {
      const p = clamp(project(s[o], params, h));
      const lo = clamp(p + quantile(errs[h - 1], 0.05));
      const hi = clamp(p + quantile(errs[h - 1], 0.95));
      const actual = series[o + h];
      if (actual >= lo && actual <= hi) inside++;
      total++;
    }
  }
  return total ? inside / total : 0;
}
