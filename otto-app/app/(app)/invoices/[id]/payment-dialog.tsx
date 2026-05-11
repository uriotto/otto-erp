"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { recordPayment } from "../actions";
import type { PaymentMethod, PostPaymentDocument } from "../actions";

const POST_PAYMENT_DOCUMENT_LABELS: Record<PostPaymentDocument, string> = {
  none: "אל תפיק מסמך",
  tax_invoice_receipt: "חשבונית מס קבלה",
  receipt: "קבלה",
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "העברה בנקאית",
  credit_card: "כרטיס אשראי",
  bit: "ביט",
  cash: "מזומן",
  check: "המחאה",
  other: "אחר",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PaymentDialog({
  invoiceId,
  balance,
  onClose,
}: {
  invoiceId: string;
  balance: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [amount, setAmount] = useState(balance > 0 ? balance.toFixed(2) : "");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [issueDocument, setIssueDocument] = useState<PostPaymentDocument>("tax_invoice_receipt");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("סכום לא תקין");
      return;
    }

    startTransition(async () => {
      const result = await recordPayment({
        invoice_id: invoiceId,
        amount: amountNum,
        method,
        reference: reference.trim() || null,
        paid_at: paidAt || null,
        notes: notes.trim() || null,
        issue_document: issueDocument,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("התשלום נרשם");
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">רישום תשלום</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {balance > 0 && (
          <div className="bg-cream-deep text-ink-soft mb-4 rounded-lg p-3 text-xs">
            יתרה לתשלום:{" "}
            <span className="text-navy font-mono font-semibold" dir="ltr">
              ₪
              {balance.toLocaleString("he-IL", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="סכום (₪) *">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className={`${baseInput} font-mono`}
              dir="ltr"
            />
          </Field>

          <Field label="אמצעי תשלום">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className={baseInput}
            >
              {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך תשלום">
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className={baseInput}
              />
            </Field>
            <Field label="אסמכתא">
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={baseInput}
                placeholder="מספר העברה / שיק"
                dir="ltr"
              />
            </Field>
          </div>

          <Field label="מסמך להפקה אחרי תשלום">
            <select
              value={issueDocument}
              onChange={(e) => setIssueDocument(e.target.value as PostPaymentDocument)}
              className={baseInput}
            >
              {(Object.keys(POST_PAYMENT_DOCUMENT_LABELS) as PostPaymentDocument[]).map((opt) => (
                <option key={opt} value={opt}>
                  {POST_PAYMENT_DOCUMENT_LABELS[opt]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="הערות">
            <textarea
              rows={2}
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
                  <span>רושם</span>
                </span>
              ) : (
                "רשום תשלום"
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
