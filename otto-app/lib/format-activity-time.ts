/**
 * Hebrew-locale activity time formatting helpers.
 * Centralized so all activity surfaces render times consistently.
 */

export function formatActivityTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatActivityAbsolute(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatActivityRelative(iso: string): string {
  const d = new Date(iso);
  const target = d.getTime();
  const now = Date.now();
  const isFuture = target > now;
  const absMs = Math.abs(target - now);
  const min = Math.round(absMs / 60_000);
  const h = Math.round(absMs / 3_600_000);

  // Calendar-day diff (not 24h diff) — so "tomorrow morning" shows as "מחר" even if <24h
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(d);
  startOfTarget.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);

  const time = formatActivityTime(iso);

  if (min < 2) return "הרגע";
  if (dayDiff === 0) {
    if (h < 1) return isFuture ? `בעוד ${min} דק׳` : `לפני ${min} דק׳`;
    return isFuture ? `היום ב-${time}` : `לפני ${h} שעות`;
  }
  if (dayDiff === 1) return `מחר ב-${time}`;
  if (dayDiff === -1) return `אתמול ב-${time}`;
  if (dayDiff > 1 && dayDiff <= 7) return `בעוד ${dayDiff} ימים`;
  if (dayDiff < -1 && dayDiff >= -7) return `לפני ${Math.abs(dayDiff)} ימים`;
  return formatActivityAbsolute(iso);
}

export function formatMeetingRange(startIso: string, endIso: string): string {
  return `${formatActivityAbsolute(startIso)} – ${formatActivityTime(endIso)}`;
}
