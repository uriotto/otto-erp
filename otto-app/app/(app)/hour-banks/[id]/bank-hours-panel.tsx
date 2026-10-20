"use client";

import { Clock, Copy, Download } from "lucide-react";
import { formatDateIL } from "@/lib/dates";
import { downloadTextFile, toCsv, toTsv } from "@/lib/table-export";
import { useToast } from "@/components/ui/toast";

export type BankHourEntry = {
  id: string;
  startTime: string;
  minutes: number;
  project: string;
  task: string;
  description: string;
};

const headers = ["תאריך", "פרויקט", "משימה", "תיאור", "שעות"];

// Keep pasted rows intact and prevent spreadsheet formulas in user-entered text.
function spreadsheetText(value: string): string {
  const text = value.replace(/[\t\r\n]+/g, " ");
  return /^\s*[=+@-]/.test(text) ? `'${text}` : text;
}

export function BankHoursPanel({
  entries,
  loadFailed,
  customerName,
  bankId,
  purchaseDate,
}: {
  entries: BankHourEntry[];
  loadFailed: boolean;
  customerName: string;
  bankId: string;
  purchaseDate: string | null;
}) {
  const toast = useToast();
  const totalHours = entries.reduce((total, entry) => total + entry.minutes, 0) / 60;
  const rows = entries.map((entry) => [
    formatDateIL(entry.startTime),
    spreadsheetText(entry.project),
    spreadsheetText(entry.task),
    spreadsheetText(entry.description),
    (entry.minutes / 60).toFixed(2),
  ]);
  const reportHeaders = ["לקוח", "מזהה בנק", "תאריך רכישת בנק", ...headers];
  const reportRows = rows.map((row) => [
    spreadsheetText(customerName),
    bankId,
    formatDateIL(purchaseDate),
    ...row,
  ]);
  reportRows.push(["", "", "", "", "", "", "סה״כ שעות", totalHours.toFixed(2)]);
  const disabled = loadFailed || entries.length === 0;

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(toTsv(reportHeaders, reportRows));
      toast.success("הפירוט הועתק");
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  }

  return (
    <section className="bg-cream-paper border-ink-line mt-4 rounded-2xl border p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-navy flex items-center gap-2 text-sm font-semibold">
          <Clock size={16} />
          פירוט שעות הבנק
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={copyReport}
            className="border-ink-line text-navy flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            <Copy size={14} /> העתק
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              downloadTextFile(toCsv(reportHeaders, reportRows), `bank-hours-${bankId}.csv`);
              toast.success("הקובץ הורד");
            }}
            className="border-ink-line text-navy flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            <Download size={14} /> הורד CSV
          </button>
        </div>
      </div>
      {loadFailed ? (
        <p role="alert" className="text-sm text-red-700">
          לא ניתן לטעון את פירוט השעות. יש לרענן ולנסות שוב.
        </p>
      ) : entries.length === 0 ? (
        <p className="text-ink-soft text-sm">אין שעות שנוכו מבנק זה.</p>
      ) : (
        <div className="border-ink-line overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-cream-deep text-ink-soft">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-3 py-2 text-start font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-ink-line border-t">
                  <td className="px-3 py-2" dir="ltr">
                    {formatDateIL(entry.startTime)}
                  </td>
                  <td className="px-3 py-2">{entry.project || "-"}</td>
                  <td className="px-3 py-2">{entry.task || "-"}</td>
                  <td className="px-3 py-2 whitespace-pre-wrap">
                    {entry.description || "ללא תיאור"}
                  </td>
                  <td className="px-3 py-2 tabular-nums" dir="ltr">
                    {(entry.minutes / 60).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-cream-deep border-ink-line border-t font-semibold">
              <tr>
                <td colSpan={4} className="px-3 py-2">
                  סה״כ שעות שנוכו
                </td>
                <td className="px-3 py-2" dir="ltr">
                  {totalHours.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
