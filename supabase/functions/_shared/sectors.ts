// Maps sources' own industry and location labels onto ThreatDoppler's sectors and regions. Used
// by the edge functions and by scripts/backfill (Node, with --experimental-strip-types), so it has
// no imports and only erasable TypeScript.

export type Sector =
  | "health"
  | "finance"
  | "government"
  | "technology"
  | "energy"
  | "telecom"
  | "manufacturing"
  | "education"
  | "retail"
  | "transport";

export type Region = "nam" | "europe" | "apac" | "mea" | "latam";

/**
 * Sector of a ransomware leak-site post, from the free text the group wrote about the victim, or
 * null. First match wins, most specific first. About 60% of recent posts get a sector. The text is
 * only read here, never stored. Lists of stolen data ("medical records, tax returns") describe the
 * leak rather than the victim, so they're removed before matching.
 */
const RULES: [Sector, RegExp][] = [
  ["health", /\b(hospital|clinic|medical|healthcare|health care|health services|patients?|pharma\w*|dental|dentist|physician|nursing|biotech\w*|laborator(y|ies)|surgery|surgical|orthopedic|pediatric|radiology|veterinar\w*)\b/i],
  ["education", /\b(school|university|college|academy|education\w*|students?|campus|kindergarten|e-learning)\b/i],
  ["government", /\b(government|municipal\w*|city of|county|township|ministry|federal|state agency|public administration|council|police|sheriff|courts?|military)\b/i],
  ["finance", /\b(bank\w*|financial|finance|insurance|insurer|credit union|investment\w*|accounting|accountants?|cpa|wealth|mortgage|lending|loans?|brokerage|asset management|tax)\b/i],
  ["energy", /\b(energy|oil|gas|petroleum|utility|utilities|solar|renewable\w*|mining|power (plant|company|generation))\b/i],
  ["telecom", /\b(telecom\w*|telephone|wireless|internet service provider|isp|broadband|mobile operator)\b/i],
  ["transport", /\b(logistics|transport\w*|trucking|freight|shipping|airlines?|aviation|airport|railway|rail|maritime|courier|fleet)\b/i],
  ["retail", /\b(retail\w*|store|stores|shop|shops|e-?commerce|supermarket|grocery|apparel|fashion|clothing|restaurant\w*|hospitality|hotel\w*|wholesale|distributor|consumer goods)\b/i],
  ["manufacturing", /\b(manufactur\w*|factory|factories|industrial|machinery|automotive|aerospace|chemicals?|plastics|metal\w*|steel|fabricat\w*|engineering|construction|building materials|electronics)\b/i],
  ["technology", /\b(software|it services|information technology|saas|cloud|data center|cyber\w*|computer|web (design|hosting)|semiconductors?)\b/i],
];
const DATA_TYPES =
  /\b(medical|financial|finance|tax|insurance|banking|bank|health|patient|accounting|payroll|hr|personal|employee|customer|client|legal|contracts?)\s+(records?|data|documents?|docs|information|info|files?|statements?|reports?|details|forms?|returns?|accounts?|scans?)\b/gi;
const PLACEHOLDER = /^(to be announced|no description|coming soon|upcoming)/i;

export function postSector(description: string | null | undefined): Sector | null {
  const text = (description ?? "").trim();
  if (!text || PLACEHOLDER.test(text)) return null;
  const cleaned = text.replace(DATA_TYPES, " ");
  return RULES.find(([, re]) => re.test(cleaned))?.[0] ?? null;
}

/**
 * Cloudflare Radar's industry names (layer 7 attack shares) for each sector. Industries that fit
 * none (gambling, media, crypto, real estate…) are left out rather than forced into one.
 */
