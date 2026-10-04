import type { SupabaseClient } from "@supabase/supabase-js";

// Provided by the Supabase Edge Runtime. Declared here rather than importing its full type file.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

/** Sent with every outbound fetch. Some sources (HIBP) require one; the rest get it as courtesy. */
export const USER_AGENT = "ThreatDoppler/1.0 (+https://github.com/jakefrenzel/ThreatDoppler)";

/** Rows per insert or upsert. Keeps each request well inside the CPU and payload limits. */
export const BATCH = 1000;

/**
 * Starts a job in the background and answers straight away, because pg_net gives up waiting
 * after a few seconds. The job is logged in source_runs. It returns how many rows it wrote.
 */
export async function runInBackground(
  admin: SupabaseClient,
  source: string,
  job: () => Promise<number>,
): Promise<Response> {
  EdgeRuntime.waitUntil(track(admin, source, job));
  return Response.json({ started: source }, { status: 202 });
}

async function track(admin: SupabaseClient, source: string, job: () => Promise<number>) {
  const { data, error } = await admin.from("source_runs").insert({ source }).select("id").single();
  if (error) {
    console.error(`${source}: couldn't log the run`, error);
    return;
  }
  let status = "ok";
  let rows: number | null = null;
  let message: string | null = null;
  try {
    rows = await job();
  } catch (e) {
    status = "error";
    message = e instanceof Error ? e.message : String(e);
    console.error(`${source}: ${message}`);
  }
  const done = await admin.rpc("finish_source_run", {
    p_id: data.id,
    p_status: status,
    p_rows: rows,
    p_error: message,
  });
  if (done.error) console.error(`${source}: couldn't close the run`, done.error);
}

/** Throws with the PostgREST message, so it ends up in source_runs.error. */
export function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

export async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`${url} returned ${res.status}`);
  }
  return res;
}
