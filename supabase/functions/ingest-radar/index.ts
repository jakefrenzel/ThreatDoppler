// Daily DDoS and email-threat series from Cloudflare Radar (CC BY-NC 4.0: credit required, and
// only while the app is non-commercial; see "Before monetising" in docs/backend-plan.md). Needs
// the CLOUDFLARE_RADAR_TOKEN function secret (Account > Radar > Read).
//
// DDoS series only come normalised (MIN0_MAX: each value over the request's maximum). Percentile
// ranks don't care about scale, but stored days from different requests must share one, so each
// fetch is multiplied to match the days already stored where they overlap. Email series are real
// percentages of all messages and are stored as they are.
//
// Radar allows daily values for up to about 91 days per request, so longer ranges are fetched in
// windows walking back from today, each overlapping the last by a week. Only complete UTC days
// are stored. Besides the global series, it fetches layer 3 volume per region and layer 7 shares
// per sector, for area scores. Runs daily over the last 28 days. A backfill sends {"days": 730};
// that can outrun the function's time limit, so {"metrics": ["email_credential"]} redoes only the
// series named (or "industry", or "l3_<region>").
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { check, USER_AGENT, runInBackground } from "../_shared/runs.ts";
import { RADAR_INDUSTRIES, RADAR_REGIONS } from "../_shared/sectors.ts";

const API = "https://api.cloudflare.com/client/v4/radar";
const DAY_MS = 86_400_000;
const DEFAULT_DAYS = 28;
const MAX_DAYS = 730;
const WINDOW_DAYS = 90;
const OVERLAP_DAYS = 7;

