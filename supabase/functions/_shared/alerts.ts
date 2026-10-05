// Decides which push alerts a device gets, from its rules and the latest scores (milestone 2,
// docs/push-plan.md). Pure: no database or network, so every rule can be tested.
//
// Scores change once a day (complete UTC days), so threshold, band and jump rules compare the latest
// complete day with the day before, and fire at most once per day each (keyed by the day). Exploited
// flaw rules look at KEV events since the rule last ran. The morning summary goes out in the device's
// 07:00 hour. Quiet hours hold alerts, except Severe crossings; past 6 pushes a day the rest are
// bundled into one.

export type Wording = "plain" | "standard" | "technical";

export interface Rule {
  id: string;
  kind: "index" | "sector" | "region" | "vector" | "vuln" | "digest";
  condition: "above" | "jump" | "band" | "daily" | "weekly";
  targets: string[];
  value: number;
  enabled: boolean;
  push: boolean;
}

export interface Device {
  id: number;
  timeZone: string;
  wording: Wording;
  quietHours: { enabled: boolean; start: string; end: string };
  rules: Rule[];
}

/** A value on the latest complete day and the day before. */
export interface Pair {
  today: number;
  yesterday: number;
}

export interface FlawEvent {
  id: string;
  at: string; // ISO
  epss: number | null;
  ransomware: boolean;
  title: { technical: string; plain: string };
}

export interface Context {
  /** The latest complete day, YYYY-MM-DD. */
  day: string;
  index: Pair;
  /** By sub-index id, area "sector:health" / "region:nam". */
  vectors: Map<string, Pair>;
  areas: Map<string, Pair>;
  names: { vectors: Record<string, string>; sectors: Record<string, string>; regions: Record<string, string> };
  /** Exploited flaws added recently, oldest first. */
  flaws: FlawEvent[];
  now: Date;
}

export interface Draft {
  ruleId: string | null;
  kind: "alert" | "morning";
  title: string;
  body: string;
  data: { path: string; params?: Record<string, string> };
  urgent: boolean;
}

export const DAILY_CAP = 6;
export const SEVERE = 85;
const BANDS: [number, string][] = [[85, "Severe"], [70, "High"], [50, "Elevated"], [25, "Guarded"], [0, "Low"]];
export const bandName = (v: number) => BANDS.find(([min]) => v >= min)![1];
export const LIKELY_EPSS = 0.5;

const fmt = (v: number) => v.toFixed(1);
const signed = (v: number) => (v > 0 ? `+${fmt(v)}` : v < 0 ? `−${fmt(Math.abs(v))}` : "0.0");
const pick = (w: Wording, technical: string, plain: string) => (w === "technical" ? technical : plain);

/** Local date, hour and minutes past midnight in a time zone. */
export function localTime(now: Date, timeZone: string): { date: string; hour: number; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour) % 24;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour, minutes: hour * 60 + Number(parts.minute) };
}

/** Whether the device is in quiet hours now. The window can cross midnight (22:00–06:30). */
export function inQuietHours(device: Device, now: Date): boolean {
  const q = device.quietHours;
  if (!q.enabled) return false;
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const start = toMin(q.start);
  const end = toMin(q.end);
  const m = localTime(now, device.timeZone).minutes;
  if (start === end) return false;
  return start < end ? m >= start && m < end : m >= start || m < end;
}

function areaName(ctx: Context, kind: "sector" | "region", id: string) {
  return (kind === "sector" ? ctx.names.sectors[id] : ctx.names.regions[id]) ?? id;
}

