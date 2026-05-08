"use client";

import { useActionState, useEffect } from "react";
import { X } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { updateProject, type ProjectFormState } from "../actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

const init: ProjectFormState = {};

export function EditProjectDialog({
  project,
  customers,
  parentOptions,
  onClose,
}: {
  project: Tables<"projects">;
  customers: { id: string; name: string }[];
  parentOptions: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(updateProject, init);
  const toast = useToast();

  useEffect(() => {
    if (state.success) {
      toast.success("הפרויקט עודכן");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">עריכת פרויקט</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={project.id} />

          <Field
            label="שם הפרויקט *"
            name="name"
            defaultValue={project.name}
            error={state.fieldErrors?.name?.[0]}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="לקוח"
              name="customer_id"
              defaultValue={project.customer_id ?? ""}
              options={customers}
            >
              <option value="">— ללא —</option>
            </Select>
            <Select
              label="פרויקט אב"
              name="parent_project_id"
              defaultValue={project.parent_project_id ?? ""}
              options={parentOptions}
            >
              <option value="">— ראשי —</option>
            </Select>
          </div>

          <Field
            label="תיאור"
            name="description"
            as="textarea"
            defaultValue={project.description ?? ""}
          />

          <div className="grid grid-cols-2 gap-3">
            <SelectStatic label="סטטוס" name="status" defaultValue={project.status}>
              <option value="planning">תכנון</option>
              <option value="active">פעיל</option>
              <option value="on_hold">בהמתנה</option>
              <option value="completed">הושלם</option>
              <option value="cancelled">בוטל</option>
            </SelectStatic>
            <SelectStatic
              label="מודל חיוב"
              name="billing_model"
              defaultValue={project.billing_model}
            >
              <option value="hourly">שעתי</option>
              <option value="hour_bank">בנק שעות</option>
              <option value="fixed_price">מחיר קבוע</option>
              <option value="retainer">ריטיינר</option>
            </SelectStatic>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectStatic label="שלב" name="phase" defaultValue={project.phase ?? ""}>
              <option value="">— ללא —</option>
              <option value="discovery">איפיון ראשוני</option>
              <option value="specification">איפיון מפורט</option>
              <option value="development">פיתוח</option>
              <option value="qa">בדיקות</option>
              <option value="launch">השקה</option>
              <option value="maintenance">תחזוקה</option>
            </SelectStatic>
            <SelectStatic label="בריאות" name="health" defaultValue={project.health}>
              <option value="on_track">בקצב</option>
              <option value="at_risk">בסיכון</option>
              <option value="off_track">מחוץ למסלול</option>
            </SelectStatic>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="תקציב (₪)"
              name="budget"
              type="number"
              defaultValue={project.budget != null ? String(project.budget) : ""}
            />
            <Field
              label="שעות מוערכות"
              name="estimated_hours"
              type="number"
              defaultValue={project.estimated_hours != null ? String(project.estimated_hours) : ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="תאריך התחלה"
              name="start_date"
              type="date"
              defaultValue={project.start_date ?? ""}
            />
            <Field
              label="תאריך יעד"
              name="due_date"
              type="date"
              defaultValue={project.due_date ?? ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="תחילת אחריות"
              name="warranty_start"
              type="date"
              defaultValue={project.warranty_start ?? ""}
            />
            <Field
              label="סיום אחריות"
              name="warranty_end"
              type="date"
              defaultValue={project.warranty_end ?? ""}
            />
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
        <textarea name={name} rows={2} className={base} defaultValue={defaultValue} />
      ) : (
        <input name={name} type={type} className={base} defaultValue={defaultValue} />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { id: string; name: string }[];
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
