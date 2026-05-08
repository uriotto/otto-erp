"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { createTimeEntry, type TimeEntryFormState } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { CustomerOpt, ProjectOpt, TaskOpt } from "./time-list";

const init: TimeEntryFormState = {};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildIso(date: string, time: string): string {
  if (!date || !time) return "";
  return new Date(`${date}T${time}`).toISOString();
}

export function NewTimeEntryDialog({
  customers,
  projects,
  tasks,
  onClose,
}: {
  customers: CustomerOpt[];
  projects: ProjectOpt[];
  tasks: TaskOpt[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(createTimeEntry, init);
  const toast = useToast();

  const [date, setDate] = useState(todayStr());
  const [startT, setStartT] = useState("09:00");
  const [endT, setEndT] = useState("10:00");
  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");

  const filteredProjects = useMemo(
    () => (customerId ? projects.filter((p) => p.customer_id === customerId) : projects),
    [projects, customerId],
  );
  const filteredTasks = useMemo(
    () => (projectId ? tasks.filter((t) => t.project_id === projectId) : []),
    [tasks, projectId],
  );

  useEffect(() => {
    if (state.success) {
      toast.success("הרשומה נוצרה");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">רשומת שעות חדשה</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <div>
            <Label>תאריך</Label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>שעת התחלה</Label>
              <input
                type="time"
                value={startT}
                onChange={(e) => setStartT(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <Label>שעת סיום</Label>
              <input
                type="time"
                value={endT}
                onChange={(e) => setEndT(e.target.value)}
                className={inputCls}
              />
              {state.fieldErrors?.end_time && (
                <p className="mt-1 text-xs text-red-600">{state.fieldErrors.end_time[0]}</p>
              )}
            </div>
          </div>

          <input type="hidden" name="start_time" value={buildIso(date, startT)} />
          <input type="hidden" name="end_time" value={buildIso(date, endT)} />

          <div>
            <Label>לקוח *</Label>
            <select
              name="customer_id"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setProjectId("");
              }}
              className={inputCls}
              required
            >
              <option value="">— בחר לקוח —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {state.fieldErrors?.customer_id && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.customer_id[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>פרויקט</Label>
              <select
                name="project_id"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={inputCls}
                disabled={!customerId}
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
              <Label>משימה</Label>
              <select name="task_id" className={inputCls} disabled={!projectId}>
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
            <Label>הערות</Label>
            <textarea name="notes" rows={2} className={inputCls} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="billable"
              defaultChecked
              className="border-ink-line h-4 w-4 rounded"
            />
            <span className="text-navy">לחיוב</span>
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

const inputCls =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none border-ink-line focus:border-navy placeholder:text-ink-faded";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-micro text-ink-soft mb-1 block uppercase">{children}</label>;
}
