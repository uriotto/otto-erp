"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { updateCustomer, type CustomerFormState } from "../actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

const init: CustomerFormState = {};

const BILLING_LABELS: Record<string, string> = {
  hourly: "שעתי",
  hour_bank: "בנק שעות",
  fixed_price: "מחיר קבוע",
  retainer: "ריטיינר חודשי",
};

export function EditCustomerDialog({
  customer,
  onClose,
}: {
  customer: Tables<"customers">;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(updateCustomer, init);
  const toast = useToast();
  const [billingModel, setBillingModel] = useState(customer.billing_model_default ?? "");

  useEffect(() => {
    if (state.success) {
      toast.success("הלקוח עודכן");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">עריכת לקוח</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={customer.id} />

          <Field
            label="שם *"
            name="name"
            defaultValue={customer.name}
            error={state.fieldErrors?.name?.[0]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="אימייל"
              name="email"
              type="email"
              defaultValue={customer.email ?? ""}
              error={state.fieldErrors?.email?.[0]}
            />
            <Field label="טלפון" name="phone" type="tel" defaultValue={customer.phone ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="חברה" name="company" defaultValue={customer.company ?? ""} />
            <Field
              label="ח.פ / ע.מ"
              name="company_registration_number"
              defaultValue={customer.company_registration_number ?? ""}
            />
          </div>
          <Field
            label="אתר"
            name="website"
            type="url"
            defaultValue={customer.website ?? ""}
            error={state.fieldErrors?.website?.[0]}
          />
          <Field label="כתובת" name="address" defaultValue={customer.address ?? ""} />

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
            <Field
              label="תעריף שעתי (₪)"
              name="hourly_rate_override"
              type="number"
              defaultValue={customer.hourly_rate_override?.toString() ?? ""}
            />
          )}
          {billingModel === "retainer" && (
            <Field
              label="סכום ריטיינר חודשי (₪)"
              name="retainer_monthly_amount"
              type="number"
              defaultValue={customer.retainer_monthly_amount?.toString() ?? ""}
            />
          )}

          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">סטטוס</label>
            <select
              name="status"
              defaultValue={customer.status}
              className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="active">פעיל</option>
              <option value="inactive">לא פעיל</option>
            </select>
          </div>

          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">פורטל לקוחות</label>
            <div className="border-ink-line flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5">
              <input
                type="checkbox"
                name="portal_enabled"
                id="portal_enabled"
                defaultChecked={customer.portal_enabled ?? false}
                value="true"
                className="accent-navy h-4 w-4"
              />
              <label htmlFor="portal_enabled" className="text-ink-soft cursor-pointer text-sm">
                אפשר גישה לפורטל לקוחות
                {customer.email && (
                  <span className="text-ink-faded ms-1 text-xs" dir="ltr">
                    ({customer.email})
                  </span>
                )}
              </label>
            </div>
            {customer.portal_last_login && (
              <p className="text-ink-faded mt-1 text-xs">
                כניסה אחרונה: {new Date(customer.portal_last_login).toLocaleDateString("he-IL")}
              </p>
            )}
          </div>

          <Field label="הערות" name="notes" as="textarea" defaultValue={customer.notes ?? ""} />

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
