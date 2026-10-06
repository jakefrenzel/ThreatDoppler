const MINUS = '−';

/** Signed number with a typographic minus, e.g. +6.1, −1.0, 0.0. */
export function signed(n: number, digits = 1): string {
  const fixed = Math.abs(n).toFixed(digits);
  if (Number(fixed) === 0) return (0).toFixed(digits);
  return (n > 0 ? '+' : MINUS) + fixed;
}

/** Error margin, e.g. ±2.4. */
export function plusMinus(n: number, digits = 1): string {
  return `±${n.toFixed(digits)}`;
}

/** Signed integer with "0" for no change. */
export function signedInt(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : r < 0 ? `${MINUS}${Math.abs(r)}` : '0';
}

/** Arrow delta used on onboarding sector rows: ▲5, ▼2, —. */
/** 1 → "1st", 2 → "2nd", 12 → "12th", 23 → "23rd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

export function arrowDelta(n: number): string {
  return n > 0 ? `▲${n}` : n < 0 ? `▼${Math.abs(n)}` : '—';
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const pad = (n: number) => String(n).padStart(2, '0');

export function utcTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** How long ago, for status lines: JUST NOW, 25 MIN AGO, 3H AGO, 2 DAYS AGO. */
export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 2) return 'JUST NOW';
  if (minutes < 60) return `${minutes} MIN AGO`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}H AGO`;
  return `${Math.round(hours / 24)} DAYS AGO`;
}

export function localTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** FRI 02 OCT in local time. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

export function joinUpper(names: string[]): string {
  return names.map((n) => n.toUpperCase()).join(' · ');
}
