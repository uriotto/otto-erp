"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Pencil, Wallet, Ban } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { cancelInvoice, markInvoiceSent } from "../actions";
import { EditInvoiceDialog } from "./edit-invoice-dialog";
import { PaymentDialog } from "./payment-dialog";
import type { InvoiceStatusUI } from "../invoices-list";

export type EditableInvoice = {
  id: string;
  status: InvoiceStatusUI;
  number: string | null;
  issue_date: string | null;
  due_date: string | null;
  notes: string | null;
  finbot_url: string | null;
  finbot_invoice_id: string | null;
  balance: number;
  total: number;
};

export function InvoiceActionsBar({ invoice }: { invoice: EditableInvoice }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const isFinalized = invoice.status === "paid" || invoice.status === "cancelled";
  const canSend = invoice.status === "draft" || invoice.status === "pending_review";
  const canCancel = invoice.status !== "paid" && invoice.status !== "cancelled";
  const canEdit = invoice.status !== "paid";
  const canRecordPayment = invoice.status !== "cancelled" && invoice.balance > 0;

  function handleSend() {
    if (!confirm("לסמן את החשבונית כנשלחה?")) return;
    startTransition(async () => {
      const result = await markInvoiceSent(invoice.id);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success("החשבונית סומנה כנשלחה");
        router.refresh();
      }
    });
  }

  function handleCancel() {
    if (!confirm("לבטל את החשבונית? פעולה זו אינה הפיכה.")) return;
    startTransition(async () => {
      const result = await cancelInvoice(invoice.id);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success("החשבונית בוטלה");
        router.refresh();
      }
    });
  }

  if (isFinalized && !showEdit && !showPayment) {
    return null;
  }

  return (
    <>
      <div className="border-ink-line mt-5 flex flex-wrap gap-2 border-t pt-4">
        {canRecordPayment && (
          <button
            type="button"
            onClick={() => setShowPayment(true)}
            disabled={pending}
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Wallet size={14} />
            רישום תשלום
          </button>
        )}
        {canSend && (
          <button
            type="button"
            onClick={handleSend}
            disabled={pending}
            className="border-ink-line text-navy hover:border-navy flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {pending ? <Spinner size={12} /> : <Send size={14} />}
            סמן כנשלחה
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="border-ink-line text-navy hover:border-navy flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium transition-colors"
          >
            <Pencil size={14} />
            עריכה
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="ms-auto flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50"
          >
            <Ban size={14} />
            ביטול חשבונית
          </button>
        )}
      </div>

      {showEdit && <EditInvoiceDialog invoice={invoice} onClose={() => setShowEdit(false)} />}
      {showPayment && (
        <PaymentDialog
          invoiceId={invoice.id}
          balance={invoice.balance}
          onClose={() => setShowPayment(false)}
        />
      )}
    </>
  );
}
