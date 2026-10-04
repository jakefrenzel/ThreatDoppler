// Recomputes scores, then renders the snapshot the app reads and uploads it to the public
// snapshot bucket. Runs hourly. Until every part of the Snapshot is computed, the file is marked
// partial and the app fills the rest from sample data behind a dev flag.
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { IndexSummary, SnapshotFile, VectorId, VectorScore } from "../../../src/data/types.ts";
import { check, runInBackground } from "../_shared/runs.ts";

/** Bump when the file changes in a way old app builds can't read. */
const SCHEMA_VERSION = 1;
/** Version of the method in docs/backend-plan.md, shown in the app as "MODEL x". */
const MODEL = "0.1";
const SOURCES = ["kev", "epss"];

const round1 = (n: number) => Math.round(n * 10) / 10;

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
  check(await admin.rpc("compute_scores"), "compute_scores");

  // Newest first: 28 days of trend plus 90 days of residuals is plenty.
  const days = (check(
    await admin.from("index_daily").select("day, value").order("day", { ascending: false }).limit(120),
    "read index_daily",
  ) ?? []).map((r) => ({ day: r.day as string, value: Number(r.value) })).reverse();
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

  const [weights, scores] = await Promise.all([
    admin.from("vectors").select("id, weight"),
    admin.from("scores_daily").select("vector, day, score").gte("day", days[Math.max(0, days.length - 2)].day),
  ]);
  const vectors: VectorScore[] = [];
  const scoreRows = check(scores, "read scores_daily") ?? [];
  for (const w of check(weights, "read vectors") ?? []) {
    const rows = scoreRows.filter((s) => s.vector === w.id);
    const now = rows.find((s) => s.day === today);
    if (!now) continue;
    const before = rows.find((s) => s.day !== today);
    vectors.push({
      id: w.id as VectorId,
      weight: Number(w.weight),
      score: Number(now.score),
      delta24h: before ? round1(Number(now.score) - Number(before.score)) : 0,
    });
  }

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
