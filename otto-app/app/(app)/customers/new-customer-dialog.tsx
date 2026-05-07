"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "lucide-react";
import { createCustomer, type CustomerFormState } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

const init: CustomerFormState = {};

const BILLING_LABELS: Record<string, string> = {
  hourly: "שעתי",
  hour_bank: "בנק שעות",
  fixed_price: "מחיר קבוע",
  retainer: "ריטיינר חודשי",
};

export function NewCustomerDialog({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(createCustomer, init);
  const toast = useToast();
  const [billingModel, setBillingModel] = useState("");

  useEffect(() => {
    if (state.success) {
      toast.success("הלקוח נוצר בהצלחה");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-cream w-full max-w-lg rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">לקוח חדש</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <Field label="שם *" name="name" error={state.fieldErrors?.name?.[0]} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="אימייל" name="email" type="email" error={state.fieldErrors?.email?.[0]} />
            <Field label="טלפון" name="phone" type="tel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="חברה" name="company" />
            <Field label="ח.פ / ע.מ" name="company_registration_number" />
          </div>
          <Field label="אתר" name="website" type="url" error={state.fieldErrors?.website?.[0]} />
          <Field label="כתובת" name="address" />

          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">מודל חיוב</label>
            <select
              name="billing_model_default"
              value={billingModel}
              onChange={(e) => setBillingModel(e.target.value)}
              className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="">— ללא —</option>
              {Object.entries(BILLING_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {billingModel === "hourly" && (
            <Field label="תעריף שעתי (₪)" name="hourly_rate_override" type="number" />
          )}
          {billingModel === "retainer" && (
            <Field label="סכום ריטיינר חודשי (₪)" name="retainer_monthly_amount" type="number" />
          )}

          <Field label="הערות" name="notes" as="textarea" />

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
                "צור לקוח"
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
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  as?: "textarea";
}) {
  const base =
    "w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none " +
    "border-ink-line focus:border-navy placeholder:text-ink-faded";

  return (
    <div>
      <label className="text-micro text-ink-soft mb-1 block uppercase">{label}</label>
      {as === "textarea" ? (
        <textarea name={name} rows={3} className={base} />
      ) : (
        <input name={name} type={type} className={base} />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
