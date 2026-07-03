/**
 * Israel-timezone date helpers.
 *
 * All business-date bucketing (which day/month a time entry belongs to, invoice
 * issue dates, monthly billing ranges) is defined by Asia/Jerusalem local time,
 * never by the server's timezone (Vercel runs UTC).
 */

const IL_TZ = "Asia/Jerusalem";

type DateParts = { year: number; month: number; day: number };

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: IL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date (in Israel) of a given instant. */
export function ilDateParts(date: Date): DateParts {
  const [year = 0, month = 0, day = 0] = partsFormatter.format(date).split("-").map(Number);
  return { year, month, day };
}

/** "dd.mm.yyyy" in Israel time. Returns "" for invalid input. */
export function formatDateIL(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const { year, month, day } = ilDateParts(d);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

/** "dd/mm/yyyy" in Israel time (Finbot document date format). */
export function formatDateFinbot(date: Date): string {
  const { year, month, day } = ilDateParts(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/** "yyyy-mm-dd" of today in Israel time. */
export function todayIL(): string {
  return ilDayKey(new Date());
}

/** "yyyy-mm-dd" key (Israel time) of a given instant. */
export function ilDayKey(date: Date): string {
  return partsFormatter.format(date);
}

/** "yyyy-mm" month key (Israel time) of a given instant. */
export function ilMonthKey(date: Date): string {
  return partsFormatter.format(date).slice(0, 7);
}

/** Hebrew short label like "יוני 2026" from a "yyyy-mm" key. */
export function ilMonthKeyLabel(monthKey: string): string {
  const [y = 0, m = 1] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: IL_TZ,
    month: "short",
    year: "numeric",
  }).format(ilWallTimeToUtc(y, m, 1));
}

/** Offset (ms) between Israel local time and UTC at a given instant. */
function ilOffsetMs(atUtcMs: number): number {
  const probe = new Date(atUtcMs);
  const il = new Date(probe.toLocaleString("en-US", { timeZone: IL_TZ }));
  const utc = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
  return il.getTime() - utc.getTime();
}

/** The UTC instant at which a given Israel-local wall time occurs. */
function ilWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  h = 0,
  m = 0,
  s = 0,
  ms = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, h, m, s, ms);
  return new Date(guess - ilOffsetMs(guess));
}

/** Start of an Israel calendar day ("yyyy-mm-dd") as a UTC instant. */
export function ilDayStart(dayKey: string): Date {
  const [y = 0, m = 1, d = 1] = dayKey.split("-").map(Number);
  return ilWallTimeToUtc(y, m, d);
}

/** End of an Israel calendar day ("yyyy-mm-dd") as a UTC instant (23:59:59.999). */
export function ilDayEnd(dayKey: string): Date {
  const [y = 0, m = 1, d = 1] = dayKey.split("-").map(Number);
  return ilWallTimeToUtc(y, m, d, 23, 59, 59, 999);
}

/**
 * Israel-calendar month range as UTC instants.
 * monthOffset: 0 = the month containing `now`, -1 = previous month.
 * `end` is exclusive (start of the following month).
 */
export function ilMonthRange(now: Date, monthOffset = 0): { start: Date; end: Date } {
  const { year, month } = ilDateParts(now);
  const total = year * 12 + (month - 1) + monthOffset;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const nextTotal = total + 1;
  const ny = Math.floor(nextTotal / 12);
  const nm = (nextTotal % 12) + 1;
  return { start: ilWallTimeToUtc(y, m, 1), end: ilWallTimeToUtc(ny, nm, 1) };
}

/** Hebrew label like "יוני 2026" for an Israel-calendar month range start. */
export function ilMonthLabel(monthStart: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: IL_TZ,
    month: "long",
    year: "numeric",
  }).format(monthStart);
}