/** Evaluates one rule. Returns the drafts and the new state key, or null if nothing fires. */
export function evaluateRule(
  rule: Rule,
  device: Device,
  ctx: Context,
  lastKey: string | undefined,
): { drafts: Draft[]; key: string } | null {
  if (!rule.enabled || !rule.push) return null;
  const w = device.wording;

  switch (rule.kind) {
    case "index": {
      if (lastKey === ctx.day) return null;
      const { today, yesterday } = ctx.index;
      if (rule.condition === "band") {
        const from = bandName(yesterday);
        const to = bandName(today);
        if (from === to) return null;
        return {
          key: ctx.day,
          drafts: [{
            ruleId: rule.id,
            kind: "alert",
            title: pick(w, `Global index moves to ${to} (${fmt(today)})`, `Cyber threat level is now ${to}`),
            body: pick(w, `From ${from}, ${signed(today - yesterday)} in 24h.`, `It was ${from} yesterday.`),
            data: { path: "/" },
            urgent: to === "Severe",
          }],
        };
      }
      if (!(today >= rule.value && yesterday < rule.value)) return null;
      return {
        key: ctx.day,
        drafts: [{
          ruleId: rule.id,
          kind: "alert",
          title: pick(w, `Global index reached ${fmt(today)} (${bandName(today)})`, `Cyber threat level is ${bandName(today)}`),
          body: pick(w, `Crossed your ${rule.value} threshold, ${signed(today - yesterday)} in 24h.`, `It went past your alert level of ${rule.value}.`),
          data: { path: "/" },
          urgent: today >= SEVERE,
        }],
      };
    }

    case "sector":
    case "region":
    case "vector": {
      if (lastKey === ctx.day) return null;
      const hits: { id: string; pair: Pair }[] = [];
      for (const id of rule.targets) {
        const pair = rule.kind === "vector" ? ctx.vectors.get(id) : ctx.areas.get(`${rule.kind}:${id}`);
        if (!pair) continue;
        const fired = rule.condition === "jump"
          ? Math.abs(pair.today - pair.yesterday) >= rule.value
          : pair.today >= rule.value && pair.yesterday < rule.value;
        if (fired) hits.push({ id, pair });
      }
      if (!hits.length) return null;
      const name = (id: string) =>
        rule.kind === "vector" ? ctx.names.vectors[id] ?? id : areaName(ctx, rule.kind as "sector" | "region", id);
      const top = hits.reduce((a, b) => (b.pair.today > a.pair.today ? b : a));
      const more = hits.length > 1 ? ` and ${hits.length - 1} more` : "";
      const what = rule.kind === "vector" ? "" : rule.kind === "sector" ? " sector" : "";
      const title = rule.condition === "jump"
        ? pick(w, `${name(top.id)}${what} moved ${signed(top.pair.today - top.pair.yesterday)} in 24h${more}`, `${name(top.id)}${more} changed sharply today`)
        : pick(w, `${name(top.id)}${what} reached ${fmt(top.pair.today)} (${bandName(top.pair.today)})${more}`, `${name(top.id)}${more}: threat level ${bandName(top.pair.today)}`);
      return {
        key: ctx.day,
        drafts: [{
          ruleId: rule.id,
          kind: "alert",
          title,
          body: hits.map((h) => `${name(h.id)} ${fmt(h.pair.today)} (${signed(h.pair.today - h.pair.yesterday)})`).join(", "),
          data: rule.kind === "vector" ? { path: "/" } : { path: "/now/breakdown", params: { view: rule.kind === "sector" ? "sectors" : "regions" } },
          urgent: rule.condition === "above" && hits.some((h) => h.pair.today >= SEVERE),
        }],
      };
    }

    case "vuln": {
      const latest = ctx.flaws.at(-1)?.at ?? ctx.now.toISOString();
      // First run for this rule: start from now rather than announcing everything already listed.
      if (lastKey === undefined) return { drafts: [], key: latest };
      const fresh = ctx.flaws.filter((f) => f.at > lastKey && ((f.epss ?? 0) >= LIKELY_EPSS || f.ransomware));
      const key = ctx.flaws.filter((f) => f.at > lastKey).at(-1)?.at ?? lastKey;
      return {
        key,
        drafts: fresh.map((f) => ({
          ruleId: rule.id,
          kind: "alert",
          title: pick(w, f.title.technical, f.title.plain),
          body: pick(
            w,
            `${f.epss !== null ? `EPSS ${f.epss.toFixed(2)}` : "EPSS n/a"}${f.ransomware ? " · used by ransomware" : ""}`,
            f.ransomware ? "Ransomware gangs are using it. Update it now." : "It's being used in attacks. Update it now.",
          ),
          data: { path: `/threat/${f.id}` },
          urgent: false,
        })),
      };
    }

    case "digest": {
      if (rule.condition !== "daily") return null; // weekly summaries are milestone 3
      const local = localTime(ctx.now, device.timeZone);
      if (local.hour !== 7 || lastKey === local.date) return null;
      const { today, yesterday } = ctx.index;
      const hottest = [...ctx.areas].filter(([k]) => k.startsWith("sector:")).sort((a, b) => b[1].today - a[1].today)[0];
      const hot = hottest ? `${areaName(ctx, "sector", hottest[0].slice(7))} ${fmt(hottest[1].today)}` : null;
      return {
        key: local.date,
        drafts: [{
          ruleId: rule.id,
          kind: "morning",
          title: pick(w, `Morning briefing: ${fmt(today)}, ${bandName(today)}`, `Today's cyber weather: ${bandName(today)}`),
          body: pick(
            w,
            `${signed(today - yesterday)} in 24h.${hot ? ` Hottest sector: ${hot}.` : ""}`,
            `${today > yesterday ? "Up" : today < yesterday ? "Down" : "No change"} since yesterday.${hot ? ` Most at risk: ${hot.split(" ")[0]}.` : ""}`,
          ),
          data: { path: "/" },
          urgent: false,
        }],
      };
    }
  }
}

