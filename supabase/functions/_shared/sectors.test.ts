import assert from "node:assert/strict";

import { kevSectors, postSector, RADAR_INDUSTRIES, RADAR_REGIONS } from "./sectors.ts";

Deno.test("leak-site descriptions map to the victim's sector", () => {
  assert.equal(postSector("A regional hospital network serving three counties."), "health");
  assert.equal(postSector("Family-owned manufacturer of industrial pumps."), "manufacturing");
  assert.equal(postSector("Independent school district with 12 campuses."), "education");
  assert.equal(postSector("Community bank and wealth management firm."), "finance");
  assert.equal(postSector("Freight and logistics provider across the Midwest."), "transport");
});

Deno.test("lists of stolen data don't decide the sector", () => {
  // A factory whose leak includes medical and financial records is still manufacturing.
  assert.equal(
    postSector("Steel fabrication company. We took medical records, financial documents and tax returns."),
    "manufacturing",
  );
});

Deno.test("placeholders and unclassifiable text give no sector", () => {
  for (const text of ["", null, undefined, "To be announced...", "No description given.", "Coming soon", "2 posts - 1h"]) {
    assert.equal(postSector(text), null);
  }
});

Deno.test("every sector and region has a Radar mapping, with no industry in two sectors", () => {
  const all = Object.values(RADAR_INDUSTRIES).flat();
  assert.equal(new Set(all).size, all.length);
  assert.equal(Object.keys(RADAR_INDUSTRIES).length, 10);
  assert.equal(Object.keys(RADAR_REGIONS).length, 5);
  for (const r of Object.values(RADAR_REGIONS)) assert.ok(r.location || r.continent);
});

Deno.test("KEV vendors map to a sector only when their products belong to one", () => {
  assert.deepEqual(kevSectors("Siemens"), ["energy", "manufacturing"]);
  assert.deepEqual(kevSectors("Schneider Electric "), ["energy", "manufacturing"]);
  assert.deepEqual(kevSectors("NextGen Healthcare"), ["health"]);
  assert.deepEqual(kevSectors("PaperCut"), ["education"]);
  for (const vendor of ["Microsoft", "Cisco", "Fortinet", "Ivanti", "Hikvision", "Sangoma"]) {
    assert.deepEqual(kevSectors(vendor), [], vendor);
  }
});
