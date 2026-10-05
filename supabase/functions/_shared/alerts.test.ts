import assert from "node:assert/strict";

import { capDrafts, type Context, DAILY_CAP, type Device, type Draft, evaluateRule, inQuietHours, localTime, planDevice, type Rule } from "./alerts.ts";

const rule = (r: Partial<Rule>): Rule => ({
  id: "r1", kind: "index", condition: "above", targets: [], value: 75, enabled: true, push: true, ...r,
});

const device = (d: Partial<Device> = {}): Device => ({
  id: 1,
  timeZone: "America/Chicago",
  wording: "technical",
  quietHours: { enabled: true, start: "22:00", end: "06:30" },
  rules: [],
  ...d,
});

// 2026-10-05 18:00 UTC is 13:00 in Chicago (outside quiet hours).
const ctx = (c: Partial<Context> = {}): Context => ({
  day: "2026-10-04",
  index: { today: 77, yesterday: 72 },
  vectors: new Map([["ransomware", { today: 88, yesterday: 80 }]]),
  areas: new Map([
    ["sector:health", { today: 82, yesterday: 78 }],
    ["sector:finance", { today: 40, yesterday: 47 }],
    ["region:nam", { today: 30, yesterday: 29 }],
  ]),
  names: {
    vectors: { ransomware: "Ransomware" },
    sectors: { health: "Health", finance: "Finance" },
    regions: { nam: "North America" },
  },
  flaws: [],
  now: new Date("2026-10-05T18:00:00Z"),
  ...c,
});

const draft = (title: string, urgent = false): Draft => ({ ruleId: "x", kind: "alert", title, body: "", data: { path: "/" }, urgent });

Deno.test("an index threshold fires on the crossing, once per day", () => {
  const r = rule({ value: 75 });
  const fired = evaluateRule(r, device(), ctx(), undefined);
  assert.equal(fired?.drafts[0].title, "Global index reached 77.0 (High)");
  assert.equal(fired?.key, "2026-10-04");
  assert.equal(evaluateRule(r, device(), ctx(), "2026-10-04"), null, "already fired today");
  assert.equal(evaluateRule(r, device(), ctx({ index: { today: 80, yesterday: 77 } }), undefined), null, "already above");
  assert.equal(evaluateRule(r, device(), ctx({ index: { today: 70, yesterday: 60 } }), undefined), null, "below");
});

Deno.test("plain wording, and Severe crossings are urgent", () => {
  const d = device({ wording: "plain" });
  const fired = evaluateRule(rule({ value: 85 }), d, ctx({ index: { today: 86, yesterday: 84 } }), undefined);
  assert.equal(fired?.drafts[0].title, "Cyber threat level is Severe");
  assert.equal(fired?.drafts[0].urgent, true);
});

Deno.test("band changes fire both ways", () => {
  const r = rule({ condition: "band", value: 0 });
  assert.equal(evaluateRule(r, device(), ctx({ index: { today: 71, yesterday: 69 } }), undefined)?.drafts[0].title, "Global index moves to High (71.0)");
  assert.equal(evaluateRule(r, device(), ctx({ index: { today: 49, yesterday: 51 } }), undefined)?.drafts[0].title, "Global index moves to Guarded (49.0)");
  assert.equal(evaluateRule(r, device(), ctx({ index: { today: 60, yesterday: 55 } }), undefined), null);
});

Deno.test("sector thresholds and jumps, with a link to Breakdown", () => {
  const above = evaluateRule(rule({ kind: "sector", targets: ["health", "finance"], value: 80 }), device(), ctx(), undefined);
  assert.equal(above?.drafts[0].title, "Health sector reached 82.0 (High)");
  assert.deepEqual(above?.drafts[0].data, { path: "/now/breakdown", params: { view: "sectors" } });
  const jump = evaluateRule(rule({ kind: "sector", condition: "jump", targets: ["finance"], value: 5 }), device(), ctx(), undefined);
  assert.equal(jump?.drafts[0].title, "Finance sector moved −7.0 in 24h");
  assert.equal(evaluateRule(rule({ kind: "region", condition: "jump", targets: ["nam"], value: 5 }), device(), ctx(), undefined), null);
});

