/**
 * Returns a Hebrew relative-time string for a given date.
 * Examples: "כרגע", "לפני 5 דקות", "לפני שעה", "אתמול", "לפני 3 ימים"
 */
export function relativeTimeHebrew(date: string | Date): string {
  const target = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(target.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const future = diffMs < 0;
  const absMs = Math.abs(diffMs);

  const sec = Math.round(absMs / 1000);
  const min = Math.round(absMs / 60_000);
  const hr = Math.round(absMs / 3_600_000);
  const day = Math.round(absMs / 86_400_000);

  if (sec < 45) return "כרגע";

  const prefix = future ? "בעוד" : "לפני";

  if (min < 60) {
    if (min === 1) return `${prefix} דקה`;
    if (min === 2) return `${prefix} שתי דקות`;
    return `${prefix} ${min} דקות`;
  }

  if (hr < 24) {
    if (hr === 1) return `${prefix} שעה`;
    if (hr === 2) return `${prefix} שעתיים`;
    return `${prefix} ${hr} שעות`;
  }

  if (!future && day === 1) return "אתמול";
  if (future && day === 1) return "מחר";

  if (day < 7) {
    if (day === 2) return future ? "בעוד יומיים" : "לפני יומיים";
    return `${prefix} ${day} ימים`;
  }

  const weeks = Math.round(day / 7);
  if (weeks < 5) {
    if (weeks === 1) return `${prefix} שבוע`;
    if (weeks === 2) return future ? "בעוד שבועיים" : "לפני שבועיים";
    return `${prefix} ${weeks} שבועות`;
  }

  const months = Math.round(day / 30);
  if (months < 12) {
    if (months === 1) return `${prefix} חודש`;
    if (months === 2) return future ? "בעוד חודשיים" : "לפני חודשיים";
    return `${prefix} ${months} חודשים`;
  }

  const years = Math.round(day / 365);
  if (years === 1) return `${prefix} שנה`;
  if (years === 2) return future ? "בעוד שנתיים" : "לפני שנתיים";
  return `${prefix} ${years} שנים`;
}
