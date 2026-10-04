import assert from "node:assert/strict";

import { buildHistory, type IndexDay } from "./history.ts";

/** `n` consecutive days ending 2026-10-03, with values from `value(i)`. */
function days(n: number, value: (i: number) => number): IndexDay[] {
  const end = Date.parse("2026-10-03");
  return Array.from({ length: n }, (_, i) => ({
    day: new Date(end - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    value: value(i),
    top: i % 2 ? "ransomware" : "exploitation",
  }));
}

Deno.test("builds every range from five years of days", () => {
  const ranges = buildHistory(days(1830, (i) => 40 + (i % 50)));
  assert.deepEqual(ranges.map((r) => r.key), ["30D", "90D", "1Y", "5Y"]);
  const [d30, d90, y1, y5] = ranges;
  assert.equal(d30.series.length, 30);
  assert.equal(d90.series.length, 90);
  assert.equal(y1.series.length, 52);
  assert.ok(y5.series.length >= 60 && y5.series.length <= 61);
  for (const r of ranges) {
    assert.equal(r.timeInBand.reduce((a, b) => a + b.share, 0) >= 99, true);
    assert.ok(r.axis.every((a, i) => a.at >= 0 && a.at <= 1 && (i === 0 || a.at > r.axis[i - 1].at)));
    assert.equal(r.peak.value, Math.round(Math.max(...r.series)));
  }
});

Deno.test("stats count days, not chart points", () => {
  const [, , y1] = buildHistory(days(364, (i) => (i < 20 ? 90 : 40)));
  assert.equal(y1.stats.daysAbove85, 20);
  assert.equal(y1.stats.daysAbove70, 20);
  assert.equal(y1.stats.high, 90);
  assert.equal(y1.stats.low, 40);
  assert.deepEqual(y1.timeInBand.map((b) => b.band), ["guarded", "severe"]);
});

Deno.test("peaks are spread out and labelled with the top sub-index", () => {
  // Two highs a week apart and one a month later: the 90-day range keeps one of the close pair.
  const values = (i: number) => (i === 10 ? 80 : i === 16 ? 79 : i === 50 ? 75 : 30);
  const [, d90] = buildHistory(days(90, values));
  assert.deepEqual(d90.peaks.map((p) => p.value), [80, 75, 30]);
  assert.equal(d90.peaks[0].type, "exploitation");
  assert.equal(d90.peaks[0].title, "Exploitation activity peaked");
});

Deno.test("a peak takes its event's title and type when there is one", () => {
  const all = days(90, (i) => (i === 40 ? 90 : 30));
  all[40].event = { title: "CISA adds CVE-2026-1 (Acme VPN) to KEV", type: "exploitation" };
  all[40].top = "ransomware";
  const [, d90] = buildHistory(all);
  assert.equal(d90.peaks[0].title, "CISA adds CVE-2026-1 (Acme VPN) to KEV");
  assert.equal(d90.peaks[0].type, "exploitation");
});

Deno.test("skips ranges with too little data", () => {
  assert.deepEqual(buildHistory(days(1, () => 50)).map((r) => r.key), []);
});
