"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import type { TaskListItem } from "./tasks-list";

const DAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarView({ tasks }: { tasks: TaskListItem[] }) {
  const [viewing, setViewing] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const todayKey = toDateKey(new Date());
  const year = viewing.getFullYear();
  const month = viewing.getMonth();

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDate = new Map<string, TaskListItem[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const k = t.due_date.slice(0, 10);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(t);
  }

  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = viewing.toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  return (
    <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
      {/* Navigation */}
      <div className="border-ink-line flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewing(new Date(year, month - 1, 1))}
            className="text-ink-soft hover:text-navy rounded-lg p-1.5 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewing(new Date(year, month + 1, 1))}
            className="text-ink-soft hover:text-navy rounded-lg p-1.5 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        <span className="text-navy text-sm font-semibold">{monthLabel}</span>
        <button
          type="button"
          onClick={() => {
            const now = new Date();
            setViewing(new Date(now.getFullYear(), now.getMonth(), 1));
          }}
          className="border-ink-line text-ink-soft hover:text-navy rounded-lg border px-3 py-1 text-xs transition-colors"
        >
          היום
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="border-ink-line grid grid-cols-7 border-b">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-ink-faded py-2 text-center text-[11px] font-semibold">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const isLastCol = i % 7 === 6;
          if (day === null) {
            return (
              <div
                key={`pad-${i}`}
                className={`border-ink-line/30 bg-cream/40 min-h-[5.5rem] border-b ${!isLastCol ? "border-e" : ""}`}
              />
            );
          }
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayTasks = byDate.get(key) ?? [];
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              className={`border-ink-line/30 min-h-[5.5rem] border-b p-1.5 ${!isLastCol ? "border-e" : ""} ${isToday ? "bg-navy/[0.04]" : ""}`}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                    isToday ? "bg-navy text-cream-paper" : "text-ink-soft"
                  }`}
                >
                  {day}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className={`truncate rounded px-1 py-0.5 text-[10px] leading-snug font-medium ${
                      t.status === "done" || t.status === "cancelled"
                        ? "text-ink-faded line-through"
                        : t.priority === "urgent"
                          ? "bg-rose-50 text-rose-700"
                          : t.priority === "high"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <p className="text-ink-faded ps-0.5 text-[10px]">+{dayTasks.length - 3}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
