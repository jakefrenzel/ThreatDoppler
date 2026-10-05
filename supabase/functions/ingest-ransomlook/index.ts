// Counts ransomware leak-site posts per group per day from RansomLook (CC BY 4.0), and per sector
// from the description each group writes about its victim (see postSector). Victim names and
// descriptions are read in memory and dropped; only counts are stored. Runs hourly over the last 7
// days, replacing those days, because posts get backdated, edited and removed. A one-off backfill
// sends {"from": "2021-10-01"} in the body; it covers group counts only, and sector counts for
// long ranges come from scripts/backfill (classifying years of posts is too much for one call).
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { check, fetchOk, runInBackground } from "../_shared/runs.ts";
import { postSector } from "../_shared/sectors.ts";

const API = "https://www.ransomlook.io/api";
const WINDOW_DAYS = 7;
/** Longest range whose posts are classified by sector in one run. */
const SECTOR_MAX_DAYS = 31;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
/** "2026-09-28 01:27:00" (UTC, no zone) or ISO with Z, as a UTC day. */
const utcDay = (s: string) => isoDay(new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(" ", "T")}Z`));

async function sectors(admin: SupabaseClient, from: string, today: string): Promise<number> {
  const res = await fetchOk(`${API}/posts/period/${from}/${today}`);
  const posts = await res.json() as { discovered?: string; description?: string }[];
  if (!Array.isArray(posts)) throw new Error("RansomLook period response is not a list");
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (!post.discovered) continue;
    const day = utcDay(post.discovered);
    if (day < from) continue;
    const sector = postSector(post.description);
    if (sector) counts.set(`${day}|${sector}`, (counts.get(`${day}|${sector}`) ?? 0) + 1);
  }
  const rows = [...counts].map(([key, n]) => {
    const [day, sector] = key.split("|");
    return { day, sector, posts: n };
  });
  return check(await admin.rpc("replace_ransom_sectors", { p_from: from, p_rows: rows }), "replace_ransom_sectors");
}

async function ingest(admin: SupabaseClient, fromParam: string | undefined): Promise<number> {
  const today = isoDay(new Date());
  const from = fromParam ?? isoDay(new Date(Date.now() - WINDOW_DAYS * 86_400_000));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from > today) throw new Error(`Bad from date: ${from}`);

  const res = await fetchOk(`${API}/posts?from=${from}&to=${today}`);
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
  const written = check(await admin.rpc("replace_ransom_counts", { p_from: from, p_rows: rows }), "replace_ransom_counts");

  const span = (Date.parse(today) - Date.parse(from)) / 86_400_000;
  return written + (span <= SECTOR_MAX_DAYS ? await sectors(admin, from, today) : 0);
}

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    const params = await req.json().catch(() => ({})) as { from?: string };
    return runInBackground(ctx.supabaseAdmin, "ransomlook", () => ingest(ctx.supabaseAdmin, params.from));
  }),
};
