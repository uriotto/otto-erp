"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronLeft, CalendarDays, Grid3X3 } from "lucide-react";
import type { CalendarTask } from "./page";

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DAYS_HE_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

const MONTHS_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

const STATUS_DONE = new Set(["done"]);

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-rose-500",
  high:   "bg-orange-400",
  medium: "bg-navy",
  low:    "bg-ink-faded",
};

type ViewMode = "month" | "week";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const s = new Date(d);
  s.setDate(d.getDate() - day);
  s.setHours(0, 0, 0, 0);
  return s;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameMonth(d: Date, year: number, month: number): boolean {
  return d.getFullYear() === year && d.getMonth() === month;
}

function isToday(d: Date): boolean {
  const t = new Date();
  return (
    d.getDate() === t.getDate() &&
    d.getMonth() === t.getMonth() &&
    d.getFullYear() === t.getFullYear()
  );
}

// ─── Task chip ───────────────────────────────────────────────────────────────

function TaskChip({ task }: { task: CalendarTask }) {
  const done = STATUS_DONE.has(task.status);
  const dot = PRIORITY_COLORS[task.priority] ?? "bg-navy";

  return (
    <div
      title={task.title}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight truncate
        ${done ? "bg-cream-shadow text-ink-faded line-through" : "bg-navy-pale/60 text-navy hover:bg-navy-pale"}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="truncate">{task.title}</span>
    </div>
  );
}

// ─── Month view ──────────────────────────────────────────────────────────────

