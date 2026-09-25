export type TimeScale = 5 | 10 | 15 | 30;

export const TIME_SCALES: TimeScale[] = [5, 10, 15, 30];

export const DAY_START_MINUTE = 7 * 60; // diary shows 07:00
export const DAY_END_MINUTE = 19 * 60; // through 19:00
export const SLOT_PIXELS = 34; // px per one time-scale slot, e.g. one 15-min row

export function pixelsPerMinute(scale: TimeScale): number {
  return SLOT_PIXELS / scale;
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function combineDateAndMinutes(day: Date, minutes: number): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

export function snapMinutes(minutes: number, scale: TimeScale): number {
  return Math.round(minutes / scale) * scale;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateParam(param?: string | null): Date {
  if (!param || !/^\d{4}-\d{2}-\d{2}$/.test(param)) return startOfDay(new Date());
  const [y, m, d] = param.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export function formatLongDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    date
  );
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export function calcAge(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}
