// Loads the whole CISA KEV catalog (CC0) into kev_entries. Runs hourly; the catalog is under 2 MB.
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { BATCH, check, fetchOk, runInBackground } from "../_shared/runs.ts";

const FEED = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

interface KevItem {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate?: string;
  knownRansomwareCampaignUse: string;
  notes?: string;
  cwes?: string[];
}

async function ingest(admin: SupabaseClient): Promise<number> {
  const startedAt = new Date().toISOString();
  const feed = await (await fetchOk(FEED)).json() as { vulnerabilities?: KevItem[] };
  const items = feed.vulnerabilities;
  // The catalog only grows, apart from rare removals. A short list means a broken response, and
  // would otherwise delete most of the table below.
  if (!Array.isArray(items) || items.length < 1000) {
    throw new Error(`KEV feed has ${items?.length ?? "no"} entries, expected over 1000`);
  }

  const rows = items.map((v) => ({
    cve_id: v.cveID,
    vendor_project: v.vendorProject,
    product: v.product,
    vulnerability_name: v.vulnerabilityName,
    date_added: v.dateAdded,
    short_description: v.shortDescription,
    required_action: v.requiredAction,
    due_date: v.dueDate || null,
    ransomware_use: v.knownRansomwareCampaignUse === "Known",
    notes: v.notes || null,
    cwes: v.cwes ?? [],
    updated_at: startedAt,
  }));
  for (let i = 0; i < rows.length; i += BATCH) {
    check(
      await admin.from("kev_entries").upsert(rows.slice(i, i + BATCH), { onConflict: "cve_id" }),
      "upsert kev_entries",
    );
  }

  // CISA occasionally withdraws an entry. Anything this run didn't touch is no longer in the feed.
  check(await admin.from("kev_entries").delete().lt("updated_at", startedAt), "prune kev_entries");
  return rows.length;
}

export default {
  fetch: withSupabase({ auth: "secret" }, (_req, ctx) =>
    runInBackground(ctx.supabaseAdmin, "kev", () => ingest(ctx.supabaseAdmin))),
};
