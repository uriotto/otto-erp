"use client";

export interface TimerDraft {
  customer_id: string;
  notes: string;
  started_at: string;
}

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100";
export const secondaryClass =
  "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50";
export const primaryClass =
  "rounded-xl bg-[#003f7c] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";

export function localDateTime(iso: string): string {
  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) return "";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}T${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}:${String(value.getSeconds()).padStart(2, "0")}`;
}

export function TimerFields({
  draft,
  onChange,
  customers,
  showStart = true,
  prefix,
}: {
  draft: TimerDraft;
  onChange: (draft: TimerDraft) => void;
  customers: { id: string; name: string }[];
  showStart?: boolean;
  prefix: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor={`${prefix}-customer`}>
          לקוח
        </label>
        <select
          id={`${prefix}-customer`}
          className={inputClass}
          value={draft.customer_id}
          onChange={(e) => onChange({ ...draft, customer_id: e.target.value })}
        >
          <option value="">ללא לקוח (אפשר לבחור בהמשך)</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor={`${prefix}-notes`}>
          על מה עובדים?
        </label>
        <textarea
          id={`${prefix}-notes`}
          className={inputClass}
          rows={2}
          maxLength={4000}
          placeholder="הערות לדיווח השעות"
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
        />
        <p className="mt-1 text-xs text-slate-500">
          {draft.notes.length.toLocaleString("he-IL")} מתוך 4,000 תווים
        </p>
      </div>
      {showStart && (
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor={`${prefix}-start`}>
            שעת התחלה
          </label>
          <input
            id={`${prefix}-start`}
            className={inputClass}
            dir="ltr"
            type="datetime-local"
            step="1"
            required
            value={draft.started_at}
            onChange={(e) => onChange({ ...draft, started_at: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

export function isClosedEntry(entry: { billing_status: string; invoice_id: string | null }) {
  return (
    entry.billing_status === "invoiced" ||
    entry.billing_status === "settled_externally" ||
    entry.billing_status === "cancelled" ||
    !!entry.invoice_id
  );
}
