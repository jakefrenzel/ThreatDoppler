import assert from "node:assert/strict";

import { coverage, fit, forecast, HORIZON } from "./forecast.ts";

/** Deterministic noise, so the tests don't flake. */
function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32 - 0.5;
  };
}

Deno.test("a flat series forecasts flat, with narrow ranges", () => {
  const f = forecast(Array(400).fill(50));
  assert.deepEqual(f.point, Array(HORIZON).fill(50));
  assert.deepEqual(f.lo, f.point);
  assert.deepEqual(f.hi, f.point);
  assert.equal(f.mae, 0);
});

Deno.test("a rising series keeps rising, but damped", () => {
  const f = forecast(Array.from({ length: 400 }, (_, i) => 20 + i * 0.1));
  for (let h = 1; h < HORIZON; h++) assert.ok(f.point[h] >= f.point[h - 1]);
  assert.ok(f.point[0] > 59.9);
});

Deno.test("forecasts and ranges stay on the 0-100 scale", () => {
  const rand = noise(1);
  const f = forecast(Array.from({ length: 400 }, (_, i) => Math.min(100, 90 + i * 0.05 + rand() * 20)));
  for (let h = 0; h < HORIZON; h++) {
    assert.ok(f.lo[h] <= f.point[h] && f.point[h] <= f.hi[h]);
    assert.ok(f.lo[h] >= 0 && f.hi[h] <= 100);
  }
});

Deno.test("fit picks a smooth level for noisy data", () => {
  const rand = noise(7);
  const p = fit(Array.from({ length: 400 }, () => 50 + rand() * 30));
  assert.ok(p.alpha <= 0.3, `alpha ${p.alpha}`);
});

Deno.test("90% ranges contain about 90% of outcomes on a random walk", () => {
  const rand = noise(42);
  const y: number[] = [50];
  for (let i = 1; i < 900; i++) y.push(Math.min(100, Math.max(0, y[i - 1] + rand() * 8)));
  const c = coverage(y, 365);
  assert.ok(c > 0.8 && c < 0.97, `coverage ${c}`);
});
