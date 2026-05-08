"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { updateInvoice } from "../actions";
import type { EditableInvoice } from "./invoice-actions-bar";

export function EditInvoiceDialog({
  invoice,
  onClose,
}: {
  invoice: EditableInvoice;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [number, setNumber] = useState(invoice.number ?? "");
  const [issueDate, setIssueDate] = useState(invoice.issue_date ?? "");
  const [dueDate, setDueDate] = useState(invoice.due_date ?? "");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [finbotUrl, setFinbotUrl] = useState(invoice.finbot_url ?? "");
  const [finbotId, setFinbotId] = useState(invoice.finbot_invoice_id ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateInvoice({
        id: invoice.id,
        number: number.trim() || null,
        issue_date: issueDate || undefined,
        due_date: dueDate || null,
        notes: notes.trim() || null,
        finbot_url: finbotUrl.trim() || null,
        finbot_invoice_id: finbotId.trim() || null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("החשבונית עודכנה");
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">עריכת חשבונית</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="מספר חשבונית">
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className={baseInput}
              dir="ltr"
              placeholder="הזן ידנית מ-Finbot"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך הוצאה">
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className={baseInput}
              />
            </Field>
            <Field label="תשלום עד">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={baseInput}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Finbot URL">
              <input
                type="url"
                value={finbotUrl}
                onChange={(e) => setFinbotUrl(e.target.value)}
                className={baseInput}
                dir="ltr"
                placeholder="https://"
              />
            </Field>
            <Field label="Finbot Invoice ID">
              <input
                type="text"
                value={finbotId}
                onChange={(e) => setFinbotId(e.target.value)}
                className={baseInput}
                dir="ltr"
              />
            </Field>
          </div>

          <Field label="הערות">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={baseInput}
            />
          </Field>

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

const baseInput =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none border-ink-line focus:border-navy placeholder:text-ink-faded";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-micro text-ink-soft mb-1 block uppercase">{label}</label>
      {children}
    </div>
  );
}
