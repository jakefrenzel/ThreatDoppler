import type { HistoryRange, VectorId } from "../../../src/data/types.ts";

/** One day of the index, with the sub-index that contributed most that day. */
export interface IndexDay {
  day: string; // YYYY-MM-DD
  value: number;
  top: VectorId | null;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAY_MS = 86_400_000;

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const month = (day: string) => MONTHS[Number(day.slice(5, 7)) - 1];
const dayMonth = (day: string) => `${day.slice(8, 10)} ${month(day)}`;
const monthYear = (day: string) => `${month(day)} ${day.slice(2, 4)}`;

/** Short titles for a peak until events exist (step 7). */
const PEAK_TITLES: Record<VectorId, string> = {
  ransomware: "Ransomware activity peaked",
  exploitation: "Exploitation activity peaked",
  supply: "Malicious packages peaked",
  phishing: "Phishing email peaked",
  ddos: "DDoS traffic peaked",
  insider: "Breach disclosures peaked",
};

const BANDS: [HistoryRange["timeInBand"][number]["band"], number, number][] = [
  ["low", 0, 25],
  ["guarded", 25, 50],
  ["elevated", 50, 70],
  ["high", 70, 85],
  ["severe", 85, 101],
];

interface Spec {
  key: HistoryRange["key"];
  days: number;
  /** Days averaged into one chart point. */
  bucket: "day" | "week" | "month";
  /** Minimum days between listed peaks, so one episode isn't listed three times. */
  peakGap: number;
  date: (day: string) => string;
  unit: HistoryRange["unit"];
}

const SPECS: Spec[] = [
  { key: "30D", days: 30, bucket: "day", peakGap: 5, date: dayMonth, unit: { technical: "DAILY INDEX", plain: "DAILY LEVEL" } },
  { key: "90D", days: 90, bucket: "day", peakGap: 10, date: dayMonth, unit: { technical: "DAILY INDEX", plain: "DAILY LEVEL" } },
  { key: "1Y", days: 364, bucket: "week", peakGap: 30, date: dayMonth, unit: { technical: "WEEKLY INDEX", plain: "WEEKLY LEVEL" } },
  { key: "5Y", days: 1826, bucket: "month", peakGap: 90, date: monthYear, unit: { technical: "MONTHLY INDEX", plain: "MONTHLY LEVEL" } },
];

/** Chart points: daily values, or averages per week (counting back from the last day) or month. */
function bucketize(days: IndexDay[], bucket: Spec["bucket"]): { first: string; value: number }[] {
  if (bucket === "day") return days.map((d) => ({ first: d.day, value: d.value }));
  const groups = new Map<string, IndexDay[]>();
  const last = Date.parse(days[days.length - 1].day);
  for (const d of days) {
    const key = bucket === "month" ? d.day.slice(0, 7) : String(Math.floor((last - Date.parse(d.day)) / (7 * DAY_MS)));
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups.values()].map((g) => ({ first: g[0].day, value: round1(mean(g.map((d) => d.value))) }));
}

/** Axis labels at the first point of each month (or year for 5Y), at most `max` of them. */
function axis(points: { first: string }[], spec: Spec): HistoryRange["axis"] {
  const n = points.length;
  const at = (i: number) => (n > 1 ? Math.round((i / (n - 1)) * 1000) / 1000 : 0);
  if (spec.bucket === "day" && spec.days <= 30) {
    return [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1]
      .map((i) => ({ at: at(i), label: dayMonth(points[i].first) }));
  }
  const labels: HistoryRange["axis"] = [];
  let previous = "";
  points.forEach((p, i) => {
    const key = spec.key === "5Y" ? p.first.slice(0, 4) : p.first.slice(0, 7);
    if (key === previous) return;
    previous = key;
    const quarterStart = ["01", "04", "07", "10"].includes(p.first.slice(5, 7));
    if (spec.key === "1Y" && !quarterStart) return;
    labels.push({ at: at(i), label: spec.key === "5Y" ? p.first.slice(0, 4) : month(p.first) });
  });
  // The first label often falls on a partial period; keep it only if it isn't crowded.
  return labels.filter((l, i) => i > 0 || labels.length < 2 || labels[1].at - l.at > 0.08);
}

function peaks(days: IndexDay[], spec: Spec): HistoryRange["peaks"] {
  const out: HistoryRange["peaks"] = [];
  const taken: number[] = [];
  const sorted = [...days].sort((a, b) => b.value - a.value);
  for (const d of sorted) {
    const t = Date.parse(d.day);
    if (taken.some((x) => Math.abs(x - t) < spec.peakGap * DAY_MS)) continue;
    taken.push(t);
    const type = d.top ?? "exploitation";
    out.push({ date: spec.date(d.day), title: PEAK_TITLES[type], type, value: Math.round(d.value) });
    if (out.length === 3) break;
  }
  return out;
}

/** History ranges for the app, from daily index values in date order (oldest first). */
export function buildHistory(all: IndexDay[]): HistoryRange[] {
  const ranges: HistoryRange[] = [];
  for (const spec of SPECS) {
    const days = all.slice(-spec.days);
    if (days.length < 2) continue;
    const points = bucketize(days, spec.bucket);
    const series = points.map((p) => p.value);
    const values = days.map((d) => d.value);
    const sorted = [...values].sort((a, b) => a - b);
    const n = values.length;
    const avg = mean(values);
    const last = values[n - 1];

    let peakIndex = 0;
    series.forEach((v, i) => {
      if (v > series[peakIndex]) peakIndex = i;
    });
    const peakValue = Math.round(series[peakIndex]);
    const peakDate = spec.date(points[peakIndex].first);

    const timeInBand = BANDS
      .map(([band, lo, hi]) => ({ band, share: Math.round((values.filter((v) => v >= lo && v < hi).length / n) * 100) }))
      .filter((b) => b.share > 0);

    ranges.push({
      key: spec.key,
      series,
      unit: spec.unit,
      axis: axis(points, spec),
      peak: { index: peakIndex, value: peakValue, label: `${peakValue} · ${peakDate}` },
      stats: {
        average: Math.round(avg),
        median: Math.round(n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2),
        sd: round1(Math.sqrt(mean(values.map((v) => (v - avg) ** 2)))),
        percentile: Math.round((values.filter((v) => v < last).length / n) * 100),
        high: Math.round(sorted[n - 1]),
        low: Math.round(sorted[0]),
        daysAbove70: values.filter((v) => v >= 70).length,
        daysAbove85: values.filter((v) => v >= 85).length,
      },
      timeInBand,
      peaks: peaks(days, spec),
    });
  }
  return ranges;
}
