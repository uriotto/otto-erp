"use client";

import { useActionState, useEffect } from "react";
import { X } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { updateLead, type LeadFormState } from "../actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

const init: LeadFormState = {};
const SOURCES = ["אתר", "המלצה", "רשתות חברתיות", "פרסום", "אירוע", "אחר"];
const STATUSES: { value: string; label: string }[] = [
  { value: "new", label: "חדש" },
  { value: "contacted", label: "יצרנו קשר" },
  { value: "qualified", label: "מוכשר" },
  { value: "proposal", label: "הצעה" },
  { value: "won", label: "נסגר" },
  { value: "lost", label: "הפסד" },
];

export function EditLeadDialog({ lead, onClose }: { lead: Tables<"leads">; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateLead, init);
  const toast = useToast();

  useEffect(() => {
    if (state.success) {
      toast.success("הליד עודכן");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">עריכת ליד</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={lead.id} />

          <Field
            label="שם *"
            name="name"
            defaultValue={lead.name}
            error={state.fieldErrors?.name?.[0]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="אימייל"
              name="email"
              type="email"
              defaultValue={lead.email ?? ""}
              error={state.fieldErrors?.email?.[0]}
            />
            <Field label="טלפון" name="phone" type="tel" defaultValue={lead.phone ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="חברה" name="company" defaultValue={lead.company ?? ""} />
            <div>
              <label className="text-micro text-ink-soft mb-1 block uppercase">מקור</label>
              <select
                name="source"
                defaultValue={lead.source ?? ""}
                className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
              >
                <option value="">בחר מקור</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="שווי עסקה (₪)"
              name="value"
              type="number"
              defaultValue={lead.value?.toString() ?? ""}
            />
            <div>
              <label className="text-micro text-ink-soft mb-1 block uppercase">סטטוס</label>
              <select
                name="status"
                defaultValue={lead.status}
                className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Field label="הערות" name="notes" as="textarea" defaultValue={lead.notes ?? ""} />

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
        <textarea name={name} rows={3} className={base} defaultValue={defaultValue} />
      ) : (
        <input name={name} type={type} className={base} defaultValue={defaultValue} />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
