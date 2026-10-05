// Reads Expo push receipts for pushes sent 15 minutes to a day ago (Expo's advice), marks each
// delivery delivered or failed, and disables devices whose token Expo no longer recognises.
// Runs every 30 minutes.
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { RECEIPT_BATCH, readReceipts } from "../_shared/push.ts";
import { check, runInBackground } from "../_shared/runs.ts";

async function run(admin: SupabaseClient): Promise<number> {
  const now = Date.now();
  const sent = check(
    await admin.from("deliveries").select("id, device_id, ticket_id").eq("status", "sent").not("ticket_id", "is", null)
      .lte("sent_at", new Date(now - 15 * 60_000).toISOString()).gte("sent_at", new Date(now - 86_400_000).toISOString())
      .limit(5000),
    "read deliveries",
  ) ?? [];
  // Held deliveries released in a bundle share its ticket; one receipt settles them all.
  const byTicket = new Map<string, { id: number; device_id: number }[]>();
  for (const d of sent) byTicket.set(d.ticket_id, [...(byTicket.get(d.ticket_id) ?? []), d]);
  const tickets = [...byTicket.keys()];

  let settled = 0;
  for (let i = 0; i < tickets.length; i += RECEIPT_BATCH) {
    const receipts = await readReceipts(tickets.slice(i, i + RECEIPT_BATCH));
    for (const [ticket, result] of receipts) {
      const rows = byTicket.get(ticket) ?? [];
      check(
        await admin.from("deliveries").update(result.ok ? { status: "delivered" } : { status: "failed", error: result.error })
          .in("id", rows.map((r) => r.id)),
        "update deliveries",
      );
      settled += rows.length;
      if (result.error === "DeviceNotRegistered") {
        check(
          await admin.from("devices").update({ disabled_at: new Date().toISOString(), disabled_reason: result.error })
            .in("id", [...new Set(rows.map((r) => r.device_id))]),
          "disable devices",
        );
      }
    }
  }
  return settled;
}

export default {
  fetch: withSupabase({ auth: "secret" }, (_req, ctx) =>
    runInBackground(ctx.supabaseAdmin, "receipts", () => run(ctx.supabaseAdmin))),
};
