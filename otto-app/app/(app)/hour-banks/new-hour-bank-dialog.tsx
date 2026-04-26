"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createHourBank, type HourBankFormState } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { CustomerOption } from "./hour-banks-list";

const init: HourBankFormState = {};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMonthsISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function NewHourBankDialog({
  customers,
  defaultHourlyRate,
  defaultExpiryMonths,
  defaultAlertPct,
  defaultAlertHours,
  onClose,
}: {
  customers: CustomerOption[];
  defaultHourlyRate: number;
  defaultExpiryMonths: number;
  defaultAlertPct: number;
  defaultAlertHours: number;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(createHourBank, init);
  const toast = useToast();
  const router = useRouter();

  const [customerId, setCustomerId] = useState("");
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  const defaultRate = useMemo(() => {
    const c = customers.find((x) => x.id === customerId);
    if (c?.hourly_rate_override != null) return Number(c.hourly_rate_override);
    return defaultHourlyRate;
  }, [customerId, customers, defaultHourlyRate]);

  useEffect(() => {
    if (state.success) {
      toast.success("הבנק נוצר");
      onClose();
      if (state.bankId) router.push(`/hour-banks/${state.bankId}`);
    } else if (state.warning) {
      toast.show(state.warning, "info");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmDuplicate(true);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">בנק שעות חדש</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">לקוח *</label>
            <select
              name="customer_id"
              required
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setConfirmDuplicate(false);
              }}
              className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="">— בחר לקוח —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {state.fieldErrors?.customer_id?.[0] && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.customer_id[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="שעות שנרכשו *"
              name="purchased_hours"
              type="number"
              step="0.25"
              min="0.25"
              error={state.fieldErrors?.purchased_hours?.[0]}
            />
            <Field
              label="מחיר לשעה (₪)"
              name="hourly_rate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={String(defaultRate)}
              key={`rate-${defaultRate}`}
              error={state.fieldErrors?.hourly_rate?.[0]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך רכישה" name="purchase_date" type="date" defaultValue={todayISO()} />
            <Field
              label="תאריך תפוגה"
              name="expiry_date"
              type="date"
              defaultValue={addMonthsISO(defaultExpiryMonths)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="התראה לפי % (כשנשאר)"
              name="alert_threshold_pct"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={String(defaultAlertPct)}
            />
            <Field
              label="התראה לפי שעות"
              name="alert_threshold_hours"
              type="number"
              min="0"
              step="0.25"
              defaultValue={String(defaultAlertHours)}
            />
          </div>

          <Field label="הערות" name="notes" as="textarea" />

          {state.warning && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              {state.warning}
            </div>
          )}
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          {confirmDuplicate && <input type="hidden" name="confirm_duplicate" value="1" />}

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
              ) : confirmDuplicate ? (
                "אשר ויצור"
              ) : (
                "צור בנק"
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
  step,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
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
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
