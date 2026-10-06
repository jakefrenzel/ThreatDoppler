// Words events for the app: a feed item (ThreatEvent) and a detail page (ThreatDetail) per event,
// in Technical and Plain wording. Events are facts from the events table (see the events
// migration); nothing here invents numbers.
import type { SectorId, ThreatDetail, ThreatEvent, VectorId, Worded } from "../../../src/data/types.ts";
import { kevSectors } from "./sectors.ts";

export interface EventRow {
  id: string;
  kind: "kev" | "ransom_surge" | "package_wave" | "breach" | "ddos_spike";
  type: ThreatEvent["type"];
  vector: VectorId;
  at: string; // ISO
  magnitude: number;
  // deno-lint-ignore no-explicit-any
  data: Record<string, any>;
}

/** What the detail page needs besides the event: index impact and 14 daily values for its chart. */
export interface EventContext {
  impact: number;
  bins: number[];
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const w = (technical: string, plain: string = technical): Worded => ({ technical, plain });
const dayMonth = (iso: string) => `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const signed = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n < 0 ? `−${Math.abs(n).toFixed(1)}` : "0.0");

/** 1234 → 1.2K, 3400000 → 3.4M. */
export function short(n: number): string {
  const units: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, unit] of units) {
    if (n >= size) return `${(n / size).toFixed(n >= size * 10 ? 0 : 1).replace(/\.0$/, "")}${unit}`;
  }
  return String(Math.round(n));
}

/** "the gentlemen" → "The Gentlemen". Group names come lowercase from RansomLook. */
export const groupName = (g: string) => g.replace(/(^|[\s-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());

const SUFFIX = /[\s,]+(Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Ltd\.?|Limited|LLC|GmbH|AG|S\.A\.|SE|plc)$/i;

/** "Zammad GmbH" + "Zammad" → "Zammad"; "Microsoft" + "Windows" → "Microsoft Windows". */
export function productName(vendor: string, product: string): string {
  const v = vendor.trim().replace(SUFFIX, "").trim();
  const p = product.trim();
  return p.toLowerCase().startsWith(v.toLowerCase()) ? p : `${v} ${p}`;
}

/**
 * KEV's "required action", made short enough for a checklist. Most entries use a few standard
 * phrasings; the long ones add US federal directive boilerplate (BOD 22-01, BOD 26-04) that the
 * deadline tile already covers. The full text is on the KEV entry, which the detail page links to.
 */
export function kevAction(text: string, name: string): Worded {
  const t = text.toLowerCase();
  if (/end-of-life|\beol\b|end-of-service|\beos\b/.test(t)) {
    return w(`${name} is end-of-life: disconnect or replace it`, `${name} is no longer supported: replace it`);
  }
  if (/emergency directive|cisa instructions|cisa’s guidelines|cisa's guidelines/.test(t)) {
    return w(`Follow CISA's guidance for ${name}, linked from the KEV entry`, `Follow the US government's advice for ${name}`);
  }
  if (/mitigation|remediation/.test(t)) {
    return w(`Apply the vendor's mitigations for ${name}, or stop using it until you can`, `Update ${name}, or switch it off until you can`);
  }
  if (/\bupdates?\b/.test(t)) {
    return w(`Update ${name} per vendor instructions`, `Update ${name}, or switch it off until you can`);
  }
  const first = text.split(/(?<=\.)\s/)[0].trim();
  return w(first.length > 120 ? `${first.slice(0, 119).trimEnd()}…` : first, `Follow the maker's advice to fix ${name}`);
}

const ECOSYSTEM_NAMES: Record<string, string> = { npm: "npm", PyPI: "PyPI", RubyGems: "RubyGems", NuGet: "NuGet" };

function ecosystems(data: EventRow["data"]): [string, number][] {
  return Object.entries((data.ecosystems ?? {}) as Record<string, number>).sort((a, b) => b[1] - a[1]);
}

interface Wording {
  title: Worded;
  headline: Worded;
  source: string;
  meta: string;
  tags: ThreatDetail["tags"];
  stats: ThreatDetail["stats"];
  bins: Worded;
  actions: Worded[];
}

