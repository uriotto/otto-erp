"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { updateHourBank, type HourBankFormState } from "../actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { EditableBank } from "./hour-bank-actions-bar";

const init: HourBankFormState = {};

export function EditHourBankDialog({ bank, onClose }: { bank: EditableBank; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateHourBank, init);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast.success("הבנק עודכן");
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
          <h2 className="text-display-sm text-navy">עריכת בנק שעות</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={bank.id} />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="שעות שנרכשו *"
              name="purchased_hours"
              type="number"
              step="0.25"
              min="0.25"
              defaultValue={String(bank.purchased_hours)}
            />
            <Field
              label="מחיר לשעה (₪)"
              name="hourly_rate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={String(bank.hourly_rate)}
            />
          </div>

          <Field
            label="תאריך תפוגה"
            name="expiry_date"
            type="date"
            defaultValue={bank.expiry_date ?? ""}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="התראה לפי %"
              name="alert_threshold_pct"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={String(bank.alert_threshold_pct)}
            />
            <Field
              label="התראה לפי שעות"
              name="alert_threshold_hours"
              type="number"
              min="0"
              step="0.25"
              defaultValue={String(bank.alert_threshold_hours)}
            />
          </div>

          <Field label="הערות" name="notes" as="textarea" defaultValue={bank.notes ?? ""} />

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
  as,
  defaultValue,
  step,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  as?: "textarea";
  defaultValue?: string;
  step?: string;
  min?: string;
  max?: string;
}) {
  const base =
    "w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none border-ink-line focus:border-navy placeholder:text-ink-faded";
  return (
    <div>
      <label className="text-micro text-ink-soft mb-1 block uppercase">{label}</label>
      {as === "textarea" ? (
        <textarea name={name} rows={2} className={base} defaultValue={defaultValue} />
      ) : (
        <input
          name={name}
          type={type}
          className={base}
          defaultValue={defaultValue}
          step={step}
          min={min}
          max={max}
        />
      )}
    </div>
  );
}
