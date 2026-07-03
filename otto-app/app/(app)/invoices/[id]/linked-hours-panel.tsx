"use client";

import { Clock, Download, Copy } from "lucide-react";
import type { HoursDetailLine } from "@/lib/hours-detail";
import { toCsv, toTsv, downloadTextFile } from "@/lib/table-export";
import { useToast } from "@/components/ui/toast";

const HEADERS = ["תאריך", "תיאור", "שעות"];

export function LinkedHoursPanel({
  lines,
  totalHours,
  invoiceNumber,
  invoicedHours = null,
}: {
  lines: HoursDetailLine[];
  totalHours: number;
  invoiceNumber: string | null;
  invoicedHours?: number | null;
}) {
  const toast = useToast();

  if (lines.length === 0) return null;

  const hasDrift = invoicedHours != null && Math.abs(invoicedHours - totalHours) > 0.01;

  const rows = lines.map((l) => [l.date, l.description, l.hours.toFixed(2)]);

  function handleDownload() {
    const name = invoiceNumber ? `hours-${invoiceNumber}` : "hours";
    downloadTextFile(toCsv(HEADERS, rows), `${name}.csv`);
    toast.success("הקובץ הורד");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(toTsv(HEADERS, rows));
      toast.success("הפירוט הועתק");
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  }

  return (
    <div className="bg-cream-paper border-ink-line mb-4 rounded-2xl border p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-navy flex items-center gap-2 text-sm font-semibold">
          <Clock size={16} />
          שעות מקושרות
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="border-ink-line text-navy hover:border-navy flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <Copy size={14} />
            העתק
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="border-ink-line text-navy hover:border-navy flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <Download size={14} />
            הורד CSV
          </button>
        </div>
      </div>

      {hasDrift && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          שים לב: רשומות השעות המקושרות עודכנו אחרי הפקת החשבונית (
          <span dir="ltr" className="font-mono">
            {totalHours.toFixed(2)}
          </span>{" "}
          שעות כעת לעומת{" "}
          <span dir="ltr" className="font-mono">
            {invoicedHours?.toFixed(2)}
          </span>{" "}
          בחשבונית). החשבונית עצמה לא השתנתה.
        </div>
      )}

      <div className="border-ink-line overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-cream-deep text-ink-soft text-xs">
            <tr>
              <th className="px-4 py-2 text-start font-medium">תאריך</th>
              <th className="px-4 py-2 text-start font-medium">תיאור</th>
              <th className="px-4 py-2 text-end font-medium">שעות</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-ink-line border-t">
                <td className="text-ink-soft px-4 py-2.5 font-mono" dir="ltr">
                  {l.date}
                </td>
                <td className="text-navy px-4 py-2.5">{l.description}</td>
                <td className="text-navy px-4 py-2.5 text-end font-mono" dir="ltr">
                  {l.hours.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-ink-soft text-sm">
            <tr className="bg-cream-deep border-ink-line border-t">
              <td colSpan={2} className="text-navy px-4 py-2.5 text-end font-semibold">
                סה״כ שעות
              </td>
              <td className="text-navy px-4 py-2.5 text-end font-mono font-semibold" dir="ltr">
                {totalHours.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
