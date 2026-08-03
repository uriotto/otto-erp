"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, FileText, Mail, MailX, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { InvoiceDraftPreview } from "@/lib/hourly-invoice-draft";

function formatILS(amount: number): string {
  return `₪${amount.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InvoiceDraftDialog({
  preview,
  docTypeLabel,
  loading,
  issuing,
  error,
  options,
  showHoursDetail = true,
  onClose,
  onConfirm,
}: {
  preview: InvoiceDraftPreview | null;
  docTypeLabel: string;
  loading: boolean;
  issuing: boolean;
  error: string | null;
  /** Optional controls (document type, attach-detail...) rendered above the draft. */
  options?: ReactNode;
  showHoursDetail?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !issuing) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [issuing, onClose]);

  useEffect(() => {
    if (preview) confirmRef.current?.focus();
  }, [preview]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="טיוטת חשבונית"
      onClick={(e) => {
        if (e.target === e.currentTarget && !issuing) onClose();
      }}
    >
      <div className="bg-cream-paper flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:rounded-2xl">
        <header className="border-ink-line flex items-start justify-between gap-4 border-b px-6 py-4">
          <div>
            <p className="text-micro text-ink-faded mb-1 uppercase">טיוטה — טרם הופקה</p>
            <h2 className="text-navy flex items-center gap-2 text-lg font-semibold">
              <FileText size={18} />
              {docTypeLabel}
              {preview && (
                <span className="text-ink-soft font-normal">· {preview.customerName}</span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={issuing}
            aria-label="סגור"
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {options && (
            <div className="border-ink-line bg-cream/40 mb-5 space-y-3 rounded-xl border p-4">
              {options}
            </div>
          )}

          {loading && (
            <div className="text-ink-soft flex items-center justify-center gap-2 py-12 text-sm">
              <Spinner size={16} />
              מכין טיוטה...
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && preview && (
            <>
              {preview.warning && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{preview.warning}</span>
                </div>
              )}

              <table className="w-full text-sm">
                <thead className="text-ink-faded text-xs">
                  <tr className="border-ink-line border-b">
                    <th className="pb-2 text-start font-medium">תיאור</th>
                    <th className="pb-2 text-end font-medium">כמות</th>
                    <th className="pb-2 text-end font-medium">מחיר יחידה</th>
                    <th className="pb-2 text-end font-medium">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((item) => (
                    <tr key={item.order_index} className="border-ink-line/60 border-b">
                      <td className="text-navy py-2.5 pe-2">{item.description}</td>
                      <td className="text-ink-soft py-2.5 text-end font-mono" dir="ltr">
                        {item.quantity.toFixed(2)}
                      </td>
                      <td className="text-ink-soft py-2.5 text-end font-mono" dir="ltr">
                        {formatILS(item.unit_price)}
                      </td>
                      <td className="text-navy py-2.5 text-end font-mono font-medium" dir="ltr">
                        {formatILS(item.quantity * item.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <dl className="border-ink-line ms-auto mt-4 max-w-xs space-y-1.5 border-t pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-soft">סכום לפני מע״מ</dt>
                  <dd className="text-navy font-mono" dir="ltr">
                    {formatILS(preview.subtotal)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-soft">מע״מ {preview.taxRate}%</dt>
                  <dd className="text-navy font-mono" dir="ltr">
                    {formatILS(preview.taxAmount)}
                  </dd>
                </div>
                <div className="border-ink-line flex items-center justify-between border-t pt-1.5">
                  <dt className="text-navy font-semibold">סה״כ לתשלום</dt>
                  <dd className="text-navy font-mono text-base font-semibold" dir="ltr">
                    {formatILS(preview.total)}
                  </dd>
                </div>
              </dl>

              {showHoursDetail && preview.hoursLines.length > 0 && (
                <details className="border-ink-line mt-5 rounded-xl border p-4" open>
                  <summary className="text-navy cursor-pointer text-sm font-medium">
                    פירוט שעות ({preview.entryCount} רשומות · {preview.totalHours.toFixed(2)} שעות)
                    <span className="text-ink-faded"> — נשלח כחלק מהמסמך</span>
                  </summary>
                  <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-xs">
                    {preview.hoursLines.map((line, i) => (
                      <li
                        key={`${line.date}-${i}`}
                        className="border-ink-line/50 flex items-baseline gap-2 border-b pb-1 last:border-0"
                      >
                        <span className="text-ink-faded shrink-0 font-mono" dir="ltr">
                          {line.date}
                        </span>
                        <span className="text-ink-soft flex-1">{line.description}</span>
                        <span className="text-navy shrink-0 font-mono" dir="ltr">
                          {line.hours.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <p
                className={`mt-4 flex items-center gap-2 rounded-xl border p-3 text-xs ${
                  preview.customerEmail
                    ? "border-ink-line text-ink-soft"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {preview.customerEmail ? <Mail size={14} /> : <MailX size={14} />}
                {preview.customerEmail
                  ? `בהפקה, פינבוט ישלח את המסמך במייל ל-${preview.customerEmail}`
                  : "ללקוח אין מייל - המסמך יופק בפינבוט אך לא יישלח אוטומטית"}
              </p>
            </>
          )}
        </div>

        <footer className="border-ink-line bg-cream/50 flex items-center justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={issuing}
            className="text-ink-soft hover:text-navy px-3 py-2 text-sm transition-colors disabled:opacity-40"
          >
            ביטול
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading || issuing || !preview}
            className="bg-navy text-cream hover:bg-navy/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {issuing && <Spinner size={14} />}
            אישור והפקה בפינבוט
          </button>
        </footer>
      </div>
    </div>
  );
}
