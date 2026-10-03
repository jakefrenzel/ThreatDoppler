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
