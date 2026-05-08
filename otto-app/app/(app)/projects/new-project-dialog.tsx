"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createProject, type ProjectFormState } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { CustomerOption, ProjectListItem, TemplateOption } from "./projects-list";

const init: ProjectFormState = {};

export function NewProjectDialog({
  customers,
  templates,
  parentProjects,
  defaultCustomerId,
  onClose,
}: {
  customers: CustomerOption[];
  templates: TemplateOption[];
  parentProjects: ProjectListItem[];
  defaultCustomerId?: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(createProject, init);
  const toast = useToast();
  const router = useRouter();
  const [selectedCustomer, setSelectedCustomer] = useState<string>(defaultCustomerId ?? "");

  const filteredParents = useMemo(() => {
    if (!selectedCustomer) return parentProjects;
    return parentProjects.filter((p) => !p.customer_id || p.customer_id === selectedCustomer);
  }, [parentProjects, selectedCustomer]);

  useEffect(() => {
    if (state.success) {
      toast.success("הפרויקט נוצר");
      onClose();
      if (state.projectId) router.push(`/projects/${state.projectId}`);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">פרויקט חדש</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <Field label="שם הפרויקט *" name="name" error={state.fieldErrors?.name?.[0]} />

          <div className="grid grid-cols-2 gap-3">
            {defaultCustomerId ? (
              <>
                <input type="hidden" name="customer_id" value={defaultCustomerId} />
                <div className="col-span-1">
                  <label className="text-micro text-ink-soft mb-1 block uppercase">לקוח</label>
                  <div className="border-ink-line rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    {customers.find((c) => c.id === defaultCustomerId)?.name ?? "—"}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="text-micro text-ink-soft mb-1 block uppercase">לקוח</label>
                <select
                  name="customer_id"
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
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
            )}
            <Select label="פרויקט אב" name="parent_project_id" options={filteredParents}>
              <option value="">— ראשי —</option>
            </Select>
          </div>

          <Field label="תיאור" name="description" as="textarea" />

          <div className="grid grid-cols-2 gap-3">
            <SelectStatic label="סטטוס" name="status" defaultValue="planning">
              <option value="planning">תכנון</option>
              <option value="active">פעיל</option>
              <option value="on_hold">בהמתנה</option>
              <option value="completed">הושלם</option>
              <option value="cancelled">בוטל</option>
            </SelectStatic>
            <SelectStatic label="מודל חיוב" name="billing_model" defaultValue="hourly">
              <option value="hourly">שעתי</option>
              <option value="hour_bank">בנק שעות</option>
              <option value="fixed_price">מחיר קבוע</option>
              <option value="retainer">ריטיינר</option>
            </SelectStatic>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectStatic label="שלב" name="phase">
              <option value="">— ללא —</option>
              <option value="discovery">איפיון ראשוני</option>
              <option value="specification">איפיון מפורט</option>
              <option value="development">פיתוח</option>
              <option value="qa">בדיקות</option>
              <option value="launch">השקה</option>
              <option value="maintenance">תחזוקה</option>
            </SelectStatic>
            <SelectStatic label="בריאות" name="health" defaultValue="on_track">
              <option value="on_track">בקצב</option>
              <option value="at_risk">בסיכון</option>
              <option value="off_track">מחוץ למסלול</option>
            </SelectStatic>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="תקציב (₪)" name="budget" type="number" />
            <Field label="שעות מוערכות" name="estimated_hours" type="number" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך התחלה" name="start_date" type="date" />
            <Field label="תאריך יעד" name="due_date" type="date" />
          </div>

          {templates.length > 0 && (
            <SelectStatic label="תבנית (אופציונלי)" name="template_id">
              <option value="">— ללא —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectStatic>
          )}

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
                "צור פרויקט"
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
  options,
  children,
}: {
  label: string;
  name: string;
  options: { id: string; name: string }[];
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-micro text-ink-soft mb-1 block uppercase">{label}</label>
      <select
        name={name}
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
