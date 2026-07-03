/**
 * Builds a human-readable hours breakdown from a set of time entries.
 * Used when generating an hours-based invoice so the client receives a detailed
 * report of exactly which hours the invoice covers - both as a text block written
 * into the invoice notes and as a structured array.
 */

import { formatDateIL } from "@/lib/dates";

export type HoursDetailInput = {
  start_time: string | null;
  duration_minutes: number | null;
  description: string | null;
};

export type HoursDetailLine = {
  date: string; // dd.mm.yyyy
  description: string;
  minutes: number;
  hours: number; // rounded to 2 decimals
};

export type HoursDetail = {
  lines: HoursDetailLine[];
  totalMinutes: number;
  totalHours: number;
  notesText: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildHoursDetail(entries: HoursDetailInput[]): HoursDetail {
  const sorted = [...entries].sort((a, b) => {
    const ta = a.start_time ? new Date(a.start_time).getTime() : 0;
    const tb = b.start_time ? new Date(b.start_time).getTime() : 0;
    return ta - tb;
  });

  const lines: HoursDetailLine[] = sorted.map((e) => {
    const minutes = Number(e.duration_minutes) || 0;
    const description = (e.description ?? "").trim() || "ללא תיאור";
    return {
      date: formatDateIL(e.start_time),
      description,
      minutes,
      hours: round2(minutes / 60),
    };
  });

  const totalMinutes = lines.reduce((sum, l) => sum + l.minutes, 0);
  const totalHours = round2(totalMinutes / 60);

  const body = lines
    .map((l) => `${l.date} · ${l.description} · ${l.hours.toFixed(2)}ש׳`)
    .join("\n");

  const notesText = `פירוט שעות:\n${body}\n\nסה״כ: ${totalHours.toFixed(2)} שעות`;

  return { lines, totalMinutes, totalHours, notesText };
}
