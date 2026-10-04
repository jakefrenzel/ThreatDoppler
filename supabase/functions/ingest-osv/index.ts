// Finds newly published malicious packages (OSV MAL- records, from OpenSSF Malicious Packages,
// Apache-2.0). Each ecosystem's modified_id.csv lists "modified,id" newest first; this reads it
// down to where the last run stopped, then fetches each unseen MAL- record for its published date.
// Records are re-modified often, so only ids not yet stored and published in the last 30 days
// count. Spam waves can bring tens of thousands a day, so each run fetches a capped number and
// the rest wait for the next run. Runs hourly.
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { check, USER_AGENT, runInBackground } from "../_shared/runs.ts";

const BUCKET = "https://osv-vulnerabilities.storage.googleapis.com";
const ECOSYSTEMS = ["npm", "PyPI", "RubyGems", "NuGet", "crates.io", "Go", "Maven", "Packagist", "VSCode"];
/** Bytes per range request on modified_id.csv, and how many ranges to read at most per run. */
const RANGE = 262_144;
const MAX_RANGES = 4;
/** Record fetches per run, across all ecosystems, and how many run at once. */
const MAX_FETCHES = 400;
const CONCURRENCY = 10;
/** Timestamps aren't strictly ordered, so each run re-reads a minute before the cursor. */
const SLACK_MS = 60_000;
/** Where a new ecosystem starts reading from. Older history comes from the backfill. */
const FIRST_RUN_DAYS = 3;
const KEEP_DAYS = 30;

interface Candidate {
  id: string;
  modified: Date;
}

interface Feed {
  candidates: Candidate[]; // oldest first
  newest: Date | null;
  etag: string | null;
  unchanged: boolean;
}

async function readFeed(ecosystem: string, readTo: Date, etag: string | null): Promise<Feed> {
  const url = `${BUCKET}/${encodeURIComponent(ecosystem)}/modified_id.csv`;
  const stopBelow = readTo.getTime() - SLACK_MS;
  const found: Candidate[] = [];
  let newest: Date | null = null;
  let newEtag: string | null = null;
  let rest = "";
  let complete = false;

  for (let part = 0; part < MAX_RANGES; part++) {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Range: `bytes=${part * RANGE}-${(part + 1) * RANGE - 1}`,
    };
    if (part === 0 && etag) headers["If-None-Match"] = etag;
    const res = await fetch(url, { headers });
    if (res.status === 304) return { candidates: [], newest: null, etag, unchanged: true };
    if (res.status === 416) {
      complete = true; // read past the end of the file
      break;
    }
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    if (part === 0) newEtag = res.headers.get("etag");

    const lines = (rest + await res.text()).split("\n");
    rest = lines.pop() ?? "";
    for (const line of lines) {
      const comma = line.indexOf(",");
      if (comma < 0) continue;
      const modified = new Date(line.slice(0, comma));
      if (Number.isNaN(modified.getTime())) continue;
      newest ??= modified;
      if (modified.getTime() < stopBelow) return { candidates: found.reverse(), newest, etag: newEtag, unchanged: false };
      const id = line.slice(comma + 1).trim();
      if (id.startsWith("MAL-")) found.push({ id, modified });
    }
    if (res.status === 200) {
      complete = true; // the server ignored the range and sent the whole file
      break;
    }
  }
  // Only after a huge burst: lines older than this are skipped rather than blocking every run.
  if (!complete) console.warn(`${ecosystem}: changes since the last run exceed ${MAX_RANGES * RANGE} bytes; older ones skipped`);
  return { candidates: found.reverse(), newest, etag: newEtag, unchanged: false };
}

async function known(admin: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const rows = check(
      await admin.from("malicious_packages").select("id").in("id", ids.slice(i, i + 200)),
      "read malicious_packages",
    ) ?? [];
    for (const row of rows) seen.add(row.id);
  }
  return seen;
}

interface OsvRecord {
  id: string;
  published?: string;
  withdrawn?: string;
  affected?: { package?: { ecosystem?: string } }[];
}

async function fetchRecord(ecosystem: string, id: string): Promise<OsvRecord | null> {
  const res = await fetch(`${BUCKET}/${encodeURIComponent(ecosystem)}/${id}.json`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (res.status === 404) {
    await res.body?.cancel();
    return null; // removed since the index was written
  }
  if (!res.ok) throw new Error(`${ecosystem}/${id} returned ${res.status}`);
  return await res.json() as OsvRecord;
}

async function ingest(admin: SupabaseClient): Promise<number> {
  const cursors = new Map(
    (check(await admin.from("osv_cursors").select("ecosystem, read_to, etag"), "read osv_cursors") ?? [])
      .map((c) => [c.ecosystem as string, { readTo: new Date(c.read_to), etag: c.etag as string | null }]),
  );
  const keepFrom = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
  // An id's year is when it was allocated, which is never before it was published.
  const oldestUsefulYear = new Date(keepFrom).getUTCFullYear();
  let budget = MAX_FETCHES;
  let stored = 0;

  for (const ecosystem of ECOSYSTEMS) {
    const cursor = cursors.get(ecosystem) ??
      { readTo: new Date(Date.now() - FIRST_RUN_DAYS * 86_400_000), etag: null };
    const feed = await readFeed(ecosystem, cursor.readTo, cursor.etag);
    if (feed.unchanged) continue;

    const fresh = feed.candidates.filter((c) => Number(c.id.split("-")[1]) >= oldestUsefulYear);
    const seen = await known(admin, [...new Set(fresh.map((c) => c.id))]);
    const todo = fresh.filter((c) => !seen.has(c.id));
    const batch = todo.slice(0, budget);
    budget -= batch.length;

    const rows: { id: string; ecosystem: string; published: string; withdrawn: boolean }[] = [];
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const records = await Promise.all(batch.slice(i, i + CONCURRENCY).map((c) => fetchRecord(ecosystem, c.id)));
      for (const r of records) {
        const published = r?.published?.slice(0, 10);
        if (!r || !published || published < keepFrom) continue;
        rows.push({ id: r.id, ecosystem, published, withdrawn: Boolean(r.withdrawn) });
      }
    }
    if (rows.length) {
      check(await admin.from("malicious_packages").upsert(rows, { onConflict: "id" }), "upsert malicious_packages");
      stored += rows.length;
    }

    // Done with the feed: next run starts from its newest line. Out of budget: resume after the
    // last record fetched, and fetch the ETag again next time so the file isn't skipped.
    const finished = batch.length === todo.length;
    const readTo = finished ? (feed.newest ?? cursor.readTo) : batch.length ? batch[batch.length - 1].modified : cursor.readTo;
    check(
      await admin.from("osv_cursors").upsert({
        ecosystem,
        read_to: readTo.toISOString(),
        etag: finished ? feed.etag : null,
      }, { onConflict: "ecosystem" }),
      "update osv_cursors",
    );
  }
  return stored;
}

export default {
  fetch: withSupabase({ auth: "secret" }, (_req, ctx) =>
    runInBackground(ctx.supabaseAdmin, "osv", () => ingest(ctx.supabaseAdmin))),
};
