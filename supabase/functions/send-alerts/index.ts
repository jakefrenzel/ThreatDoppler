// Sends push alerts (milestone 2, docs/push-plan.md). Runs hourly at :25, after compute_scores (:15)
// and render-snapshot (:20). For each registered device it plans alerts from its rules (see
// _shared/alerts.ts), holds them during quiet hours, releases held alerts as one push when quiet
// hours end, and sends the rest through Expo's push service. Every push is a row in deliveries.
//
// {"test": "<ExponentPushToken[...]>"} in the body sends one test push to that registered device.
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { bundle, type Context, type Device, type Draft, type FlawEvent, inQuietHours, type Pair, planDevice } from "../_shared/alerts.ts";
import { describe, type EventRow } from "../_shared/events.ts";
import { REGION_NAMES, SECTOR_NAMES, VECTOR_NAMES } from "../_shared/names.ts";
import { type PushMessage, SEND_BATCH, sendPush } from "../_shared/push.ts";
import { check, runInBackground } from "../_shared/runs.ts";

const DAY_MS = 86_400_000;
const shiftDay = (day: string, by: number) => new Date(Date.parse(day) + by * DAY_MS).toISOString().slice(0, 10);

interface DeviceRow {
  id: number;
  token: string;
  time_zone: string;
  wording: Device["wording"];
  quiet_hours: Device["quietHours"];
  rules: Device["rules"];
}

async function loadContext(admin: SupabaseClient, now: Date): Promise<Context | null> {
  const latest = check(
    await admin.from("index_daily").select("day, value").order("day", { ascending: false }).limit(2),
    "read index_daily",
  ) ?? [];
  if (latest.length < 2) return null;
  const day = latest[0].day as string;
  const prev = shiftDay(day, -1);
  const pairOf = (rows: { day: string; value: number }[]): Pair | null => {
    const t = rows.find((r) => r.day === day);
    const y = rows.find((r) => r.day === prev);
    return t && y ? { today: Number(t.value), yesterday: Number(y.value) } : null;
  };

  const vectors = new Map<string, Pair>();
  const scoreRows = check(
    await admin.from("scores_daily").select("vector, day, score").in("day", [day, prev]),
    "read scores_daily",
  ) ?? [];
  for (const id of new Set(scoreRows.map((r) => r.vector as string))) {
    const p = pairOf(scoreRows.filter((r) => r.vector === id).map((r) => ({ day: r.day, value: r.score })));
    if (p) vectors.set(id, p);
  }

  const areas = new Map<string, Pair>();
  const areaRows = check(
    await admin.from("area_scores_daily").select("kind, area, day, score").in("day", [day, prev]),
    "read area_scores_daily",
  ) ?? [];
  for (const key of new Set(areaRows.map((r) => `${r.kind}:${r.area}`))) {
    const p = pairOf(areaRows.filter((r) => `${r.kind}:${r.area}` === key).map((r) => ({ day: r.day, value: r.score })));
    if (p) areas.set(key, p);
  }

  const kev = check(
    await admin.from("events").select("id, kind, type, vector, at, magnitude, data").eq("kind", "kev")
      .gte("at", new Date(now.getTime() - 3 * DAY_MS).toISOString()).order("at", { ascending: true }),
    "read events",
  ) ?? [];
  const flaws: FlawEvent[] = (kev as EventRow[]).map((e) => ({
    id: e.id,
    at: new Date(e.at).toISOString(),
    epss: typeof e.data.epss === "number" ? e.data.epss : null,
    ransomware: Boolean(e.data.ransomware),
    title: describe({ ...e, magnitude: Number(e.magnitude) }, { impact: 0, bins: [] }).event.title,
  }));

  return {
    day,
    index: pairOf(latest.map((r) => ({ day: r.day, value: r.value })))!,
    vectors,
    areas,
    names: { vectors: VECTOR_NAMES, sectors: SECTOR_NAMES, regions: REGION_NAMES },
    flaws,
    now,
  };
}

const toDevice = (r: DeviceRow): Device => ({
  id: r.id,
  timeZone: r.time_zone,
  wording: r.wording,
  quietHours: r.quiet_hours,
  rules: r.rules,
});

interface Outgoing {
  device: DeviceRow;
  draft: Draft;
  kind: "alert" | "morning" | "held" | "test";
  /** Held deliveries this push releases. */
  releases?: number[];
}

