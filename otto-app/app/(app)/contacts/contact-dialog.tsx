"use client";

import { useActionState, useEffect } from "react";
import { X } from "lucide-react";
import { createContact, updateContact, type ContactFormState } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { Tables } from "@/lib/supabase/types";

type Customer = { id: string; name: string };
type Contact = Pick<
  Tables<"contacts">,
  "id" | "name" | "role" | "email" | "phone" | "notes" | "customer_id"
>;

const init: ContactFormState = {};

function Field({
  label,
  name,
  type = "text",
  value,
  error,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-micro text-ink-soft mb-1 block uppercase">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        required={required}
        className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function ContactDialog({
  onClose,
  customers,
  contact,
  lockedCustomerId,
}: {
  onClose: () => void;
  customers: Customer[];
  contact?: Contact;
  lockedCustomerId?: string;
}) {
  const isEdit = !!contact;
  const action = isEdit ? updateContact : createContact;
  const [state, formAction, pending] = useActionState(action, init);
  const toast = useToast();

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "איש הקשר עודכן" : "איש הקשר נוצר");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose, isEdit]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="bg-cream w-full max-w-md rounded-t-2xl p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">{isEdit ? "עריכת איש קשר" : "איש קשר חדש"}</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={contact.id} />}
          {lockedCustomerId && <input type="hidden" name="customer_id" value={lockedCustomerId} />}

          <Field
            label="שם *"
            name="name"
            value={contact?.name}
            required
            error={state.fieldErrors?.name?.[0]}
          />
          <Field label="תפקיד" name="role" value={contact?.role ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="אימייל"
              name="email"
              type="email"
              value={contact?.email ?? ""}
              error={state.fieldErrors?.email?.[0]}
            />
            <Field label="טלפון" name="phone" type="tel" value={contact?.phone ?? ""} />
          </div>

          {!lockedCustomerId && (
            <div>
              <label className="text-micro text-ink-soft mb-1 block uppercase">לקוח מקושר</label>
              <select
                name="customer_id"
                defaultValue={contact?.customer_id ?? ""}
                className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
              >
                <option value="">— ללא לקוח —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">הערות</label>
            <textarea
              name="notes"
              defaultValue={contact?.notes ?? ""}
              rows={3}
              className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-ink-soft hover:text-navy rounded-lg px-4 py-2 text-sm transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-navy text-cream-paper flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {pending && <Spinner size={14} />}
              {isEdit ? "שמור" : "צור איש קשר"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