function words(e: EventRow): Wording {
  const d = e.data;
  switch (e.kind) {
    case "kev": {
      const name = productName(String(d.vendor), String(d.product));
      const epss = typeof d.epss === "number" ? d.epss.toFixed(2) : null;
      const who = d.ransomware ? "Ransomware gangs are" : "Attackers are";
      return {
        title: w(`CISA adds ${d.cve} (${name}) to KEV${epss ? ` · EPSS ${epss}` : ""}`, `${who} using a flaw in ${name}`),
        headline: w(`${d.cve} added to KEV · ${name}`, `${who} using a flaw in ${name}`),
        source: "CISA KEV",
        meta: epss ? `EPSS ${epss}` : d.due ? `DUE ${dayMonth(d.due)}` : String(d.cve),
        tags: [
          { label: w(d.ransomware ? "Ransomware · Known use" : "Exploitation · Active", "Being used now"), primary: true },
          { label: w("KEV LISTED", "KNOWN TO BE USED") },
          ...(d.cwes?.length ? [{ label: w(String(d.cwes[0])) }] : []),
          { label: w(`SINCE ${dayMonth(String(d.added))}`) },
        ],
        stats: [
          ...(epss ? [{ label: w("EPSS", "CHANCE OF USE"), value: w(epss, Number(epss) >= 0.5 ? "Likely" : "Possible"), mono: true }] : []),
          ...(d.due ? [{ label: w("FEDERAL DEADLINE", "FIX BY (US GOV)"), value: w(dayMonth(d.due)) }] : []),
          { label: w("RANSOMWARE USE", "USED BY GANGS"), value: w(d.ransomware ? "Known" : "Unknown", d.ransomware ? "Yes" : "Not known") },
          { label: w("CVE"), value: w(String(d.cve)), mono: true },
        ],
        bins: w("KEV ADDITIONS · DAILY", "NEW FLAWS BEING USED · DAILY"),
        actions: [
          kevAction(String(d.action), name),
          w(`Check for compromise of ${name} since ${dayMonth(String(d.added))}`, "Ask IT to check it for break-ins"),
        ],
      };
    }
    case "ransom_surge": {
      const g = groupName(String(d.group));
      const n = Number(d.posts);
      return {
        title: w(`${g} posted ${n} victims to its leak site`, `The ${g} ransomware gang claimed ${n} new victims`),
        headline: w(`${g}: ${n} leak-site posts in a day`, `${g} gang claimed ${n} victims`),
        source: "RANSOMLOOK",
        meta: `${n} POSTS`,
        tags: [
          { label: w("Ransomware · Surge", "Happening now"), primary: true },
          { label: w(g.toUpperCase()) },
          { label: w(`ON ${dayMonth(String(d.day))}`) },
        ],
        stats: [
          { label: w("POSTS THAT DAY", "VICTIMS THAT DAY"), value: w(String(n)) },
          { label: w("GROUP", "GANG"), value: w(g) },
        ],
        bins: w(`${g.toUpperCase()} POSTS · DAILY`, "VICTIMS CLAIMED · DAILY"),
        actions: [
          w("Verify offline backups restore cleanly", "Check your backups work and are kept offline"),
          w("Review exposed remote access and MFA coverage", "Review who can log in from outside"),
        ],
      };
    }
    case "package_wave": {
      const n = Number(d.packages);
      const top = ecosystems(d);
      const list = top.slice(0, 3).map(([eco, c]) => `${ECOSYSTEM_NAMES[eco] ?? eco} ${short(c)}`).join(", ");
      const ratio = d.normal ? Math.round(n / Number(d.normal)) : null;
      return {
        title: w(`${short(n)} malicious packages published${list ? ` (${list})` : ""}`, `${short(n)} booby-trapped software packages found`),
        headline: w(`${short(n)} malicious packages in a day`, `${short(n)} booby-trapped software packages`),
        source: "OSV",
        meta: top.length ? `${(ECOSYSTEM_NAMES[top[0][0]] ?? top[0][0]).toUpperCase()} ${short(top[0][1])}` : `${short(n)} PKGS`,
        tags: [
          { label: w("Supply chain · Wave", "Happening now"), primary: true },
          ...(ratio ? [{ label: w(`${ratio}× NORMAL`) }] : []),
          { label: w(`ON ${dayMonth(String(d.day))}`) },
        ],
        stats: [
          { label: w("PACKAGES", "PACKAGES"), value: w(short(n)) },
          ...(ratio ? [{ label: w("VS 28-DAY NORMAL", "VS USUAL"), value: w(`${ratio}×`) }] : []),
          ...top.slice(0, 2).map(([eco, c]) => ({ label: w(eco.toUpperCase()), value: w(short(c)) })),
        ],
        bins: w("MALICIOUS PACKAGES · DAILY", "BAD PACKAGES · DAILY"),
        actions: [
          w("Audit lockfiles for packages published that day", "Ask IT whether you use any of these packages"),
          w("Rotate secrets exposed to build systems", "Change passwords the software could see"),
        ],
      };
    }
    case "breach": {
      const accounts = Number(d.accounts);
      const title = String(d.title);
      return {
        title: w(`${title} breach added to HIBP · ${short(accounts)} accounts`, `${title} data breach: ${short(accounts)} accounts exposed`),
        headline: w(`${title} breach · ${short(accounts)} accounts`, `${title} breach: ${short(accounts)} accounts`),
        source: "HAVE I BEEN PWNED",
        meta: `${short(accounts)} ACCOUNTS`,
        tags: [
          { label: w("Breach · Disclosed", "Data leaked"), primary: true },
          { label: w(d.verified ? "VERIFIED" : "UNVERIFIED", d.verified ? "CONFIRMED" : "NOT CONFIRMED") },
          ...(d.breach_date ? [{ label: w(`BREACHED ${dayMonth(String(d.breach_date))} ${String(d.breach_date).slice(0, 4)}`) }] : []),
        ],
        stats: [
          { label: w("ACCOUNTS", "ACCOUNTS"), value: w(short(accounts)) },
          { label: w("DATA TYPES", "KINDS OF DATA"), value: w(String((d.data_classes ?? []).length)) },
          ...((d.data_classes ?? []).slice(0, 2).map((c: string, i: number) => ({ label: w(i ? "ALSO" : "INCLUDES"), value: w(c) }))),
        ],
        bins: w("BREACHES ADDED · DAILY", "BREACHES DISCLOSED · DAILY"),
        actions: [
          w(`Check exposure for your domains at haveibeenpwned.com`, "Check haveibeenpwned.com for your email address"),
          w("Reset credentials reused from this service and enforce MFA", "Change any password you used there, and turn on two-step login"),
        ],
      };
    }
    case "ddos_spike": {
      const pct = Math.round((Number(d.ratio) - 1) * 100);
      return {
        title: w(`Layer 7 DDoS traffic ${pct}% above its 28-day normal`, "Websites are being flooded with fake traffic"),
        headline: w(`L7 DDoS +${pct}% vs normal`, "Websites flooded with fake traffic"),
        source: "CLOUDFLARE RADAR",
        meta: `+${pct}%`,
        tags: [
          { label: w("DDoS · Spike", "Happening now"), primary: true },
          { label: w("LAYER 7", "WEBSITES") },
          { label: w(`ON ${dayMonth(String(d.day))}`) },
        ],
        stats: [{ label: w("VS 28-DAY NORMAL", "VS USUAL"), value: w(`+${pct}%`) }],
        bins: w("L7 DDOS VOLUME · DAILY", "FAKE TRAFFIC · DAILY"),
        actions: [w("Confirm DDoS mitigation is enabled upstream", "Check your web host is protecting your site")],
      };
    }
  }
}