export const RADAR_INDUSTRIES: Record<Sector, string[]> = {
  health: ["Hospital & Health Care", "Health, Wellness and Fitness", "Pharmaceuticals", "Medical Devices", "Medical Practice", "Biotechnology", "Mental Health Care"],
  finance: ["Financial Services", "Banking", "Insurance", "Capital Markets", "Investment Banking", "Investment Management", "Accounting", "Venture Capital & Private Equity"],
  government: ["Government Administration", "US Federal Government", "Government", "Government Relations", "Military", "Law Enforcement", "Public Safety", "Judiciary", "Legislative Office", "International Affairs"],
  technology: ["Computer Software", "software", "Information Technology and Services", "IT Services", "Internet", "Information Services", "Computer & Network Security", "Computer Hardware", "Computer Networking", "Semiconductors", "Website Design & Managment", "Technology"],
  energy: ["Oil & Energy", "Renewables & Environment", "Utilities", "Mining & Metals"],
  telecom: ["Telecommunications", "Wireless"],
  manufacturing: ["Manufacturing", "Electrical/Electronic Manufacturing", "Automotive", "Machinery", "Chemicals", "Industrial Automation", "Building Materials", "Aviation & Aerospace", "Construction"],
  education: ["Education Management", "Higher Education", "E-Learning", "Education", "Primary/Secondary Education", "Libraries"],
  retail: ["Retail", "Ecommerce", "Supermarkets", "Apparel & Fashion", "Consumer Goods", "Wholesale", "Sporting Goods", "Cosmetics"],
  transport: ["Transportation/Trucking/Railroad", "Airlines/Aviation", "Logistics and Supply Chain", "Maritime", "Package/Freight Delivery"],
};

/**
 * Radar target filters for each region (layer 3 attacks by target location). Lists cover each
 * region's larger internet economies; Europe uses Radar's continent filter. The Middle East sits
 * in Radar's Asia, so APAC and MEA are country lists.
 */
export const RADAR_REGIONS: Record<Region, { location?: string; continent?: string }> = {
  nam: { location: "US,CA" },
  europe: { continent: "EU" },
  apac: { location: "CN,JP,KR,IN,ID,TW,HK,SG,VN,TH,MY,PH,AU,NZ,PK,BD,LK,KH,MM,MN,NP" },
  mea: { location: "AE,SA,IL,TR,EG,ZA,NG,KE,QA,KW,BH,OM,JO,LB,IR,IQ,MA,DZ,TN,GH,ET,TZ,UG,CI,SN,CM,AO" },
  latam: { location: "MX,BR,AR,CO,CL,PE,VE,EC,GT,CU,BO,DO,HN,PY,SV,NI,CR,PA,UY,PR" },
};

/**
 * Sectors a KEV entry's vendor mostly sells to, for tagging feed events. Most KEV entries are
 * products every sector runs (Microsoft, Cisco, Fortinet…) and get none, which the app shows as
 * "All". Only makers whose products clearly belong to a sector are listed: industrial control
 * (PLCs, SCADA, HMIs) is energy and manufacturing; PaperCut is listed because CISA's advisory on
 * its exploitation (AA23-131A) named the education sector.
 */
const KEV_VENDORS: [RegExp, Sector[]][] = [
  [/^(siemens|schneider electric|rockwell|unitronics|openplc|delta electronics|indusoft|trihedral)\b/i, ["energy", "manufacturing"]],
  [/^solarview\b/i, ["energy"]],
  [/^(ptc|dassault syst)/i, ["manufacturing"]],
  [/^nextgen healthcare\b/i, ["health"]],
  [/^(justice av solutions|trimble)\b/i, ["government"]],
  [/^(sierra wireless|simalliance|dasan|arcadyan)\b/i, ["telecom"]],
  [/^sunhillo\b/i, ["transport"]],
  [/^mirasvit\b/i, ["retail"]],
  [/^papercut\b/i, ["education"]],
];

export function kevSectors(vendor: string): Sector[] {
  return KEV_VENDORS.find(([re]) => re.test(vendor.trim()))?.[1] ?? [];
}
