"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronRight, ChevronLeft, CalendarDays, Grid3X3, Plus, Clock, List } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CalendarTask, CalendarEvent } from "./page";
import { EventDialog, type EventItem } from "./event-dialog";

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DAYS_HE_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

const MONTHS_HE = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

const STATUS_DONE = new Set(["done"]);

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-rose-500",
  high: "bg-orange-400",
  medium: "bg-navy",
  low: "bg-ink-faded",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  meeting: "bg-amber-500",
  call: "bg-teal-500",
  deadline: "bg-rose-500",
  other: "bg-purple-400",
};

type ViewMode = "month" | "week" | "day" | "list";

type CustomerOption = { id: string; name: string; email: string | null };
type ProjectOption = { id: string; name: string; customer_id: string | null };

type DialogState =
  | { open: false }
  | { open: true; mode: "create"; date: string }
  | { open: true; mode: "edit"; event: EventItem };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
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

function eventDateKey(startAt: string): string {
  // ISO string → local date key
  return new Date(startAt).toLocaleDateString("sv-SE"); // "YYYY-MM-DD" in local time
}

// ─── Task chip ───────────────────────────────────────────────────────────────

function TaskChip({ task }: { task: CalendarTask }) {
  const done = STATUS_DONE.has(task.status);
  const dot = PRIORITY_COLORS[task.priority] ?? "bg-navy";

  return (
    <div
      title={task.title}
      className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] leading-tight font-medium ${done ? "bg-cream-shadow text-ink-faded line-through" : "bg-navy-pale/60 text-navy hover:bg-navy-pale"}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="truncate">{task.title}</span>
    </div>
  );
}

// ─── Event chip ──────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  meeting: "פגישה",
  call: "שיחה",
  deadline: "דדליין",
  other: "אחר",
};

