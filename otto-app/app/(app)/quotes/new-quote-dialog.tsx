"use client";

import { useActionState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { createQuote, type QuoteFormState } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

const STATUSES = [
  { value: "draft", label: "טיוטה" },
  { value: "sent", label: "נשלחה" },
  { value: "signed", label: "חתומה" },
  { value: "rejected", label: "נדחתה" },
  { value: "expired", label: "פגה תוקף" },
];

type CustomerOption = { id: string; name: string; company: string | null };
type ProjectOption = { id: string; name: string };

export function NewQuoteDialog({
  customers,
  projects,
  defaultCustomerId,
  defaultProjectId,
  onClose,
}: {
  customers: CustomerOption[];
  projects: ProjectOption[];
  defaultCustomerId?: string;
  defaultProjectId?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [state, action, pending] = useActionState<QuoteFormState, FormData>(createQuote, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast.success("הצעת המחיר נוצרה");
      onClose();
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  const fe = state.fieldErrors ?? {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-navy/40 fixed inset-0" onClick={onClose} />
      <div className="bg-cream-paper relative z-10 w-full max-w-lg rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">הצעת מחיר חדשה</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-navy rounded-lg p-1">
            <X size={18} />
          </button>
        </div>

        <form ref={formRef} action={action} className="space-y-4">
          <div>
            <label className="text-navy mb-1 block text-sm font-medium">כותרת *</label>
            <input
              name="title"
              type="text"
              required
              className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
              placeholder="לדוגמה: הצעת מחיר — עיצוב אתר"
            />
            {fe.title && <p className="mt-1 text-xs text-red-500">{fe.title[0]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-navy mb-1 block text-sm font-medium">לקוח *</label>
              {defaultCustomerId ? (
                <>
                  <input type="hidden" name="customer_id" value={defaultCustomerId} />
                  <p className="border-ink-line bg-cream rounded-xl border px-3 py-2.5 text-sm">
                    {customers.find((c) => c.id === defaultCustomerId)?.name ?? "—"}
                  </p>
                </>
              ) : (
                <select
                  name="customer_id"
                  required
                  className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">בחר לקוח</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` — ${c.company}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {fe.customer_id && <p className="mt-1 text-xs text-red-500">{fe.customer_id[0]}</p>}
            </div>

            <div>
              <label className="text-navy mb-1 block text-sm font-medium">פרויקט</label>
              {defaultProjectId ? (
                <>
                  <input type="hidden" name="project_id" value={defaultProjectId} />
                  <p className="border-ink-line bg-cream rounded-xl border px-3 py-2.5 text-sm">
                    {projects.find((p) => p.id === defaultProjectId)?.name ?? "—"}
                  </p>
                </>
              ) : (
                <select
                  name="project_id"
                  className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">ללא פרויקט</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-navy mb-1 block text-sm font-medium">סכום</label>
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                placeholder="₪"
                dir="ltr"
              />
              {fe.amount && <p className="mt-1 text-xs text-red-500">{fe.amount[0]}</p>}
            </div>

            <div>
              <label className="text-navy mb-1 block text-sm font-medium">סטטוס</label>
              <select
                name="status"
                defaultValue="draft"
                className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-navy mb-1 block text-sm font-medium">קישור למסמך</label>
            <input
              name="document_url"
              type="url"
              className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
              placeholder="https://drive.google.com/..."
              dir="ltr"
            />
            {fe.document_url && <p className="mt-1 text-xs text-red-500">{fe.document_url[0]}</p>}
            <p className="text-ink-faded mt-1 text-xs">Google Drive, Dropbox, או כל URL</p>
          </div>

          <div>
            <label className="text-navy mb-1 block text-sm font-medium">תוקף עד</label>
            <input
              name="valid_until"
              type="date"
              className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-navy mb-1 block text-sm font-medium">הערות</label>
            <textarea
              name="notes"
              rows={2}
              className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-ink-soft hover:text-navy rounded-xl px-4 py-2.5 text-sm"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {pending && <Spinner size={14} />}
              {pending ? "שומר..." : "צור הצעה"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
