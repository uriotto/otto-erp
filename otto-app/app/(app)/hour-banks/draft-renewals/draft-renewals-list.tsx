"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, CheckCircle2, Edit2, FileClock, Trash2 } from "lucide-react";

import { approveRenewalDraft, discardRenewalDraft, type InvoiceDocumentType } from "../actions";

const DOCUMENT_TYPE_OPTIONS: { value: InvoiceDocumentType; label: string }[] = [
  { value: "payment_request", label: "דרישת תשלום" },
  { value: "tax_invoice", label: "חשבונית מס" },
  { value: "tax_invoice_receipt", label: "חשבונית מס קבלה" },
];
import { EditHourBankDialog } from "../[id]/edit-hour-bank-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { relativeTimeHebrew } from "@/lib/relative-time";

export type DraftRenewalItem = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  parent_bank_id: string | null;
  parent_purchased_hours: number | null;
  parent_expiry_date: string | null;
  purchased_hours: number;
  hourly_rate: number;
  expiry_date: string | null;
  alert_threshold_pct: number;
  alert_threshold_hours: number;
  notes: string | null;
  created_at: string;
};

export function DraftRenewalsList({ drafts }: { drafts: DraftRenewalItem[] }) {
  const [editDraft, setEditDraft] = useState<DraftRenewalItem | null>(null);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/hour-banks"
            className="text-ink-soft hover:text-navy mb-2 inline-flex items-center gap-1 text-xs transition-colors"
          >
            <ArrowLeft size={12} />
            חזרה לבנקי שעות
          </Link>
          <h1 className="text-display-md text-navy">טיוטות חידוש</h1>
          <p className="text-ink-soft mt-1 text-sm">
            {drafts.length === 0 ? "אין טיוטות ממתינות" : `${drafts.length} טיוטות ממתינות לאישור`}
          </p>
        </div>
      </div>

      {drafts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <DraftRow key={d.id} draft={d} onEdit={() => setEditDraft(d)} />
          ))}
        </div>
      )}

      {editDraft && (
        <EditHourBankDialog
          bank={{
            id: editDraft.id,
            status: "draft",
            purchased_hours: Number(editDraft.purchased_hours),
            hourly_rate: Number(editDraft.hourly_rate),
            expiry_date: editDraft.expiry_date,
            alert_threshold_pct: editDraft.alert_threshold_pct,
            alert_threshold_hours: editDraft.alert_threshold_hours,
            notes: editDraft.notes,
          }}
          onClose={() => setEditDraft(null)}
        />
      )}
    </div>
  );
}

function DraftRow({ draft, onEdit }: { draft: DraftRenewalItem; onEdit: () => void }) {
  const [pendingApprove, startApprove] = useTransition();
  const [pendingDiscard, startDiscard] = useTransition();
  const [documentType, setDocumentType] = useState<InvoiceDocumentType>("payment_request");
  const router = useRouter();
  const toast = useToast();

  function handleApprove() {
    startApprove(async () => {
      const result = await approveRenewalDraft(draft.id, documentType);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("הטיוטה אושרה והבנק פעיל");
      router.refresh();
      router.push(`/hour-banks/${draft.id}`);
    });
  }

  function handleDiscard() {
    if (!confirm("למחוק את הטיוטה? לא ניתן לשחזר.")) return;
    startDiscard(async () => {
      const result = await discardRenewalDraft(draft.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("הטיוטה נמחקה");
      router.refresh();
    });
  }

  const totalAmount = draft.purchased_hours * draft.hourly_rate;

  return (
    <article className="bg-cream-paper border-ink-line rounded-2xl border p-5 transition-shadow hover:shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <FileClock size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-navy truncate text-base font-semibold">
              {draft.customer_name ?? "—"}
            </h2>
            <span className="text-ink-faded text-[11px]">
              נוצרה {relativeTimeHebrew(draft.created_at)}
            </span>
          </div>

          <dl className="text-ink-soft mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <Stat label="שעות">
              <span dir="ltr" className="font-mono">
                {draft.purchased_hours}
              </span>
            </Stat>
            <Stat label="מחיר/שעה">
              <span dir="ltr" className="font-mono">
                ₪{draft.hourly_rate.toLocaleString("he-IL")}
              </span>
            </Stat>
            <Stat label="סה״כ">
              <span dir="ltr" className="font-mono">
                ₪{totalAmount.toLocaleString("he-IL")}
              </span>
            </Stat>
            {draft.expiry_date && (
              <Stat label="תפוגה">
                <span className="inline-flex items-center gap-1">
                  <Calendar size={11} />
                  {new Date(draft.expiry_date).toLocaleDateString("he-IL")}
                </span>
              </Stat>
            )}
          </dl>

          {draft.parent_bank_id && (
            <div className="text-ink-soft mt-2 text-xs">
              <Link
                href={`/hour-banks/${draft.parent_bank_id}`}
                className="text-navy hover:text-navy-deep inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
              >
                אבא
                {draft.parent_purchased_hours != null && (
                  <span className="text-ink-faded">({draft.parent_purchased_hours} שעות)</span>
                )}
              </Link>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="border-ink-line text-navy hover:border-navy flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <Edit2 size={13} />
            ערוך לפני אישור
          </button>
          <label className="sr-only" htmlFor={`doctype-${draft.id}`}>
            סוג מסמך
          </label>
          <select
            id={`doctype-${draft.id}`}
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as InvoiceDocumentType)}
            disabled={pendingApprove}
            className="border-ink-line text-navy focus:border-navy rounded-lg border bg-white px-2 py-1.5 text-xs font-medium outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleApprove}
            disabled={pendingApprove}
            aria-busy={pendingApprove}
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingApprove ? <Spinner size={13} /> : <CheckCircle2 size={13} />}
            אשר ושלח
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={pendingDiscard}
            aria-busy={pendingDiscard}
            className="text-ink-faded flex items-center gap-1.5 text-xs transition-colors hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingDiscard ? <Spinner size={13} /> : <Trash2 size={13} />}
            מחק
          </button>
        </div>
      </div>
    </article>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-ink-faded">{label}:</span>
      <span className="text-navy font-medium">{children}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-ink-line bg-cream-paper flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <div className="bg-cream-deep mb-4 flex h-20 w-20 items-center justify-center rounded-full">
        <FileClock size={42} className="text-navy/60" />
      </div>
      <h2 className="text-display-sm text-navy mb-2">אין טיוטות חידוש ממתינות</h2>
      <p className="text-ink-soft max-w-md text-sm">
        כשבנק שעות יתקרב לסיום וייווצר חידוש אוטומטי — הוא יופיע כאן לאישור
      </p>
    </div>
  );
}
