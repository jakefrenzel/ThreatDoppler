// Loads the Have I Been Pwned breach list (CC BY 4.0; the app must link to haveibeenpwned.com
// wherever it's shown). No key is needed for the list. Runs every 6 hours; the whole list is
// about 1 MB, so it's simply replaced.
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { BATCH, check, fetchOk, runInBackground } from "../_shared/runs.ts";

const API = "https://haveibeenpwned.com/api/v3/breaches";

interface Breach {
  Name: string;
  Title: string;
  Domain?: string;
  BreachDate?: string;
  AddedDate: string;
  ModifiedDate?: string;
  PwnCount: number;
  DataClasses?: string[];
  Description?: string;
  IsVerified: boolean;
  IsFabricated: boolean;
  IsSensitive: boolean;
  IsRetired: boolean;
  IsSpamList: boolean;
  IsMalware: boolean;
  IsStealerLog?: boolean;
}

async function ingest(admin: SupabaseClient): Promise<number> {
  const startedAt = new Date().toISOString();
  const breaches = await (await fetchOk(API)).json() as Breach[];
  if (!Array.isArray(breaches) || breaches.length < 500) {
    throw new Error(`HIBP returned ${Array.isArray(breaches) ? breaches.length : "no"} breaches, expected over 500`);
  }

  const rows = breaches.map((b) => ({
    name: b.Name,
    title: b.Title,
    domain: b.Domain || null,
    breach_date: b.BreachDate || null,
    added_at: b.AddedDate,
    modified_at: b.ModifiedDate || null,
    pwn_count: b.PwnCount,
    data_classes: b.DataClasses ?? [],
    description: b.Description || null,
    is_verified: b.IsVerified,
    is_fabricated: b.IsFabricated,
    is_sensitive: b.IsSensitive,
    is_retired: b.IsRetired,
    is_spam_list: b.IsSpamList,
    is_malware: b.IsMalware,
    is_stealer_log: b.IsStealerLog ?? false,
    updated_at: startedAt,
  }));
  for (let i = 0; i < rows.length; i += BATCH) {
    check(
      await admin.from("hibp_breaches").upsert(rows.slice(i, i + BATCH), { onConflict: "name" }),
      "upsert hibp_breaches",
    );
  }
  check(await admin.from("hibp_breaches").delete().lt("updated_at", startedAt), "prune hibp_breaches");
  return rows.length;
}

export default {
  fetch: withSupabase({ auth: "secret" }, (_req, ctx) =>
    runInBackground(ctx.supabaseAdmin, "hibp", () => ingest(ctx.supabaseAdmin))),
};