/** Writes the deliveries, sends them, and records each ticket. Returns how many Expo accepted. */
async function deliver(admin: SupabaseClient, outgoing: Outgoing[]): Promise<number> {
  let accepted = 0;
  for (let i = 0; i < outgoing.length; i += SEND_BATCH) {
    const batch = outgoing.slice(i, i + SEND_BATCH);
    const rows = check(
      await admin.from("deliveries").insert(batch.map((o) => ({
        device_id: o.device.id,
        rule_id: o.draft.ruleId,
        kind: o.kind,
        title: o.draft.title,
        body: o.draft.body,
        data: o.draft.data,
        urgent: o.draft.urgent,
        status: "queued",
      }))).select("id"),
      "insert deliveries",
    ) ?? [];
    const messages: PushMessage[] = batch.map((o, j) => ({
      to: o.device.token,
      title: o.draft.title,
      body: o.draft.body,
      data: { ...o.draft.data, deliveryId: rows[j]?.id },
    }));
    const tickets = await sendPush(messages);
    const sentAt = new Date().toISOString();
    for (const [j, ticket] of tickets.entries()) {
      const o = batch[j];
      const update = ticket.ok
        ? { status: "sent", sent_at: sentAt, ticket_id: ticket.id }
        : { status: "failed", sent_at: sentAt, error: ticket.error };
      check(await admin.from("deliveries").update(update).eq("id", rows[j].id), "update delivery");
      if (ticket.ok) {
        accepted++;
        if (o.releases?.length) {
          check(await admin.from("deliveries").update({ status: "sent", sent_at: sentAt, ticket_id: ticket.id }).in("id", o.releases), "release held");
        }
      }
      if (ticket.error === "DeviceNotRegistered") {
        check(
          await admin.from("devices").update({ disabled_at: sentAt, disabled_reason: ticket.error }).eq("id", o.device.id),
          "disable device",
        );
      }
    }
  }
  return accepted;
}

async function run(admin: SupabaseClient): Promise<number> {
  const now = new Date();
  const ctx = await loadContext(admin, now);
  if (!ctx) throw new Error("index_daily has fewer than two days");

  const devices = (check(
    await admin.from("devices").select("id, token, time_zone, wording, quiet_hours, rules").is("disabled_at", null),
    "read devices",
  ) ?? []) as DeviceRow[];
  if (!devices.length) return 0;
  const ids = devices.map((d) => d.id);

  const stateRows = check(await admin.from("alert_state").select("device_id, rule_id, last_key").in("device_id", ids), "read alert_state") ?? [];
  // Pushes in the last 24 hours, for the daily cap.
  const recent = check(
    await admin.from("deliveries").select("device_id, status, id, title, body, data, urgent, rule_id")
      .in("device_id", ids).gte("created_at", new Date(now.getTime() - DAY_MS).toISOString()),
    "read deliveries",
  ) ?? [];

  const outgoing: Outgoing[] = [];
  const holds: Record<string, unknown>[] = [];
  const state: Record<string, unknown>[] = [];
  for (const row of devices) {
    const device = toDevice(row);
    const lastKeys = new Map(stateRows.filter((s) => s.device_id === row.id).map((s) => [s.rule_id as string, s.last_key as string]));
    const mine = recent.filter((d) => d.device_id === row.id);
    const sentToday = mine.filter((d) => d.status === "sent" || d.status === "delivered").length;
    const plan = planDevice(device, ctx, lastKeys, sentToday);

    for (const [rule_id, last_key] of plan.keys) {
      state.push({ device_id: row.id, rule_id, last_key, last_fired_at: now.toISOString() });
    }
    for (const draft of plan.send) outgoing.push({ device: row, draft, kind: draft.kind });
    for (const draft of plan.hold) {
      holds.push({ device_id: row.id, rule_id: draft.ruleId, kind: "held", title: draft.title, body: draft.body, data: draft.data, status: "held" });
    }

    // Quiet hours over: whatever was held goes out as one push.
    const held = mine.filter((d) => d.status === "held");
    if (held.length && !inQuietHours(device, now)) {
      const drafts = held.map((h) => ({ ruleId: h.rule_id, kind: "alert" as const, title: h.title, body: h.body, data: h.data, urgent: h.urgent }));
      const heading = device.wording === "technical" ? `${held.length} alerts during quiet hours` : `${held.length} alerts while you were away`;
      outgoing.push({
        device: row,
        draft: held.length === 1 ? drafts[0] : bundle(drafts, device.wording, heading),
        kind: "held",
        releases: held.map((h) => h.id as number),
      });
    }
  }

  if (holds.length) check(await admin.from("deliveries").insert(holds), "insert held");
  if (state.length) check(await admin.from("alert_state").upsert(state, { onConflict: "device_id,rule_id" }), "update alert_state");
  return await deliver(admin, outgoing);
}

async function test(admin: SupabaseClient, token: string): Promise<number> {
  const row = check(
    await admin.from("devices").select("id, token, time_zone, wording, quiet_hours, rules").eq("token", token).maybeSingle(),
    "read device",
  ) as DeviceRow | null;
  if (!row) throw new Error("No device registered with that token");
  const draft: Draft = {
    ruleId: null,
    kind: "alert",
    title: "ThreatDoppler test alert",
    body: "Push alerts are working on this device.",
    data: { path: "/alerts" },
    urgent: true,
  };
  return await deliver(admin, [{ device: row, draft, kind: "test" }]);
}

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    const params = await req.json().catch(() => ({})) as { test?: string };
    return runInBackground(ctx.supabaseAdmin, "alerts", () =>
      params.test ? test(ctx.supabaseAdmin, params.test) : run(ctx.supabaseAdmin));
  }),
};