/** Most sectors listed on an event's detail page. */
const TARGETED_MAX = 4;

/**
 * Sectors an event hit, for the feed's sector filters, and the share of it each took ("who is hit"
 * on the detail page). Only from data that says so: the sectors of a gang's own posts that day
 * (share of its posts whose sector is known), Radar's share of that day's layer 7 attacks per
 * sector, and the vendor map for KEV. Malicious packages are aimed at software developers, so
 * technology. Breaches carry no sector. No sectors means every sector, as the app shows it.
 */
export function eventSectors(e: EventRow): { sectors: SectorId[]; targeted: ThreatDetail["targeted"] } {
  const d = e.data;
  switch (e.kind) {
    case "kev":
      return { sectors: kevSectors(String(d.vendor)), targeted: [] };
    case "package_wave":
      return { sectors: ["technology"], targeted: [] };
    case "ransom_surge": {
      const counts = (Object.entries(d.sectors ?? {}) as [SectorId, number][]).filter(([, n]) => n > 0);
      const known = counts.reduce((a, [, n]) => a + n, 0);
      const ranked = counts.sort((a, b) => b[1] - a[1]);
      return {
        sectors: ranked.map(([s]) => s),
        targeted: ranked.slice(0, TARGETED_MAX).map(([sector, n]) => ({ sector, share: Math.round((100 * n) / known) })),
      };
    }
    case "ddos_spike": {
      // Shares of all attack requests; industries outside the ten sectors make up the rest.
      const ranked = (Object.entries(d.sectors ?? {}) as [SectorId, number][])
        .map(([sector, share]) => ({ sector, share: Math.round(Number(share)) }))
        .filter((t) => t.share >= 1)
        .sort((a, b) => b.share - a.share)
        .slice(0, TARGETED_MAX);
      return { sectors: ranked.map((t) => t.sector), targeted: ranked };
    }
    case "breach":
      return { sectors: [], targeted: [] };
  }
}

/** Feed item and detail page for one event. */
export function describe(e: EventRow, ctx: EventContext): { event: ThreatEvent; detail: ThreatDetail } {
  const x = words(e);
  const { sectors, targeted } = eventSectors(e);
  const impact = Math.round(ctx.impact * 10) / 10;
  const max = Math.max(0, ...ctx.bins);
  return {
    event: {
      id: e.id,
      time: e.at.slice(11, 16),
      type: e.type,
      title: x.title,
      headline: x.headline,
      source: x.source,
      meta: x.meta,
      impact,
      sectors,
      regions: [],
    },
    detail: {
      id: e.id,
      tags: x.tags,
      title: x.title,
      stats: [{ label: w("INDEX IMPACT", "LEVEL IMPACT"), value: w(signed(impact)), highlight: true }, ...x.stats],
      bins: {
        title: x.bins,
        peak: max ? `PEAK ${short(max)} / DAY` : "",
        values: max ? ctx.bins.map((v) => Math.round((v / max) * 100)) : ctx.bins.map(() => 0),
      },
      targeted,
      iocs: [],
      actions: x.actions,
    },
  };
}