function MonthView({
  year,
  month,
  tasksByDate,
}: {
  year: number;
  month: number;
  tasksByDate: Map<string, CalendarTask[]>;
}) {
  // Build a 6-row × 7-col grid starting from the Sunday before the 1st
  const firstDay = new Date(year, month, 1);
  const startDay = new Date(firstDay);
  startDay.setDate(firstDay.getDate() - firstDay.getDay());

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(addDays(startDay, i));
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-ink-line">
        {DAYS_HE.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[11px] font-semibold tracking-wide text-ink-soft uppercase"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1">
        {cells.map((cell, i) => {
          const key = toDateKey(cell);
          const tasks = tasksByDate.get(key) ?? [];
          const inMonth = sameMonth(cell, year, month);
          const today = isToday(cell);

          return (
            <div
              key={i}
              className={`min-h-[90px] border-b border-e border-ink-line p-1.5
                ${!inMonth ? "bg-cream-deep/50" : "bg-cream-paper"}
                ${today ? "ring-1 ring-inset ring-navy/30" : ""}`}
            >
              {/* Date number */}
              <div className="mb-1 flex justify-end">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold
                    ${today ? "bg-navy text-white" : inMonth ? "text-navy" : "text-ink-faded"}`}
                >
                  {cell.getDate()}
                </span>
              </div>

              {/* Tasks — show up to 3, rest as "+N" */}
              <div className="space-y-0.5">
                {tasks.slice(0, 3).map((t) => (
                  <TaskChip key={t.id} task={t} />
                ))}
                {tasks.length > 3 && (
                  <div className="px-1.5 text-[10px] font-medium text-ink-faded">
                    +{tasks.length - 3} נוספות
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week view ───────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function WeekView({
  weekStart,
  tasksByDate,
}: {
  weekStart: Date;
  tasksByDate: Map<string, CalendarTask[]>;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="sticky top-0 z-10 grid grid-cols-[48px_repeat(7,1fr)] border-b border-ink-line bg-cream-paper">
        <div /> {/* spacer for hour column */}
        {days.map((d) => {
          const today = isToday(d);
          return (
            <div
              key={d.toISOString()}
              className="border-s border-ink-line py-2 text-center"
            >
              <div className="text-[11px] font-semibold text-ink-soft">
                {DAYS_HE_SHORT[d.getDay()]}
              </div>
              <div
                className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold
                  ${today ? "bg-navy text-white" : "text-navy"}`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day tasks row */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-ink-line">
        <div className="py-1 text-center text-[10px] text-ink-faded">כל היום</div>
        {days.map((d) => {
          const key = toDateKey(d);
          const tasks = tasksByDate.get(key) ?? [];
          return (
            <div key={key} className="border-s border-ink-line p-1 space-y-0.5 min-h-[32px]">
              {tasks.map((t) => (
                <TaskChip key={t.id} task={t} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Hour rows */}
      <div className="relative">
        {HOURS.map((h) => (
          <div
            key={h}
            className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-ink-line"
            style={{ minHeight: 40 }}
          >
            <div className="py-1 pe-2 text-end text-[11px] text-ink-faded leading-none pt-1.5">
              {String(h).padStart(2, "0")}:00
            </div>
            {days.map((d) => (
              <div key={d.toISOString()} className="border-s border-ink-line" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  tasks: CalendarTask[];
  initialYear: number;
  initialMonth: number;
};

export function CalendarClient({ tasks, initialYear, initialMonth }: Props) {
  const [view, setView] = useState<ViewMode>("month");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const todayRef = new Date();

  // Week state — start from this week's Sunday
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  // Index tasks by due_date key for O(1) lookup
  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      const existing = map.get(key) ?? [];
      existing.push(t);
      map.set(key, existing);
    }
    return map;
  }, [tasks]);

  // Month navigation
  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }
  function goToday() {
    setYear(todayRef.getFullYear());
    setMonth(todayRef.getMonth());
    setWeekStart(startOfWeek(todayRef));
  }

  // Week navigation
  function prevWeek() { setWeekStart(w => addDays(w, -7)); }
  function nextWeek() { setWeekStart(w => addDays(w, 7)); }

  const weekEndDisplay = addDays(weekStart, 6);

  return (
    <div className="flex h-full flex-col">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 border-b border-ink-line bg-cream-paper px-5 py-3">
        {/* Title */}
        <h1 className="text-display-sm text-navy me-2">לוח שנה</h1>

        {/* Nav controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={view === "month" ? prevMonth : prevWeek}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-cream-deep transition-colors"
            aria-label="הקודם"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={view === "month" ? nextMonth : nextWeek}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-cream-deep transition-colors"
            aria-label="הבא"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Current period label */}
        <span className="min-w-[160px] text-sm font-semibold text-navy">
          {view === "month"
            ? `${MONTHS_HE[month]} ${year}`
            : `${weekStart.getDate()} ${MONTHS_HE[weekStart.getMonth()]} – ${weekEndDisplay.getDate()} ${MONTHS_HE[weekEndDisplay.getMonth()]} ${weekEndDisplay.getFullYear()}`}
        </span>

        {/* Today button */}
        <button
          onClick={goToday}
          className="rounded-lg border border-ink-line px-3 py-1.5 text-[13px] font-medium text-ink-soft hover:bg-cream-deep transition-colors"
        >
          היום
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border border-ink-line bg-cream-deep p-0.5">
          <button
            onClick={() => setView("month")}
            title="תצוגת חודש"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all
              ${view === "month" ? "bg-cream-paper text-navy shadow-card" : "text-ink-soft hover:text-navy"}`}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            חודש
          </button>
          <button
            onClick={() => setView("week")}
            title="תצוגת שבוע"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all
              ${view === "week" ? "bg-cream-paper text-navy shadow-card" : "text-ink-soft hover:text-navy"}`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            שבוע
          </button>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 border-b border-ink-line bg-cream-deep/50 px-5 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faded">מקרא:</span>
        <span className="flex items-center gap-1 text-[11px] text-ink-soft">
          <span className="h-2 w-2 rounded-full bg-navy" />
          משימה פעילה
        </span>
        <span className="flex items-center gap-1 text-[11px] text-ink-soft">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          דחוף
        </span>
        <span className="flex items-center gap-1 text-[11px] text-ink-soft">
          <span className="h-2 w-2 rounded-full bg-ink-faded" />
          הושלם
        </span>
      </div>

      {/* ── Calendar body ── */}
      {view === "month" ? (
        <MonthView year={year} month={month} tasksByDate={tasksByDate} />
      ) : (
        <WeekView weekStart={weekStart} tasksByDate={tasksByDate} />
      )}
    </div>
  );
}
