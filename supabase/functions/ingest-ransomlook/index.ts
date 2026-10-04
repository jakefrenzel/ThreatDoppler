// Counts ransomware leak-site posts per group per day from RansomLook (CC BY 4.0). Victim names
// arrive in post_title and are dropped here; only counts are stored. Runs hourly over the last 7
// days, replacing those days, because posts get backdated, edited and removed. A one-off backfill
// sends {"from": "2021-10-01"} in the body.
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { check, fetchOk, runInBackground } from "../_shared/runs.ts";

const API = "https://www.ransomlook.io/api/posts";
const WINDOW_DAYS = 7;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function ingest(admin: SupabaseClient, fromParam: string | undefined): Promise<number> {
  const today = isoDay(new Date());
  const from = fromParam ?? isoDay(new Date(Date.now() - WINDOW_DAYS * 86_400_000));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from > today) throw new Error(`Bad from date: ${from}`);

  const res = await fetchOk(`${API}?from=${from}&to=${today}`);
  const body = await res.json() as { posts?: { group_name?: string; discovered?: string }[] };
  if (!Array.isArray(body.posts)) throw new Error("RansomLook response has no posts array");

  const counts = new Map<string, number>();
  for (const post of body.posts) {
    if (!post.group_name || !post.discovered) continue;
    const day = isoDay(new Date(post.discovered));
    // A malformed range silently falls back to the last 30 days; anything before `from` means that.
    if (day < from) throw new Error(`RansomLook returned a post from ${day}, before ${from}`);
    const key = `${day}|${post.group_name}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rows = [...counts].map(([key, posts]) => {
    const [day, group_name] = key.split("|");
    return { day, group_name, posts };
  });
  return check(await admin.rpc("replace_ransom_counts", { p_from: from, p_rows: rows }), "replace_ransom_counts");
}

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    const params = await req.json().catch(() => ({})) as { from?: string };
    return runInBackground(ctx.supabaseAdmin, "ransomlook", () => ingest(ctx.supabaseAdmin, params.from));
  }),
};
