"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { updateTimeEntry, type TimeEntryFormState } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { CustomerOpt, ProjectOpt, TaskOpt, TimeEntryItem } from "./time-list";

const init: TimeEntryFormState = {};

function dateStr(iso: string | null): string {
  if (!iso) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeStr(iso: string | null): string {
  if (!iso) return "09:00";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildIso(date: string, time: string): string {
  if (!date || !time) return "";
  return new Date(`${date}T${time}`).toISOString();
}

function durationMinutes(date: string, startT: string, endT: string): number {
  const s = new Date(`${date}T${startT}`).getTime();
  const e = new Date(`${date}T${endT}`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  return Math.ceil((e - s) / 60000);
}

function addMinutesToTime(time: string, minutesToAdd: number): string {
  const parts = time.split(":").map((v) => parseInt(v, 10));
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const total = h * 60 + m + minutesToAdd;
  const safe = Math.max(0, Math.min(60 * 24 - 1, total));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function EditTimeEntryDialog({
  entry,
  customers,
  projects,
  tasks,
  onClose,
}: {
  entry: TimeEntryItem;
  customers: CustomerOpt[];
  projects: ProjectOpt[];
  tasks: TaskOpt[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(updateTimeEntry, init);
  const toast = useToast();

  const [date, setDate] = useState(dateStr(entry.start_time));
  const [startT, setStartT] = useState(timeStr(entry.start_time));
  const [endT, setEndT] = useState(timeStr(entry.end_time));
  const [duration, setDuration] = useState<number>(entry.duration_minutes ?? 60);
  const [customerId, setCustomerId] = useState(entry.customer_id ?? "");
  const [projectId, setProjectId] = useState(entry.project_id ?? "");
  const [taskId, setTaskId] = useState(entry.task_id ?? "");
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [billable, setBillable] = useState<boolean>(entry.billable);

  // Track which field was edited last to avoid feedback loops
  const editing = useRef<"start" | "end" | "duration" | null>(null);

  // When start changes, keep duration constant → adjust end
  useEffect(() => {
    if (editing.current !== "start") return;
     
    setEndT(addMinutesToTime(startT, duration));
    editing.current = null;
  }, [startT, duration]);

  // When end changes, recompute duration
  useEffect(() => {
    if (editing.current !== "end") return;
    const d = durationMinutes(date, startT, endT);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d > 0) setDuration(d);
    editing.current = null;
  }, [endT, date, startT]);

  // When duration changes, keep start constant → adjust end
  useEffect(() => {
    if (editing.current !== "duration") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (duration > 0) setEndT(addMinutesToTime(startT, duration));
    editing.current = null;
  }, [duration, startT]);

  useEffect(() => {
    if (state.success) {
      toast.success("הרשומה עודכנה");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose]);

  const filteredProjects = useMemo(
    () => (customerId ? projects.filter((p) => p.customer_id === customerId) : projects),
    [projects, customerId],
  );
  const filteredTasks = useMemo(
    () => (projectId ? tasks.filter((t) => t.project_id === projectId) : []),
    [tasks, projectId],
  );

  const startISO = buildIso(date, startT);
  const endISO = buildIso(date, endT);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">עריכת רישום זמן</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="start_time" value={startISO} />
          <input type="hidden" name="end_time" value={endISO} />

          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">תאריך</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-micro text-ink-soft mb-1 block uppercase">התחלה</label>
              <input
                type="time"
                value={startT}
                onChange={(e) => {
                  editing.current = "start";
                  setStartT(e.target.value);
                }}
                className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-micro text-ink-soft mb-1 block uppercase">סיום</label>
              <input
                type="time"
                value={endT}
                onChange={(e) => {
                  editing.current = "end";
                  setEndT(e.target.value);
                }}
                className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-micro text-ink-soft mb-1 block uppercase">משך (דקות)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={duration || ""}
                onChange={(e) => {
                  editing.current = "duration";
                  setDuration(parseInt(e.target.value || "0", 10));
                }}
                className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">לקוח</label>
            <select
              name="customer_id"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setProjectId("");
                setTaskId("");
              }}
              className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="">— ללא —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-micro text-ink-soft mb-1 block uppercase">פרויקט</label>
              <select
                name="project_id"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setTaskId("");
                }}
                disabled={!customerId}
                className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none disabled:opacity-50"
              >
                <option value="">— ללא —</option>
                {filteredProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-micro text-ink-soft mb-1 block uppercase">משימה</label>
              <select
                name="task_id"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                disabled={!projectId}
                className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none disabled:opacity-50"
              >
                <option value="">— ללא —</option>
                {filteredTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">הערות</label>
            <textarea
              name="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="billable"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
            />
            לחיוב
          </label>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border-ink-line text-navy hover:border-navy rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="bg-navy text-cream-paper hover:bg-navy-deep rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <Spinner size={14} />
                  <span>שומר</span>
                </span>
              ) : (
                "שמור"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