export interface Plan {
  /** Send now. */
  send: Draft[];
  /** Hold for the end of quiet hours. */
  hold: Draft[];
  /** New state keys by rule id. */
  keys: Map<string, string>;
}

/**
 * Everything for one device this run. `sentToday` counts pushes already sent today (device's local
 * date); `lastKeys` is alert_state.
 */
export function planDevice(device: Device, ctx: Context, lastKeys: Map<string, string>, sentToday: number): Plan {
  const drafts: Draft[] = [];
  const keys = new Map<string, string>();
  for (const rule of device.rules) {
    const result = evaluateRule(rule, device, ctx, lastKeys.get(rule.id));
    if (!result) continue;
    keys.set(rule.id, result.key);
    drafts.push(...result.drafts);
  }

  const quiet = inQuietHours(device, ctx.now);
  const hold = quiet ? drafts.filter((d) => !d.urgent) : [];
  const now = quiet ? drafts.filter((d) => d.urgent) : drafts;
  return { send: capDrafts(now, sentToday, device.wording), hold, keys };
}

/**
 * At most DAILY_CAP separate pushes a day. Past that, what doesn't fit goes out as one bundle, which
 * takes the last slot; once the cap is used up, each run's alerts arrive as a single bundle, so
 * nothing is silently dropped.
 */
export function capDrafts(drafts: Draft[], sentToday: number, wording: Wording): Draft[] {
  const room = DAILY_CAP - sentToday;
  if (drafts.length <= room) return drafts;
  const keep = Math.max(room - 1, 0);
  return [...drafts.slice(0, keep), bundle(drafts.slice(keep), wording)];
}

/** Several alerts as one push: the first title and a count, the rest listed in the body. */
export function bundle(drafts: Draft[], wording: Wording, heading?: string): Draft {
  return {
    ruleId: null,
    kind: "alert",
    title: heading ?? pick(wording, `${drafts.length} new alerts`, `${drafts.length} new alerts`),
    body: drafts.map((d) => d.title).slice(0, 4).join(" · ") + (drafts.length > 4 ? ` · +${drafts.length - 4} more` : ""),
    data: { path: "/alerts" },
    urgent: drafts.some((d) => d.urgent),
  };
}