Deno.test("exploited-flaw rules send likely-used flaws since the last run, starting quietly", () => {
  const flaws = [
    { id: "kev-1", at: "2026-10-05T10:00:00Z", epss: 0.9, ransomware: false, title: { technical: "CISA adds CVE-1", plain: "Flaw 1" } },
    { id: "kev-2", at: "2026-10-05T11:00:00Z", epss: 0.1, ransomware: false, title: { technical: "CISA adds CVE-2", plain: "Flaw 2" } },
    { id: "kev-3", at: "2026-10-05T12:00:00Z", epss: null, ransomware: true, title: { technical: "CISA adds CVE-3", plain: "Flaw 3" } },
  ];
  const r = rule({ kind: "vuln", value: 0 });
  const first = evaluateRule(r, device(), ctx({ flaws }), undefined);
  assert.deepEqual(first?.drafts, []);
  assert.equal(first?.key, "2026-10-05T12:00:00Z");

  const next = evaluateRule(r, device(), ctx({ flaws }), "2026-10-05T09:00:00Z");
  assert.deepEqual(next?.drafts.map((d) => d.data.path), ["/threat/kev-1", "/threat/kev-3"], "kev-2 is unlikely to be used");
  assert.equal(next?.key, "2026-10-05T12:00:00Z");
  assert.deepEqual(evaluateRule(r, device(), ctx({ flaws }), "2026-10-05T12:00:00Z")?.drafts, []);
});

Deno.test("the morning summary goes out in the 07:00 local hour, once", () => {
  const r = rule({ kind: "digest", condition: "daily", value: 0 });
  const at7 = new Date("2026-10-05T12:15:00Z"); // 07:15 in Chicago
  const fired = evaluateRule(r, device(), ctx({ now: at7 }), undefined);
  assert.equal(fired?.drafts[0].title, "Morning briefing: 77.0, High");
  assert.match(fired?.drafts[0].body ?? "", /Hottest sector: Health 82.0/);
  assert.equal(fired?.key, "2026-10-05");
  assert.equal(evaluateRule(r, device(), ctx({ now: at7 }), "2026-10-05"), null);
  assert.equal(evaluateRule(r, device(), ctx(), undefined), null, "13:00 is not the morning");
  assert.equal(evaluateRule(rule({ kind: "digest", condition: "weekly" }), device(), ctx({ now: at7 }), undefined), null);
});

Deno.test("rules that are off, or not set to push, never fire", () => {
  assert.equal(evaluateRule(rule({ enabled: false }), device(), ctx(), undefined), null);
  assert.equal(evaluateRule(rule({ push: false }), device(), ctx(), undefined), null);
});

Deno.test("local time and quiet hours across midnight", () => {
  assert.deepEqual(localTime(new Date("2026-10-05T04:30:00Z"), "America/Chicago"), { date: "2026-10-04", hour: 23, minutes: 23 * 60 + 30 });
  assert.equal(inQuietHours(device(), new Date("2026-10-05T04:30:00Z")), true, "23:30");
  assert.equal(inQuietHours(device(), new Date("2026-10-05T11:00:00Z")), true, "06:00");
  assert.equal(inQuietHours(device(), new Date("2026-10-05T11:45:00Z")), false, "06:45");
  assert.equal(inQuietHours(device({ quietHours: { enabled: false, start: "22:00", end: "06:30" } }), new Date("2026-10-05T04:30:00Z")), false);
});

Deno.test("quiet hours hold alerts, but Severe gets through", () => {
  const d = device({ rules: [rule({ id: "a", value: 75 }), rule({ id: "b", kind: "sector", targets: ["health"], value: 80 })] });
  const night = new Date("2026-10-05T04:30:00Z");
  const plan = planDevice(d, ctx({ now: night }), new Map(), 0);
  assert.equal(plan.send.length, 0);
  assert.equal(plan.hold.length, 2);
  assert.deepEqual([...plan.keys.keys()], ["a", "b"]);

  const severe = planDevice(d, ctx({ now: night, index: { today: 90, yesterday: 70 } }), new Map(), 0);
  assert.deepEqual(severe.send.map((s) => s.ruleId), ["a"]);
});

Deno.test("past the daily cap, the rest are bundled", () => {
  const many = Array.from({ length: 4 }, (_, i) => draft(`Alert ${i + 1}`));
  assert.equal(capDrafts(many, 0, "technical").length, 4);
  const capped = capDrafts(many, DAILY_CAP - 2, "technical");
  assert.equal(capped.length, 2);
  assert.equal(capped[0].title, "Alert 1");
  assert.equal(capped[1].title, "3 new alerts");
  assert.equal(capped[1].body, "Alert 2 · Alert 3 · Alert 4");
  const full = capDrafts(many, DAILY_CAP, "technical");
  assert.equal(full.length, 1, "with the cap used up, one bundle");
  assert.deepEqual(capDrafts([], 0, "technical"), []);
});
