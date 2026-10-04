// Loads the day's FIRST EPSS scores from the published CSV (not the API, which is for lookups).
// The file has ~380k rows, so it's streamed and only CVEs above 0.1 or on KEV are kept. Runs daily.
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { BATCH, check, fetchOk, runInBackground } from "../_shared/runs.ts";

const CSV = "https://epss.empiricalsecurity.com/epss_scores-current.csv.gz";
const KEEP_ABOVE = 0.1;

async function* lines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  let rest = "";
  // The DOM typings for DecompressionStream don't line up with ReadableStream<Uint8Array>.
  const gunzip = new DecompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>;
  for await (const chunk of body.pipeThrough(gunzip).pipeThrough(new TextDecoderStream())) {
    const parts = (rest + chunk).split("\n");
    rest = parts.pop() ?? "";
    yield* parts;
  }
  if (rest) yield rest;
}

async function kevIds(admin: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  // PostgREST returns at most 1000 rows per request.
  for (let from = 0; ; from += 1000) {
    const page = check(
      await admin.from("kev_entries").select("cve_id").order("cve_id").range(from, from + 999),
      "read kev_entries",
    );
    for (const row of page ?? []) ids.add(row.cve_id);
    if ((page?.length ?? 0) < 1000) return ids;
  }
}

async function ingest(admin: SupabaseClient): Promise<number> {
  const kev = await kevIds(admin);
  const res = await fetchOk(CSV);
  const it = lines(res.body!);

  // First line: #model_version:v2026.06.15,score_date:2026-10-04T12:00:21Z
  const header = (await it.next()).value ?? "";
  const match = /^#model_version:([^,]+),score_date:(\d{4}-\d{2}-\d{2})/.exec(header);
  if (!match) throw new Error(`Unexpected EPSS header: ${header.slice(0, 80)}`);
  const [, model, scoreDate] = match;

  const seen = check(
    await admin.from("epss_daily").select("score_date").eq("score_date", scoreDate).maybeSingle(),
    "read epss_daily",
  );
  if (seen) {
    await it.return(undefined);
    return 0;
  }

  if ((await it.next()).value?.trim() !== "cve,epss,percentile") throw new Error("Unexpected EPSS columns");
  check(await admin.from("epss_staging").delete().neq("cve_id", ""), "clear epss_staging");

  let scored = 0;
  let kept = 0;
  let batch: { cve_id: string; epss: number; percentile: number }[] = [];
  const flush = async () => {
    if (!batch.length) return;
    check(await admin.from("epss_staging").insert(batch), "insert epss_staging");
    kept += batch.length;
    batch = [];
  };
  for await (const line of it) {
    if (!line) continue;
    const [cve, epss, percentile] = line.split(",");
    const score = Number(epss);
    scored++;
    if (score > KEEP_ABOVE || kev.has(cve)) {
      batch.push({ cve_id: cve, epss: score, percentile: Number(percentile) });
      if (batch.length >= BATCH) await flush();
    }
  }
  await flush();

  // A cut-off download would look like a quiet day.
  if (scored < 200_000) throw new Error(`EPSS file has only ${scored} rows`);
  check(
    await admin.rpc("finish_epss", { p_score_date: scoreDate, p_model_version: model, p_scored: scored }),
    "finish_epss",
  );
  return kept;
}

export default {
  fetch: withSupabase({ auth: "secret" }, (_req, ctx) =>
    runInBackground(ctx.supabaseAdmin, "epss", () => ingest(ctx.supabaseAdmin))),
};
