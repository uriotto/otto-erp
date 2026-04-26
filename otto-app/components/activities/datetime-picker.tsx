"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";

type DatePreset = { label: string; daysFromToday: number };
const DATE_PRESETS: DatePreset[] = [
  { label: "היום", daysFromToday: 0 },
  { label: "מחר", daysFromToday: 1 },
  { label: "בעוד שבוע", daysFromToday: 7 },
  { label: "בעוד חודש", daysFromToday: 30 },
];

const TIME_PRESETS = ["09:00", "12:00", "14:00", "17:00", "19:00"];

export function DateTimePicker({
  name,
  defaultValue,
  defaultDaysFromNow = 1,
  defaultTime = "09:00",
}: {
  name: string;
  defaultValue?: string;
  defaultDaysFromNow?: number;
  defaultTime?: string;
}) {
  const initial = defaultValue
    ? parseLocalIso(defaultValue)
    : computeFromPresets(defaultDaysFromNow, defaultTime);

  const [date, setDate] = useState<string>(initial.date); // YYYY-MM-DD
  const [time, setTime] = useState<string>(initial.time); // HH:MM
  const [showCustom, setShowCustom] = useState(false);

  const today = todayIso();
  const tomorrow = addDaysIso(1);
  const inWeek = addDaysIso(7);
  const inMonth = addDaysIso(30);

  const isCustomDate = ![today, tomorrow, inWeek, inMonth].includes(date);
  const isCustomTime = !TIME_PRESETS.includes(time);

  const combined = `${date}T${time}`;

  return (
    <div className="space-y-2.5">
      <input type="hidden" name={name} value={combined} />

      {/* Date row */}
      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.map((p) => {
          const presetIso = addDaysIso(p.daysFromToday);
          const active = !showCustom && date === presetIso;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setDate(presetIso);
                setShowCustom(false);
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-navy bg-navy text-cream-paper"
                  : "border-ink-line hover:border-navy bg-white"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            showCustom || isCustomDate
              ? "border-navy bg-navy text-cream-paper"
              : "border-ink-line hover:border-navy bg-white"
          }`}
        >
          <Calendar size={12} />
          {isCustomDate && !showCustom ? formatIsoDate(date) : "תאריך אחר"}
        </button>
      </div>

      {(showCustom || isCustomDate) && (
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        />
      )}

      {/* Time row */}
      <div className="flex flex-wrap gap-1.5">
        {TIME_PRESETS.map((t) => {
          const active = time === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTime(t)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-navy bg-navy text-cream-paper"
                  : "border-ink-line hover:border-navy bg-white"
              }`}
            >
              {t}
            </button>
          );
        })}
        <input
          type="time"
          value={isCustomTime ? time : ""}
          onChange={(e) => setTime(e.target.value || "09:00")}
          placeholder="אחר"
          className={`rounded-lg border px-2 py-1.5 text-xs transition-colors outline-none ${
            isCustomTime
              ? "border-navy bg-navy text-cream-paper"
              : "border-ink-line hover:border-navy bg-white"
          }`}
        />
      </div>

      <p className="text-ink-faded text-xs">{formatPreview(combined)}</p>
    </div>
  );
}

function todayIso(): string {
  return addDaysIso(0);
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseLocalIso(local: string): { date: string; time: string } {
  // local format: "YYYY-MM-DDTHH:MM"
  const [date, timePart] = local.split("T");
  return {
    date: date ?? todayIso(),
    time: (timePart ?? "09:00").slice(0, 5),
  };
}

function computeFromPresets(daysFromNow: number, time: string): { date: string; time: string } {
  return { date: addDaysIso(daysFromNow), time };
}

function formatIsoDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  });
}

function formatPreview(local: string): string {
  const d = new Date(local);
  if (isNaN(d.getTime())) return "";
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startTarget = new Date(d);
  startTarget.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startTarget.getTime() - startToday.getTime()) / 86_400_000);
  const time = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  if (dayDiff === 0) return `היום ב-${time}`;
  if (dayDiff === 1) return `מחר ב-${time}`;
  if (dayDiff === -1) return `אתמול ב-${time}`;
  if (dayDiff > 1) return `בעוד ${dayDiff} ימים, ${time}`;
  if (dayDiff < -1) return `לפני ${Math.abs(dayDiff)} ימים, ${time}`;
  return d.toLocaleString("he-IL");
}
