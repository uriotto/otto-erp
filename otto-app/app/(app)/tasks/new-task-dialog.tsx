"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, RefreshCw } from "lucide-react";
import { createTask, type TaskFormState } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { CustomerOption, LeadOption, ProjectOption, UserOption } from "./tasks-list";

const init: TaskFormState = {};

export function NewTaskDialog({
  projects,
  users,
  customers,
  leads,
  defaultProjectId,
  onClose,
}: {
  projects: ProjectOption[];
  users: UserOption[];
  customers: CustomerOption[];
  leads: LeadOption[];
  defaultProjectId?: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(createTask, init);
  const toast = useToast();
  const router = useRouter();
  const [recurring, setRecurring] = useState(false);
  const [recurType, setRecurType] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [recurInterval, setRecurInterval] = useState(1);

  useEffect(() => {
    if (state.success) {
      toast.success("המשימה נוצרה");
      onClose();
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">משימה חדשה</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <Field label="כותרת *" name="title" error={state.fieldErrors?.title?.[0]} />

          <Field label="תיאור" name="description" as="textarea" />

          <div className="grid grid-cols-2 gap-3">
            <SelectOptions
              label="פרויקט"
              name="project_id"
              options={projects}
              defaultValue={defaultProjectId}
            >
              <option value="">— ללא —</option>
            </SelectOptions>
            <SelectOptions label="משובץ ל" name="assigned_to" options={users}>
              <option value="">— ללא —</option>
            </SelectOptions>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectOptions label="לקוח" name="customer_id" options={customers}>
              <option value="">— ללא —</option>
            </SelectOptions>
            <SelectOptions label="ליד" name="lead_id" options={leads}>
              <option value="">— ללא —</option>
            </SelectOptions>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectStatic label="סטטוס" name="status" defaultValue="todo">
              <option value="todo">לעשות</option>
              <option value="in_progress">בעבודה</option>
              <option value="review">ביקורת</option>
              <option value="done">הושלם</option>
              <option value="cancelled">בוטל</option>
            </SelectStatic>
            <SelectStatic label="עדיפות" name="priority" defaultValue="medium">
              <option value="low">נמוכה</option>
              <option value="medium">בינונית</option>
              <option value="high">גבוהה</option>
              <option value="urgent">דחוף</option>
            </SelectStatic>
          </div>

          <Field label="תאריך יעד" name="due_date" type="date" />

          {/* Recurring */}
          <div className="border-ink-line rounded-xl border p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="rounded"
              />
              <span className="text-navy flex items-center gap-1.5 text-sm font-medium">
                <RefreshCw size={14} className="text-ink-soft" />
                משימה חוזרת
              </span>
            </label>
            {recurring && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-ink-soft text-sm">כל</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={recurInterval}
                  onChange={(e) => setRecurInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  className="border-ink-line focus:border-navy w-16 rounded-lg border bg-white px-2 py-1.5 text-center text-sm outline-none"
                />
                <select
                  value={recurType}
                  onChange={(e) => setRecurType(e.target.value as typeof recurType)}
                  className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-1.5 text-sm outline-none"
                >
                  <option value="daily">ימים</option>
                  <option value="weekly">שבועות</option>
                  <option value="monthly">חודשים</option>
                </select>
                <input
                  type="hidden"
                  name="recurring_config"
                  value={JSON.stringify({ type: recurType, interval: recurInterval })}
                />
              </div>
            )}
          </div>

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
                  <span>יוצר</span>
                </span>
              ) : (
                "צור משימה"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  error,
  as,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  as?: "textarea";
  defaultValue?: string;
}) {
  const base =
    "w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none border-ink-line focus:border-navy placeholder:text-ink-faded";

  return (
    <div>
      <label className="text-micro text-ink-soft mb-1 block uppercase">{label}</label>
      {as === "textarea" ? (
        <textarea name={name} rows={3} className={base} defaultValue={defaultValue} />
      ) : (
        <input name={name} type={type} className={base} defaultValue={defaultValue} />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SelectOptions({
  label,
  name,
  options,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  options: { id: string; name: string }[];
  defaultValue?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-micro text-ink-soft mb-1 block uppercase">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
      >
        {children}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function SelectStatic({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-micro text-ink-soft mb-1 block uppercase">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
      >
        {children}
      </select>
    </div>
  );
}