type Series = Map<string, number>; // day -> value
type Serie = Record<string, string[]> & { timestamps: string[] };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function radar(token: string, path: string, start: Date, end: Date, extra: Record<string, string> = {}): Promise<Serie> {
  const params = new URLSearchParams({
    aggInterval: "1d",
    dateStart: start.toISOString(),
    dateEnd: end.toISOString(),
    format: "json",
    ...extra,
  });
  let res: Response;
  for (let attempt = 1; ; attempt++) {
    // Radar rate-limits bursts and sometimes fails with a 5xx, so requests are spaced out and a 429
    // or 5xx is retried after a wait.
    await sleep(attempt === 1 ? 500 : 15_000 * (attempt - 1));
    res = await fetch(`${API}${path}?${params}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT },
    });
    if ((res.status !== 429 && res.status < 500) || attempt === 4) break;
    await res.body?.cancel();
  }
  const body = await res.json().catch(() => null) as {
    success?: boolean;
    errors?: { message: string }[];
    result?: { serie_0?: Serie };
  } | null;
  if (!res.ok || !body?.success || !body.result?.serie_0?.timestamps) {
    throw new Error(`Radar ${path} returned ${res.status}: ${body?.errors?.map((e) => e.message).join("; ") ?? "no body"}`);
  }
  return body.result.serie_0;
}

function column(serie: Serie, key: string): Series {
  const out: Series = new Map();
  serie.timestamps.forEach((t, i) => {
    const value = Number(serie[key]?.[i]);
    if (Number.isFinite(value)) out.set(t.slice(0, 10), value);
  });
  return out;
}

/** Each metric: how to fetch one window, and whether it needs rescaling to the stored series. */
const METRICS: Record<string, { rescale: boolean; fetch: (token: string, start: Date, end: Date) => Promise<Series> }> = {
  l3: { rescale: true, fetch: async (t, s, e) => column(await radar(t, "/attacks/layer3/timeseries", s, e), "values") },
  l7: { rescale: true, fetch: async (t, s, e) => column(await radar(t, "/attacks/layer7/timeseries", s, e), "values") },
  // Share of all email flagged malicious, in percent.
  email_malicious: {
    rescale: false,
    fetch: async (t, s, e) => column(await radar(t, "/email/security/timeseries_groups/MALICIOUS", s, e), "MALICIOUS"),
  },
  // Share of all email that's malicious and harvesting credentials: malicious % times the
  // credential-harvester share of malicious mail.
  email_credential: {
    rescale: false,
    fetch: async (t, s, e) => {
      const [malicious, categories] = await Promise.all([
        radar(t, "/email/security/timeseries_groups/MALICIOUS", s, e),
        radar(t, "/email/security/timeseries_groups/THREAT_CATEGORY", s, e),
      ]);
      const share = column(malicious, "MALICIOUS");
      const harvester = column(categories, "CredentialHarvester");
      const out: Series = new Map();
      for (const [day, m] of share) {
        const h = harvester.get(day);
        if (h !== undefined) out.set(day, (m * h) / 100);
      }
      return out;
    },
  },
  // Layer 3 attack volume by target location, per region (for region scores). Rescaled like l3.
  ...Object.fromEntries(
    Object.entries(RADAR_REGIONS).map(([region, filter]) => [
      `l3_${region}`,
      {
        rescale: true,
        fetch: async (t: string, s: Date, e: Date) =>
          column(await radar(t, "/attacks/layer3/timeseries", s, e, { direction: "TARGET", ...filter }), "values"),
      },
    ]),
  ),
};

/**
 * Share (percent) of layer 7 attack requests aimed at each sector, from Radar's industry breakdown
 * (top 100 industries; the rest are "other"). Stored in radar_sector_daily, every sector every day,
 * 0 when none of its industries made the list. Shares are absolute, so no rescaling.
 */
async function industries(admin: SupabaseClient, token: string, start: Date, end: Date): Promise<number> {
  const serie = await radar(token, "/attacks/layer7/timeseries_groups/INDUSTRY", start, end, { limitPerGroup: "100" });
  const rows: { day: string; sector: string; share: number }[] = [];
  serie.timestamps.forEach((ts, i) => {
    const day = ts.slice(0, 10);
    if (day < isoDay(start) || day >= isoDay(end)) return;
    for (const [sector, names] of Object.entries(RADAR_INDUSTRIES)) {
      const share = names.reduce((sum, name) => sum + (Number(serie[name]?.[i]) || 0), 0);
      rows.push({ day, sector, share: Math.round(share * 1e6) / 1e6 });
    }
  });
  if (rows.length) check(await admin.from("radar_sector_daily").upsert(rows, { onConflict: "day,sector" }), "upsert radar_sector_daily");
  return rows.length;
}

async function stored(admin: SupabaseClient, metric: string, from: string, to: string): Promise<Series> {
  const rows = check(
    await admin.from("radar_daily").select("day, value").eq("metric", metric).gte("day", from).lt("day", to),
    "read radar_daily",
  ) ?? [];
  return new Map(rows.map((r) => [r.day as string, Number(r.value)]));
}

async function ingest(admin: SupabaseClient, days: number, only?: string[]): Promise<number> {
  const token = Deno.env.get("CLOUDFLARE_RADAR_TOKEN");
  if (!token) throw new Error("CLOUDFLARE_RADAR_TOKEN is not set");
  const today = new Date(`${isoDay(new Date())}T00:00:00Z`); // complete days only
  const oldest = new Date(today.getTime() - days * DAY_MS);
  let written = 0;

  const windows: [Date, Date][] = [];
  for (let end = today; end > oldest; end = new Date(end.getTime() - (WINDOW_DAYS - OVERLAP_DAYS) * DAY_MS)) {
    windows.push([new Date(Math.max(oldest.getTime(), end.getTime() - WINDOW_DAYS * DAY_MS)), end]);
  }

  if (!only || only.includes("industry")) {
    for (const [start, end] of windows) written += await industries(admin, token, start, end);
  }

  for (const [metric, { rescale, fetch }] of Object.entries(METRICS)) {
    if (only && !only.includes(metric)) continue;
    for (const [start, end] of windows) {
      const fresh = await fetch(token, start, end);

      let factor = 1;
      if (rescale) {
        // Scale to the overlap with what's stored. With nothing stored, this window sets the scale.
        const existing = await stored(admin, metric, isoDay(start), isoDay(end));
        let had = 0;
        let got = 0;
        for (const [day, value] of fresh) {
          const old = existing.get(day);
          if (old !== undefined) {
            had += old;
            got += value;
          }
        }
        if (had > 0 && got > 0) factor = had / got;
      }

      const rows = [...fresh]
        .filter(([day]) => day >= isoDay(start) && day < isoDay(end))
        .map(([day, value]) => ({ metric, day, value: Math.round(value * factor * 1e6) / 1e6 }));
      if (rows.length) {
        check(await admin.from("radar_daily").upsert(rows, { onConflict: "metric,day" }), "upsert radar_daily");
        written += rows.length;
      }
    }
  }
  return written;
}

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    const params = await req.json().catch(() => ({})) as { days?: number; metrics?: string[] };
    const days = Math.min(Math.max(Math.round(params.days ?? DEFAULT_DAYS), 2), MAX_DAYS);
    const only = Array.isArray(params.metrics) ? params.metrics.filter((m) => m in METRICS || m === "industry") : undefined;
    return runInBackground(ctx.supabaseAdmin, "radar", () => ingest(ctx.supabaseAdmin, days, only));
  }),
};
