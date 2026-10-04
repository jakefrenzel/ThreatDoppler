// Renders the snapshot the app reads from the scores compute_scores() wrote (cron, at :15) and
// uploads it to the public snapshot bucket. Runs hourly at :20. Until every part of the Snapshot
// is computed, the file is marked partial and the app fills the rest from sample data behind a dev
// flag.
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AreaScore,
  ForecastDay,
  IndexSummary,
  RegionId,
  SectorId,
  SnapshotFile,
  VectorId,
  VectorScore,
} from "../../../src/data/types.ts";
import { forecast, HORIZON } from "../_shared/forecast.ts";
import { buildHistory, type IndexDay } from "../_shared/history.ts";
import { check, runInBackground } from "../_shared/runs.ts";

/** Bump when the file changes in a way old app builds can't read. */
const SCHEMA_VERSION = 1;
/** Version of the method in docs/backend-plan.md, shown in the app as "MODEL x". */
const MODEL = "0.1";
const SOURCES = ["kev", "epss", "ransomlook", "osv", "hibp", "radar"];

const round1 = (n: number) => Math.round(n * 10) / 10;
const shiftDay = (day: string, by: number) => new Date(Date.parse(day) + by * 86_400_000).toISOString().slice(0, 10);
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Sector and region scores for the latest day, with their last 30 days. Highest first. */
async function areas(admin: SupabaseClient, today: string) {
  const rows = check(
    await admin.from("area_scores_daily").select("kind, area, day, score, top_vector")
      .gt("day", shiftDay(today, -30)).lte("day", today).order("day", { ascending: true }),
    "read area_scores_daily",
  ) ?? [];
  const build = <Id extends string>(kind: string): AreaScore<Id>[] => {
    const byArea = new Map<string, { day: string; score: number; top: VectorId }[]>();
    for (const r of rows.filter((r) => r.kind === kind)) {
      byArea.set(r.area, [...(byArea.get(r.area) ?? []), { day: r.day, score: Number(r.score), top: r.top_vector }]);
    }
    const out: AreaScore<Id>[] = [];
    for (const [area, series] of byArea) {
      const last = series[series.length - 1];
      if (last.day !== today) continue;
      const back = (n: number) => series.find((s) => s.day === shiftDay(today, -n))?.score;
      const scores = series.map((s) => s.score);
      out.push({
        id: area as Id,
        score: last.score,
        delta24h: back(1) === undefined ? 0 : round1(last.score - back(1)!),
        delta7d: back(7) === undefined ? 0 : round1(last.score - back(7)!),
        series7d: scores.slice(-7),
        series30d: scores.slice(-30),
        topVector: last.top,
      });
    }
    return out.sort((a, b) => b.score - a.score);
  };
  return { sectors: build<SectorId>("sector"), regions: build<RegionId>("region") };
}

/**
 * 7-day forecasts for the index and each sub-index from the latest complete day, logged once per
 * day so the error figure can be measured. The app's MAE is the last 30 days' logged error, or the
 * backtest's until 30 logged forecasts have come due.
 */
async function forecasts(admin: SupabaseClient, today: string, index: number[]) {
  const scoreRows: { vector: string; day: string; score: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const page = check(
      await admin.from("scores_daily").select("vector, day, score").gt("day", shiftDay(today, -730))
        .lte("day", today).order("day", { ascending: true }).order("vector").range(from, from + 999),
      "read scores_daily",
    ) ?? [];
    scoreRows.push(...page.map((r) => ({ vector: r.vector, day: r.day, score: Number(r.score) })));
    if (page.length < 1000) break;
  }
  const series = new Map<string, number[]>([["index", index]]);
  for (const r of scoreRows) series.set(r.vector, [...(series.get(r.vector) ?? []), r.score]);

  const made = new Map<string, ReturnType<typeof forecast>>();
  const log: { series: string; made_from: string; horizon: number; target_day: string; point: number; lo: number; hi: number }[] = [];
  for (const [name, values] of series) {
    if (values.length < 200) continue;
    const f = forecast(values);
    made.set(name, f);
    for (let h = 1; h <= HORIZON; h++) {
      log.push({ series: name, made_from: today, horizon: h, target_day: shiftDay(today, h), point: f.point[h - 1], lo: f.lo[h - 1], hi: f.hi[h - 1] });
    }
  }
  check(
    await admin.from("forecasts").upsert(log, { onConflict: "series,made_from,horizon", ignoreDuplicates: true }),
    "log forecasts",
  );

  const idx = made.get("index");
  const days: ForecastDay[] = idx
    ? idx.point.map((point, i) => {
      const name = WEEKDAYS[new Date(`${shiftDay(today, i + 1)}T00:00:00Z`).getUTCDay()];
      const before = i === 0 ? index[index.length - 1] : idx.point[i - 1];
      return { day: name, short: name[0], lo: idx.lo[i], hi: idx.hi[i], point, delta: round1(point - before) };
    })
    : [];

  // Logged index forecasts that have come due in the last 30 days, against what happened.
  const due = check(
    await admin.from("forecasts").select("target_day, point").eq("series", "index")
      .gt("target_day", shiftDay(today, -30)).lte("target_day", today),
    "read forecasts",
  ) ?? [];
  const actual = await admin.from("index_daily").select("day, value").gt("day", shiftDay(today, -30)).lte("day", today);
  const byDay = new Map((check(actual, "read index_daily") ?? []).map((r) => [r.day as string, Number(r.value)]));
  const errors = due.flatMap((f) => (byDay.has(f.target_day) ? [Math.abs(byDay.get(f.target_day)! - Number(f.point))] : []));
  const mae = errors.length >= 30 ? round1(errors.reduce((a, b) => a + b, 0) / errors.length) : idx?.mae ?? 0;

  return {
    forecast: days,
    forecastStats: { mae },
    vectorForecast: [...made].filter(([name]) => name !== "index").map(([id, f]) => ({ id: id as VectorId, values: f.point })),
  };
}

