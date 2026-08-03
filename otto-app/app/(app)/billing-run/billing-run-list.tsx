"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Mail,
  Receipt,
  Wallet,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { createHourlyInvoice, previewHourlyInvoice, settleHoursExternally } from "../time/actions";
import { issueRetainerInvoice, previewRetainerInvoice } from "./actions";
import { InvoiceDraftDialog } from "@/components/domain/invoice-draft-dialog";
import type { InvoiceDraftPreview } from "@/lib/hourly-invoice-draft";

export type BillingRunRow = {
  customerId: string;
  customerName: string;
  company: string | null;
  hasEmail: boolean;
  hours: number;
  overageHours: number;
  olderHours: number;
  estimatedAmount: number;
  missingRate: boolean;
};

export type RetainerRow = {
  customerId: string;
  customerName: string;
  company: string | null;
  hasEmail: boolean;
  amount: number;
};

type DocType = "payment_request" | "tax_invoice";

const DOC_OPTIONS: { value: DocType; label: string }[] = [
  { value: "payment_request", label: "דרישת תשלום" },
  { value: "tax_invoice", label: "חשבונית מס" },
];

function formatILS(amount: number): string {
  return `₪${amount.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y = 0, m = 1] = monthKey.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function BillingRunList({
  rows,
  retainers,
  monthLabel,
  monthKey,
  untilISO,
}: {
  rows: BillingRunRow[];
  retainers: RetainerRow[];
  monthLabel: string;
  monthKey: string;
  untilISO: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>("payment_request");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<Map<string, string>>(new Map());
  const [settled, setSettled] = useState<Set<string>>(new Set());

  // The draft dialog: opened per customer, holds the read-only preview until approved.
  const [draftTarget, setDraftTarget] = useState<{
    kind: "hourly" | "retainer";
    customerId: string;
    customerName: string;
  } | null>(null);
  const [preview, setPreview] = useState<InvoiceDraftPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const totalAmount = rows.reduce((s, r) => s + r.estimatedAmount, 0);
  const docTypeLabel = DOC_OPTIONS.find((d) => d.value === docType)?.label ?? "";

  function closeDraft() {
    setDraftTarget(null);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }

  function openHourlyDraft(row: BillingRunRow) {
    setDraftTarget({ kind: "hourly", customerId: row.customerId, customerName: row.customerName });
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    startTransition(async () => {
      const res = await previewHourlyInvoice(row.customerId, untilISO);
      setPreviewLoading(false);
      if (res.error || !res.preview) {
        setPreviewError(res.error ?? "שגיאה בהכנת הטיוטה");
        return;
      }
      setPreview(res.preview);
    });
  }

  function openRetainerDraft(row: RetainerRow) {
    setDraftTarget({
      kind: "retainer",
      customerId: row.customerId,
      customerName: row.customerName,
    });
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    startTransition(async () => {
      const res = await previewRetainerInvoice({
        customer_id: row.customerId,
        month_label: monthLabel,
      });
      setPreviewLoading(false);
      if (res.error || !res.preview) {
        setPreviewError(res.error ?? "שגיאה בהכנת הטיוטה");
        return;
      }
      setPreview(res.preview);
    });
  }

  function confirmDraft() {
    const target = draftTarget;
    if (!target) return;
    setIssuing(true);
    setPendingId(target.customerId);
    startTransition(async () => {
      const res =
        target.kind === "hourly"
          ? await createHourlyInvoice(target.customerId, {
              documentType: docType,
              attachHoursDetail: true,
              until: untilISO,
            })
          : await issueRetainerInvoice({
              customer_id: target.customerId,
              month_label: monthLabel,
              document_type: docType,
            });

      setIssuing(false);
      setPendingId(null);

      if (res.error) {
        setPreviewError(res.error);
        toast.error(res.error);
        return;
      }
      if (res.finbotError) {
        toast.error(`החשבונית נשמרה אך ההפקה בפינבוט נכשלה: ${res.finbotError}`);
      } else {
        toast.success(`הופקה חשבונית ל${target.customerName}`);
      }
      if (res.invoiceId) setDone((prev) => new Map(prev).set(target.customerId, res.invoiceId!));
      closeDraft();
      router.refresh();
    });
  }

  function markSettled(row: BillingRunRow) {
    const ok = confirm(
      `לסמן ${row.hours} שעות של ${row.customerName} כשולמו מחוץ למערכת?\n` +
        `לא תופק חשבונית ולא יישלח כלום ללקוח - השעות רק יוצאות מרשימת החיוב.\n` +
        `ניתן לבטל מאוחר יותר במסך השעות (אפס לממתין).`,
    );
    if (!ok) return;
    setPendingId(row.customerId);
    startTransition(async () => {
      const res = await settleHoursExternally({ customer_id: row.customerId, until: untilISO });
      setPendingId(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.hours} שעות של ${row.customerName} סומנו כשולמו מחוץ למערכת`);
      setSettled((prev) => new Set(prev).add(row.customerId));
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-micro text-ink-faded mb-2 uppercase">חיוב חודשי</p>
          <h1 className="text-display-md text-navy flex items-center gap-2">
            <CalendarClock size={26} />
            {monthLabel}
          </h1>
          <p className="text-ink-soft mt-1 text-sm">
            כל השעות שטרם חויבו עד סוף {monthLabel}. כל הפקה מציגה קודם טיוטה לאישור - כלום לא יוצא
            לפינבוט בלי הלחיצה שלך.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/billing-run?month=${shiftMonth(monthKey, -1)}`}
            className="border-ink-line text-navy hover:border-navy rounded-lg border p-2 transition-colors"
            aria-label="חודש קודם"
          >
            <ChevronRight size={16} />
          </Link>
          <Link
            href={`/billing-run?month=${shiftMonth(monthKey, 1)}`}
            className="border-ink-line text-navy hover:border-navy rounded-lg border p-2 transition-colors"
            aria-label="חודש הבא"
          >
            <ChevronLeft size={16} />
          </Link>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocType)}
            className="border-ink-line text-navy focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
          >
            {DOC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-cream-paper border-ink-line mb-4 rounded-2xl border p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-navy flex items-center gap-2 text-sm font-semibold">
            <Receipt size={16} />
            שעות לא מחויבות
          </h2>
          <span className="text-ink-soft text-sm">
            סה״כ משוער:{" "}
            <span className="text-navy font-mono font-semibold" dir="ltr">
              {formatILS(totalAmount)}
            </span>{" "}
            <span className="text-ink-faded text-xs">לפני מע״מ</span>
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="text-ink-soft py-6 text-center text-sm">
            אין שעות לא מחויבות עד סוף {monthLabel} 🎉
          </p>
        ) : (
          <div className="border-ink-line overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-cream-deep text-ink-soft text-xs">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">לקוח</th>
                  <th className="px-4 py-2 text-end font-medium">שעות</th>
                  <th className="px-4 py-2 text-end font-medium">מזה חריגה</th>
                  <th className="px-4 py-2 text-end font-medium">מחודשים קודמים</th>
                  <th className="px-4 py-2 text-end font-medium">סכום משוער</th>
                  <th className="px-4 py-2 text-end font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const invoiceId = done.get(row.customerId);
                  return (
                    <tr key={row.customerId} className="border-ink-line border-t">
                      <td className="px-4 py-3">
                        <Link
                          href={`/customers/${row.customerId}`}
                          className="text-navy hover:underline"
                        >
                          {row.customerName}
                        </Link>
                        {row.company && (
                          <span className="text-ink-faded text-xs"> · {row.company}</span>
                        )}
                        {!row.hasEmail && (
                          <span
                            className="text-ink-faded ms-1 inline-flex align-middle"
                            title="ללקוח אין מייל - המסמך לא יישלח אוטומטית"
                          >
                            <Mail size={12} />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end font-mono" dir="ltr">
                        {row.hours.toFixed(2)}
                      </td>
                      <td className="text-ink-soft px-4 py-3 text-end font-mono" dir="ltr">
                        {row.overageHours > 0 ? row.overageHours.toFixed(2) : "—"}
                      </td>
                      <td className="text-ink-soft px-4 py-3 text-end font-mono" dir="ltr">
                        {row.olderHours > 0.01 ? row.olderHours.toFixed(2) : "—"}
                      </td>
                      <td
                        className="text-navy px-4 py-3 text-end font-mono font-semibold"
                        dir="ltr"
                      >
                        {formatILS(row.estimatedAmount)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/time?customer=${row.customerId}`}
                            className="text-ink-soft hover:text-navy text-xs underline-offset-2 hover:underline"
                          >
                            לרשומות
                          </Link>
                          {invoiceId ? (
                            <Link
                              href={`/invoices/${invoiceId}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                            >
                              <ExternalLink size={12} />
                              הופק
                            </Link>
                          ) : settled.has(row.customerId) ? (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                              <Check size={12} />
                              שולם מחוץ למערכת
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => markSettled(row)}
                                title="סגירת השעות בלי חשבונית - שולם מחוץ למערכת"
                                className="border-ink-line text-ink-soft hover:border-navy hover:text-navy inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Wallet size={12} />
                                שולם מחוץ למערכת
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => openHourlyDraft(row)}
                                className="bg-navy text-cream hover:bg-navy/90 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {pendingId === row.customerId ? (
                                  <Spinner size={12} />
                                ) : (
                                  <Receipt size={12} />
                                )}
                                טיוטה והפקה
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {retainers.length > 0 && (
        <div className="bg-cream-paper border-ink-line mb-4 rounded-2xl border p-6">
          <h2 className="text-navy mb-4 text-sm font-semibold">ריטיינרים חודשיים</h2>
          <ul className="space-y-2">
            {retainers.map((row) => {
              const invoiceId = done.get(row.customerId);
              return (
                <li
                  key={row.customerId}
                  className="border-ink-line bg-cream/40 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <div>
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="text-navy text-sm font-medium hover:underline"
                    >
                      {row.customerName}
                    </Link>
                    {row.company && (
                      <span className="text-ink-faded text-xs"> · {row.company}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-navy font-mono text-sm font-semibold" dir="ltr">
                      {formatILS(row.amount)}
                    </span>
                    {invoiceId ? (
                      <Link
                        href={`/invoices/${invoiceId}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                      >
                        <ExternalLink size={12} />
                        הופק
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => openRetainerDraft(row)}
                        className="bg-navy text-cream hover:bg-navy/90 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {pendingId === row.customerId ? (
                          <Spinner size={12} />
                        ) : (
                          <Receipt size={12} />
                        )}
                        טיוטה והפקה
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {draftTarget && (
        <InvoiceDraftDialog
          preview={preview}
          docTypeLabel={docTypeLabel}
          loading={previewLoading}
          issuing={issuing}
          error={previewError}
          onClose={closeDraft}
          onConfirm={confirmDraft}
        />
      )}
    </div>
  );
}
