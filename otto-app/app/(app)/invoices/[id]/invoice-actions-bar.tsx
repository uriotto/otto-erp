"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Pencil, Wallet, Ban, Trash2, FileOutput, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import {
  cancelInvoice,
  deleteInvoice,
  markInvoiceSent,
  retryFinbotDocument,
  reissueFinbotDocument,
} from "../actions";
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
  document_type: string | null;
  balance: number;
  total: number;
};

export function InvoiceActionsBar({ invoice }: { invoice: EditableInvoice }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const isFinalized = invoice.status === "paid";
  const canSend = invoice.status === "draft" || invoice.status === "pending_review";
  const canCancel = invoice.status !== "paid" && invoice.status !== "cancelled";
  const canEdit = invoice.status !== "paid";
  const canRecordPayment = invoice.status !== "cancelled" && invoice.balance > 0;
  const canDelete = invoice.status === "draft" || invoice.status === "cancelled";
  const isCreationDoc =
    invoice.document_type === "payment_request" || invoice.document_type === "tax_invoice";
  const isOpen = invoice.status !== "cancelled" && invoice.status !== "paid";

  // Issue when no document exists yet (first attempt or after a failure).
  const canIssueFinbot = !invoice.finbot_url && invoice.status !== "cancelled" && isCreationDoc;
  // Re-issue when a document already exists but is wrong and needs replacing.
  const canReissueFinbot = Boolean(invoice.finbot_url) && isOpen && isCreationDoc;

  function handleIssueFinbot() {
    if (!confirm("להפיק את המסמך בפינבוט? אם ללקוח יש מייל, המסמך יישלח אליו.")) return;
    startTransition(async () => {
      const result = await retryFinbotDocument(invoice.id);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success("המסמך הופק בפינבוט");
        router.refresh();
      }
    });
  }

  function handleReissueFinbot() {
    if (
      !confirm(
        "המסמך הקודם בפינבוט לא יבוטל אוטומטית - בטל אותו ידנית בפינבוט.\nלהפיק מסמך חדש? (אם ללקוח יש מייל, המסמך החדש יישלח אליו.)",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await reissueFinbotDocument(invoice.id);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success("מסמך חדש הופק בפינבוט");
        router.refresh();
      }
    });
  }

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

  function handleDelete() {
    if (!confirm("למחוק את החשבונית לצמיתות? לא ניתן לשחזר.")) return;
    startTransition(async () => {
      const result = await deleteInvoice(invoice.id);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success("החשבונית נמחקה");
        router.push("/invoices");
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
        {canIssueFinbot && (
          <button
            type="button"
            onClick={handleIssueFinbot}
            disabled={pending}
            className="border-ink-line text-navy hover:border-navy flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {pending ? <Spinner size={12} /> : <FileOutput size={14} />}
            הפק בפינבוט
          </button>
        )}
        {canReissueFinbot && (
          <button
            type="button"
            onClick={handleReissueFinbot}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
          >
            {pending ? <Spinner size={12} /> : <RefreshCw size={14} />}
            בטל והפק מחדש
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
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className={`${canCancel ? "" : "ms-auto"} flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50`}
          >
            <Trash2 size={14} />
            מחיקה
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