/** Half-width of the 90% range of the index's daily noise around its 28-day trailing mean. */
function noise(values: number[]): number {
  const residuals: number[] = [];
  for (let i = 27; i < values.length; i++) {
    const window = values.slice(i - 27, i + 1);
    residuals.push(values[i] - window.reduce((a, b) => a + b, 0) / window.length);
  }
  if (residuals.length < 28) return 0;
  residuals.sort((a, b) => a - b);
  const at = (q: number) => residuals[Math.round(q * (residuals.length - 1))];
  return round1((at(0.95) - at(0.05)) / 2);
}

async function render(admin: SupabaseClient): Promise<number> {
  const weights = new Map(
    (check(await admin.from("vectors").select("id, weight"), "read vectors") ?? [])
      .map((v) => [v.id as VectorId, Number(v.weight)]),
  );
  // Five years of the index, oldest first. PostgREST returns at most 1000 rows per request.
  const days: IndexDay[] = [];
  for (let from = 0; ; from += 1000) {
    const page = check(
      await admin.from("index_daily").select("day, value, vectors").order("day", { ascending: true })
        .gte("day", new Date(Date.now() - 1830 * 86_400_000).toISOString().slice(0, 10)).range(from, from + 999),
      "read index_daily",
    ) ?? [];
    for (const r of page) {
      // The sub-index that added most to that day's index.
      let top: VectorId | null = null;
      let best = -1;
      for (const [id, score] of Object.entries(r.vectors as Record<string, number>)) {
        const part = Number(score) * (weights.get(id as VectorId) ?? 0);
        if (part > best) [top, best] = [id as VectorId, part];
      }
      days.push({ day: r.day, value: Number(r.value), top });
    }
    if (page.length < 1000) break;
  }
  if (!days.length) throw new Error("index_daily is empty");
  const values = days.map((d) => d.value);
  const at = (back: number) => values[values.length - 1 - back];
  const today = days[days.length - 1].day;

  const index: IndexSummary = {
    value: at(0),
    delta24h: values.length > 1 ? round1(at(0) - at(1)) : 0,
    delta7d: values.length > 7 ? round1(at(0) - at(7)) : 0,
    ci: noise(values.slice(-118)),
  };

  // Same rule as compute_index(): each sub-index shows its latest score from the last 2 days, and
  // its 24-hour change is against the day before that score.
  const scoreRows = check(
    await admin.from("scores_daily").select("vector, day, score").gte("day", shiftDay(today, -3))
      .order("day", { ascending: false }),
    "read scores_daily",
  ) ?? [];
  const vectors: VectorScore[] = [];
  for (const [id, weight] of weights) {
    const rows = scoreRows.filter((s) => s.vector === id);
    const now = rows.find((s) => s.day >= shiftDay(today, -2));
    if (!now) continue;
    const before = rows.find((s) => s.day === shiftDay(now.day, -1));
    vectors.push({
      id,
      weight,
      score: Number(now.score),
      delta24h: before ? round1(Number(now.score) - Number(before.score)) : 0,
    });
  }

  const [area, ahead] = await Promise.all([areas(admin, today), forecasts(admin, today, values)]);

  const sources: Record<string, string | null> = {};
  for (const source of SOURCES) {
    const last = check(
      await admin.from("source_runs").select("finished_at").eq("source", source).eq("status", "ok")
        .order("finished_at", { ascending: false }).limit(1).maybeSingle(),
      "read source_runs",
    );
    sources[source] = last?.finished_at ?? null;
  }

  const generatedAt = new Date().toISOString();
  const file: SnapshotFile = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    partial: true,
    sources,
    snapshot: {
      model: MODEL,
      updatedAt: generatedAt,
      index,
      trend30: values.slice(-30),
      vectors,
      history: buildHistory(days),
      ...area,
      ...ahead,
    },
  };

  const body = JSON.stringify(file);
  check(
    await admin.storage.from("snapshot").upload("v1/latest.json", new Blob([body], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
      cacheControl: "300",
    }),
    "upload latest.json",
  );
  check(await admin.from("snapshots").insert({ schema_version: SCHEMA_VERSION, body: file }), "insert snapshots");
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  check(await admin.from("snapshots").delete().lt("created_at", cutoff), "prune snapshots");
  return 1;
}

export default {
  fetch: withSupabase({ auth: "secret" }, (_req, ctx) =>
    runInBackground(ctx.supabaseAdmin, "render", () => render(ctx.supabaseAdmin))),
};