function EventChip({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const dot = EVENT_TYPE_COLORS[event.type] ?? "bg-amber-500";
  const startTime = event.all_day
    ? null
    : new Date(event.start_at).toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

  return (
    <button
      type="button"
      title={`${EVENT_TYPE_LABELS[event.type] ?? "אירוע"}: ${event.title}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex w-full items-center gap-1 truncate rounded bg-amber-50 px-1.5 py-0.5 text-start text-[11px] leading-tight font-medium text-amber-800 transition-colors hover:bg-amber-100"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {startTime && (
        <span className="shrink-0 font-mono text-[10px] opacity-70" dir="ltr">
          {startTime}
        </span>
      )}
      <span className="truncate">{event.title}</span>
    </button>
  );
}

// ─── Month view ──────────────────────────────────────────────────────────────

function MonthView({
  year,
  month,
  tasksByDate,
  eventsByDate,
  onDayClick,
  onEventClick,
}: {
  year: number;
  month: number;
  tasksByDate: Map<string, CalendarTask[]>;
  eventsByDate: Map<string, CalendarEvent[]>;
  onDayClick: (dateKey: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
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
      <div className="border-ink-line grid grid-cols-7 border-b">
        {DAYS_HE.map((d) => (
          <div
            key={d}
            className="text-ink-soft py-2 text-center text-[11px] font-semibold tracking-wide uppercase"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid flex-1 grid-cols-7">
        {cells.map((cell, i) => {
          const key = toDateKey(cell);
          const tasks = tasksByDate.get(key) ?? [];
          const events = eventsByDate.get(key) ?? [];
          const total = tasks.length + events.length;
          const inMonth = sameMonth(cell, year, month);
          const today = isToday(cell);

          return (
            <div
              key={i}
              className={`border-ink-line group min-h-[90px] cursor-pointer border-e border-b p-1.5 ${!inMonth ? "bg-cream-deep/50" : "bg-cream-paper hover:bg-cream-deep/30"} ${today ? "ring-navy/30 ring-1 ring-inset" : ""}`}
              onClick={() => onDayClick(key)}
            >
              {/* Date number */}
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${today ? "bg-navy text-white" : inMonth ? "text-navy" : "text-ink-faded"}`}
                >
                  {cell.getDate()}
                </span>
                <Plus className="text-ink-faded h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
              </div>

              {/* Events first (amber), then tasks */}
              <div className="space-y-0.5">
                {events.slice(0, 2).map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
                ))}
                {tasks.slice(0, events.length >= 2 ? 1 : 3).map((t) => (
                  <TaskChip key={t.id} task={t} />
                ))}
                {total > 3 && (
                  <div className="text-ink-faded px-1.5 text-[10px] font-medium">
                    +{total - 3} נוספות
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
  eventsByDate,
  onDayClick,
  onEventClick,
}: {
  weekStart: Date;
  tasksByDate: Map<string, CalendarTask[]>;
  eventsByDate: Map<string, CalendarEvent[]>;
  onDayClick: (dateKey: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="border-ink-line bg-cream-paper sticky top-0 z-10 grid grid-cols-[48px_repeat(7,1fr)] border-b">
        <div />
        {days.map((d) => {
          const today = isToday(d);
          return (
            <div key={d.toISOString()} className="border-ink-line border-s py-2 text-center">
              <div className="text-ink-soft text-[11px] font-semibold">
                {DAYS_HE_SHORT[d.getDay()]}
              </div>
              <div
                className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold ${today ? "bg-navy text-white" : "text-navy"}`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      <div className="border-ink-line grid grid-cols-[48px_repeat(7,1fr)] border-b">
        <div className="text-ink-faded py-1 text-center text-[10px]">כל היום</div>
        {days.map((d) => {
          const key = toDateKey(d);
          const tasks = tasksByDate.get(key) ?? [];
          const events = (eventsByDate.get(key) ?? []).filter((ev) => ev.all_day);
          return (
            <div
              key={key}
              className="border-ink-line hover:bg-cream-deep/30 min-h-[32px] cursor-pointer space-y-0.5 border-s p-1"
              onClick={() => onDayClick(key)}
            >
              {events.map((ev) => (
                <EventChip key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
              ))}
              {tasks.map((t) => (
                <TaskChip key={t.id} task={t} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Hour rows */}
      <div className="relative">
        {HOURS.map((h) => {
          const hasEvents = days.some((d) => {
            const key = toDateKey(d);
            const dayEvents = (eventsByDate.get(key) ?? []).filter(
              (ev) => !ev.all_day && new Date(ev.start_at).getHours() === h,
            );
            return dayEvents.length > 0;
          });

          return (
            <div
              key={h}
              className={`border-ink-line grid grid-cols-[48px_repeat(7,1fr)] border-b ${hasEvents ? "min-h-[56px]" : ""}`}
              style={{ minHeight: hasEvents ? 56 : 40 }}
            >
              <div className="text-ink-faded py-1 pe-2 pt-1.5 text-end text-[11px] leading-none">
                {String(h).padStart(2, "0")}:00
              </div>
              {days.map((d) => {
                const key = toDateKey(d);
                const hourEvents = (eventsByDate.get(key) ?? []).filter(
                  (ev) => !ev.all_day && new Date(ev.start_at).getHours() === h,
                );
                return (
                  <div
                    key={d.toISOString()}
                    className="border-ink-line hover:bg-cream-deep/20 cursor-pointer space-y-0.5 border-s p-0.5"
                    onClick={() => onDayClick(key)}
                  >
                    {hourEvents.map((ev) => (
                      <EventChip key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day view ────────────────────────────────────────────────────────────────

function DayView({
  day,
  tasksByDate,
  eventsByDate,
  onDayClick,
  onEventClick,
}: {
  day: Date;
  tasksByDate: Map<string, CalendarTask[]>;
  eventsByDate: Map<string, CalendarEvent[]>;
  onDayClick: (dateKey: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const key = toDateKey(day);
  const allDayEvents = (eventsByDate.get(key) ?? []).filter((ev) => ev.all_day);
  const allDayTasks = tasksByDate.get(key) ?? [];

  return (
    <div className="flex-1 overflow-auto">
      {/* All-day strip */}
      {(allDayEvents.length > 0 || allDayTasks.length > 0) && (
        <div
          className="border-ink-line hover:bg-cream-deep/30 flex min-h-[36px] cursor-pointer items-start gap-1 border-b p-2"
          onClick={() => onDayClick(key)}
        >
          <span className="text-ink-faded w-12 shrink-0 text-end text-[10px]">כל היום</span>
          <div className="flex flex-1 flex-wrap gap-1">
            {allDayEvents.map((ev) => (
              <EventChip key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
            ))}
            {allDayTasks.map((t) => (
              <TaskChip key={t.id} task={t} />
            ))}
          </div>
        </div>
      )}

      {/* Hour rows */}
      {HOURS.map((h) => {
        const hourEvents = (eventsByDate.get(key) ?? []).filter(
          (ev) => !ev.all_day && new Date(ev.start_at).getHours() === h,
        );
        const isNow = isToday(day) && new Date().getHours() === h;

        return (
          <div
            key={h}
            style={{ minHeight: hourEvents.length > 0 ? 56 : 40 }}
            className={`border-ink-line hover:bg-cream-deep/20 flex cursor-pointer border-b ${isNow ? "bg-amber-50/40" : ""}`}
            onClick={() => onDayClick(key)}
          >
            <div className="text-ink-faded w-12 shrink-0 py-1 pe-2 text-end text-[11px]">
              {String(h).padStart(2, "0")}:00
            </div>
            <div className="flex-1 space-y-0.5 p-0.5">
              {hourEvents.map((ev) => (
                <EventChip key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS_LIST: Record<string, string> = {
  meeting: "פגישה",
  call: "שיחה",
  deadline: "דדליין",
  other: "אחר",
};

const EVENT_TYPE_BADGE: Record<string, string> = {
  meeting: "bg-amber-50 text-amber-700 border-amber-200",
  call: "bg-teal-50 text-teal-700 border-teal-200",
  deadline: "bg-rose-50 text-rose-600 border-rose-200",
  other: "bg-cream-deep text-ink-soft border-ink-line",
};

function ListView({
  events,
  onEventClick,
}: {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );

  const grouped: { key: string; date: Date; items: CalendarEvent[] }[] = [];
  for (const ev of sorted) {
    const key = eventDateKey(ev.start_at);
    const last = grouped[grouped.length - 1];
    if (last?.key === key) {
      last.items.push(ev);
    } else {
      grouped.push({ key, date: new Date(ev.start_at), items: [ev] });
    }
  }

  if (grouped.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <p className="text-ink-faded text-[14px]">אין אירועים להצגה</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-auto px-5 py-4">
      {grouped.map(({ key, date, items }) => (
        <div key={key}>
          <div
            className={`mb-2 text-[12px] font-semibold ${isToday(date) ? "text-navy" : "text-ink-soft"}`}
          >
            {isToday(date)
              ? "היום"
              : `${DAYS_HE[date.getDay()]}, ${date.getDate()} ${MONTHS_HE[date.getMonth()]} ${date.getFullYear()}`}
          </div>
          <div className="space-y-2">
            {items.map((ev) => {
              const startTime = ev.all_day
                ? "כל היום"
                : new Date(ev.start_at).toLocaleTimeString("he-IL", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
              const endTime = ev.all_day
                ? null
                : new Date(ev.end_at).toLocaleTimeString("he-IL", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });

              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick(ev)}
                  className="border-ink-line hover:border-navy/30 bg-cream-paper w-full rounded-xl border p-3 text-start transition-all hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-navy truncate text-[14px] font-medium">{ev.title}</div>
                      {ev.description && (
                        <div className="text-ink-faded mt-0.5 truncate text-[12px]">
                          {ev.description}
                        </div>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${EVENT_TYPE_BADGE[ev.type] ?? EVENT_TYPE_BADGE.other}`}
                    >
                      {EVENT_TYPE_LABELS_LIST[ev.type] ?? ev.type}
                    </span>
                  </div>
                  <div className="text-ink-faded mt-2 flex items-center gap-3 text-[11px]">
                    <span dir="ltr">{endTime ? `${startTime} – ${endTime}` : startTime}</span>
                    {ev.location && <span className="truncate">{ev.location}</span>}
                    {ev.meeting_url && (
                      <span className="text-navy flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Meet
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  tasks: CalendarTask[];
  events: CalendarEvent[];
  customers: CustomerOption[];
  projects: ProjectOption[];
  initialYear: number;
  initialMonth: number;
};

export function CalendarClient({
  tasks,
  events,
  customers,
  projects,
  initialYear,
  initialMonth,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("month");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const todayRef = new Date();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [currentDay, setCurrentDay] = useState<Date>(() => new Date());
  const [dialog, setDialog] = useState<DialogState>({ open: false });

  // Index tasks by due_date
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

  // Index events by start date (local timezone)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = eventDateKey(ev.start_at);
      const existing = map.get(key) ?? [];
      existing.push(ev);
      map.set(key, existing);
    }
    return map;
  }, [events]);

  // Month navigation
  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }
  function goToday() {
    setYear(todayRef.getFullYear());
    setMonth(todayRef.getMonth());
    setWeekStart(startOfWeek(todayRef));
    setCurrentDay(new Date());
  }

  // Week navigation
  function prevWeek() {
    setWeekStart((w) => addDays(w, -7));
  }
  function nextWeek() {
    setWeekStart((w) => addDays(w, 7));
  }

  // Day navigation
  function prevDay() {
    setCurrentDay((d) => addDays(d, -1));
  }
  function nextDay() {
    setCurrentDay((d) => addDays(d, 1));
  }

  function handlePrev() {
    if (view === "month") prevMonth();
    else if (view === "week") prevWeek();
    else if (view === "day") prevDay();
  }
  function handleNext() {
    if (view === "month") nextMonth();
    else if (view === "week") nextWeek();
    else if (view === "day") nextDay();
  }

  const weekEndDisplay = addDays(weekStart, 6);

  const handleDayClick = useCallback((dateKey: string) => {
    setDialog({ open: true, mode: "create", date: dateKey });
  }, []);

  const handleEventClick = useCallback((ev: CalendarEvent) => {
    setDialog({ open: true, mode: "edit", event: ev });
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialog({ open: false });
  }, []);

  const handleDialogSaved = useCallback(() => {
    setDialog({ open: false });
    router.refresh();
  }, [router]);

  return (
    <div className="flex h-full flex-col">
      {/* ── Toolbar ── */}
      <div className="border-ink-line bg-cream-paper flex items-center gap-3 border-b px-5 py-3">
        <h1 className="text-display-sm text-navy me-2">לוח שנה</h1>

        {view !== "list" && (
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="text-ink-soft hover:bg-cream-deep flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              aria-label="הקודם"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              className="text-ink-soft hover:bg-cream-deep flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              aria-label="הבא"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        <span className="text-navy min-w-[160px] text-sm font-semibold">
          {view === "month"
            ? `${MONTHS_HE[month]} ${year}`
            : view === "week"
              ? `${weekStart.getDate()} ${MONTHS_HE[weekStart.getMonth()]} – ${weekEndDisplay.getDate()} ${MONTHS_HE[weekEndDisplay.getMonth()]} ${weekEndDisplay.getFullYear()}`
              : view === "day"
                ? `${DAYS_HE[currentDay.getDay()]}, ${currentDay.getDate()} ${MONTHS_HE[currentDay.getMonth()]} ${currentDay.getFullYear()}`
                : "כל האירועים"}
        </span>

        <button
          onClick={goToday}
          className="border-ink-line text-ink-soft hover:bg-cream-deep rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors"
        >
          היום
        </button>

        <div className="flex-1" />

        {/* New event button */}
        <button
          onClick={() => {
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, "0");
            const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            setDialog({ open: true, mode: "create", date: today });
          }}
          className="bg-navy hover:bg-navy/90 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          אירוע חדש
        </button>

        {/* View toggle */}
        <div className="border-ink-line bg-cream-deep flex items-center gap-0.5 rounded-lg border p-0.5">
          {(
            [
              { v: "month", icon: Grid3X3, label: "חודש" },
              { v: "week", icon: CalendarDays, label: "שבוע" },
              { v: "day", icon: Clock, label: "יום" },
              { v: "list", icon: List, label: "רשימה" },
            ] as const
          ).map(({ v, icon: Icon, label }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              title={`תצוגת ${label}`}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-all ${view === v ? "bg-cream-paper text-navy shadow-card" : "text-ink-soft hover:text-navy"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="border-ink-line bg-cream-deep/50 flex items-center gap-4 border-b px-5 py-1.5">
        <span className="text-ink-faded text-[11px] font-semibold tracking-wide uppercase">
          מקרא:
        </span>
        <span className="text-ink-soft flex items-center gap-1 text-[11px]">
          <span className="bg-navy h-2 w-2 rounded-full" />
          משימה פעילה
        </span>
        <span className="text-ink-soft flex items-center gap-1 text-[11px]">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          דחוף / דדליין
        </span>
        <span className="text-ink-soft flex items-center gap-1 text-[11px]">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          פגישה
        </span>
        <span className="text-ink-soft flex items-center gap-1 text-[11px]">
          <span className="h-2 w-2 rounded-full bg-teal-500" />
          שיחה
        </span>
      </div>

      {/* ── Calendar body ── */}
      {view === "month" && (
        <MonthView
          year={year}
          month={month}
          tasksByDate={tasksByDate}
          eventsByDate={eventsByDate}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
        />
      )}
      {view === "week" && (
        <WeekView
          weekStart={weekStart}
          tasksByDate={tasksByDate}
          eventsByDate={eventsByDate}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
        />
      )}
      {view === "day" && (
        <DayView
          day={currentDay}
          tasksByDate={tasksByDate}
          eventsByDate={eventsByDate}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
        />
      )}
      {view === "list" && <ListView events={events} onEventClick={handleEventClick} />}

      {/* ── Event dialog ── */}
      {dialog.open && (
        <EventDialog
          mode={dialog.mode}
          initialDate={dialog.mode === "create" ? dialog.date : undefined}
          event={dialog.mode === "edit" ? dialog.event : undefined}
          customers={customers}
          projects={projects}
          onClose={handleDialogClose}
          onSaved={handleDialogSaved}
        />
      )}
    </div>
  );
}
