import assert from "node:assert/strict";

import { describe, type EventRow, groupName, kevAction, productName, short } from "./events.ts";

const at = "2026-10-03T14:05:00Z";
const ctx = { impact: 0.43, bins: [0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4] };

const kev: EventRow = {
  id: "kev-CVE-2026-1234",
  kind: "kev",
  type: "exploit",
  vector: "exploitation",
  at,
  magnitude: 1.94,
  data: {
    cve: "CVE-2026-1234", vendor: "Ivanti", product: "Endpoint Manager Mobile", epss: 0.94, due: "2026-10-24",
    ransomware: false, action: "Apply mitigations per vendor instructions.", added: "2026-10-03", cwes: ["CWE-94"],
  },
};

Deno.test("short numbers", () => {
  assert.equal(short(950), "950");
  assert.equal(short(1234), "1.2K");
  assert.equal(short(12_500), "13K");
  assert.equal(short(3_400_000), "3.4M");
  assert.equal(short(2_000_000), "2M");
});

Deno.test("names", () => {
  assert.equal(groupName("the gentlemen"), "The Gentlemen");
  assert.equal(groupName("lockbit5"), "Lockbit5");
  assert.equal(productName("Zammad GmbH", "Zammad"), "Zammad");
  assert.equal(productName("Microsoft", "Windows"), "Microsoft Windows");
  assert.equal(productName("Cisco Systems, Inc.", "IOS XE"), "Cisco Systems IOS XE");
  assert.equal(productName("Adobe", "Commerce and Magento "), "Adobe Commerce and Magento");
});

Deno.test("a KEV addition reads as the plan's example", () => {
  const { event, detail } = describe(kev, ctx);
  assert.equal(event.title.technical, "CISA adds CVE-2026-1234 (Ivanti Endpoint Manager Mobile) to KEV · EPSS 0.94");
  assert.equal(event.title.plain, "Attackers are using a flaw in Ivanti Endpoint Manager Mobile");
  assert.equal(event.time, "14:05");
  assert.equal(event.impact, 0.4);
  assert.equal(event.source, "CISA KEV");
  assert.equal(detail.stats[0].value.technical, "+0.4");
  assert.equal(detail.actions[0].technical, "Apply the vendor's mitigations for Ivanti Endpoint Manager Mobile, or stop using it until you can");
  assert.deepEqual(detail.bins.values, [0, 25, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100]);
  assert.equal(detail.bins.peak, "PEAK 4 / DAY");
  assert.deepEqual(detail.iocs, []);
});

Deno.test("every kind has both wordings and a source", () => {
  const rows: EventRow[] = [
    kev,
    { ...kev, id: "kev-r", data: { ...kev.data, ransomware: true, epss: null }, type: "ransomware", vector: "ransomware" },
    { id: "ransom-qilin-2026-10-03", kind: "ransom_surge", type: "ransomware", vector: "ransomware", at, magnitude: 14, data: { group: "qilin", posts: 14, day: "2026-10-03" } },
    { id: "packages-2026-10-03", kind: "package_wave", type: "supply", vector: "supply", at, magnitude: 715, data: { packages: 715, day: "2026-10-03", normal: 60, ecosystems: { npm: 700, PyPI: 15 } } },
    { id: "hibp-Acme", kind: "breach", type: "breach", vector: "insider", at, magnitude: 14, data: { title: "Acme", accounts: 1_200_000, data_classes: ["Email addresses", "Passwords"], breach_date: "2026-08-01", verified: true } },
    { id: "ddos-l7-2026-10-03", kind: "ddos_spike", type: "ddos", vector: "ddos", at, magnitude: 1.31, data: { day: "2026-10-03", ratio: 1.31 } },
  ];
  for (const row of rows) {
    const { event, detail } = describe(row, ctx);
    for (const text of [event.title, event.headline, detail.title, ...detail.actions]) {
      assert.ok(text.technical.length > 0 && text.plain.length > 0, `${row.id}: empty wording`);
      assert.ok(!/undefined|NaN|null/.test(text.technical + text.plain), `${row.id}: ${text.technical} / ${text.plain}`);
    }
    assert.ok(event.source.length > 0);
    assert.equal(detail.id, row.id);
  }
  assert.equal(describe(rows[1], ctx).event.title.plain, "Ransomware gangs are using a flaw in Ivanti Endpoint Manager Mobile");
  assert.equal(describe(rows[2], ctx).event.title.technical, "Qilin posted 14 victims to its leak site");
  assert.equal(describe(rows[3], ctx).event.title.technical, "715 malicious packages published (npm 700, PyPI 15)");
  assert.equal(describe(rows[4], ctx).event.title.plain, "Acme data breach: 1.2M accounts exposed");
  assert.equal(describe(rows[5], ctx).event.title.technical, "Layer 7 DDoS traffic 31% above its 28-day normal");
});

Deno.test("KEV required actions are cut to a checklist item", () => {
  const name = "Citrix NetScaler";
  const bod2604 = "Apply mitigations in accordance with vendor instructions, ensuring compliance with CISA’s BOD 26-04 " +
    "Prioritizing Security Updates Based on Risk (see URL in Notes) guidance and CISA’s “Forensics Triage Requirements” " +
    "(see URL in Notes). Follow applicable BOD 26-04 guidance for cloud services or discontinue use of the product if " +
    "mitigations are unavailable.";
  assert.equal(kevAction(bod2604, name).technical, "Apply the vendor's mitigations for Citrix NetScaler, or stop using it until you can");
  assert.equal(kevAction("Apply updates per vendor instructions.", name).technical, "Update Citrix NetScaler per vendor instructions");
  assert.equal(
    kevAction("The impacted product is end-of-life (EoL) and/or end-of-service (EoS). Users should discontinue utilization of the product.", name).technical,
    "Citrix NetScaler is end-of-life: disconnect or replace it",
  );
  assert.equal(
    kevAction("Please adhere to CISA’s guidelines to assess exposure and mitigate risks associated with Cisco SD-WAN devices.", name).plain,
    "Follow the US government's advice for Citrix NetScaler",
  );
  // Short, specific wording is kept as it is.
  assert.equal(kevAction("Contact the vendor for guidance on remediating firmware, per their advisory.", name).technical,
    "Contact the vendor for guidance on remediating firmware, per their advisory.");
  const odd = kevAction(`Reconfigure the appliance. ${"x".repeat(200)}`, name);
  assert.equal(odd.technical, "Reconfigure the appliance.");
  assert.ok(kevAction("y".repeat(300), name).technical.length <= 120);
});
