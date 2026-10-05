// Display names for alert text. The same as src/data/catalog.ts (which the functions can't import,
// because it pulls in app theme code); keep the two in step.

export const VECTOR_NAMES: Record<string, string> = {
  ransomware: "Ransomware",
  exploitation: "Exploitation",
  supply: "Supply chain",
  phishing: "Phishing",
  ddos: "DDoS",
  insider: "Insider / other",
};

export const SECTOR_NAMES: Record<string, string> = {
  health: "Health",
  finance: "Finance",
  government: "Government",
  technology: "Technology",
  energy: "Energy",
  telecom: "Telecom",
  manufacturing: "Manufacturing",
  education: "Education",
  retail: "Retail",
  transport: "Transport",
};

export const REGION_NAMES: Record<string, string> = {
  nam: "North America",
  europe: "Europe",
  apac: "APAC",
  mea: "Middle East & Africa",
  latam: "Latin America",
};
