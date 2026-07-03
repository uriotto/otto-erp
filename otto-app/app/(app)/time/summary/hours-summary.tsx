"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BarChart3, Download } from "lucide-react";
import { toCsv, downloadTextFile } from "@/lib/table-export";
import { useToast } from "@/components/ui/toast";

export type SummaryCell = { monthKey: string; hours: number };

export type SummaryCustomer = {
  customerId: string | null;
  customerName: string;
  cells: SummaryCell[];
  totalHours: number;
};

type Month = { key: string; label: string };

function fmtHours(h: number): string {
  return h === 0 ? "—" : h.toFixed(2);
}

export function HoursSummary({
  customers,
  months,
  fromKey,
  toKey,
  billableOnly,
}: {
  customers: SummaryCustomer[];
  months: Month[];
  fromKey: string;
  toKey: string;
  billableOnly: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Per-month column totals and grand total.
  const { monthTotals, grandTotal } = useMemo(() => {
    const totals = new Map<string, number>();
    let grand = 0;
    for (const c of customers) {
      for (const cell of c.cells) {
        totals.set(cell.monthKey, (totals.get(cell.monthKey) ?? 0) + cell.hours);
        grand += cell.hours;
      }
    }
    return { monthTotals: totals, grandTotal: Math.round(grand * 100) / 100 };
  }, [customers]);

  function updateParam(patch: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.push(`/time/summary?${sp.toString()}`);
  }

  function handleExport() {
    const headers = ["לקוח", ...months.map((m) => m.label), 'סה"כ'];
    const rows = customers.map((c) => [
      c.customerName,
      ...c.cells.map((cell) => (cell.hours === 0 ? "" : cell.hours.toFixed(2))),
      c.totalHours.toFixed(2),
    ]);
    rows.push([
      'סה"כ',
      ...months.map((m) => (monthTotals.get(m.key) ?? 0).toFixed(2)),
      grandTotal.toFixed(2),
    ]);
    downloadTextFile(toCsv(headers, rows), `hours-summary-${fromKey}_${toKey}.csv`);
    toast.success("הקובץ הורד");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <Link
          href="/time"
          className="text-ink-soft hover:text-navy mb-3 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowRight size={14} />
          חזרה לשעות
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-micro text-ink-faded mb-2 uppercase">סיכום שעות</p>
            <h1 className="text-display-md text-navy flex items-center gap-2">
              <BarChart3 size={26} />
              שעות לפי לקוח וחודש
            </h1>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="border-ink-line text-navy hover:border-navy flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            <Download size={16} />
            ייצוא CSV
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-ink-soft flex items-center gap-2 text-sm">
          מחודש
          <input
            type="month"
            value={fromKey}
            max={toKey}
            onChange={(e) => updateParam({ from: e.target.value })}
            className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="text-ink-soft flex items-center gap-2 text-sm">
          עד
          <input
            type="month"
            value={toKey}
            min={fromKey}
            onChange={(e) => updateParam({ to: e.target.value })}
            className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="text-ink-soft flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={billableOnly}
            onChange={(e) => updateParam({ billable: e.target.checked ? "yes" : "" })}
            className="border-ink-line text-navy focus:ring-navy h-4 w-4 rounded border"
          />
          רק שעות לחיוב
        </label>
      </div>

      {customers.length === 0 ? (
        <div className="bg-cream-paper border-ink-line rounded-2xl border p-10 text-center">
          <p className="text-ink-soft text-sm">אין שעות בתקופה שנבחרה</p>
        </div>
      ) : (
        <div className="bg-cream-paper border-ink-line overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-cream-deep text-ink-soft text-xs">
              <tr>
                <th className="bg-cream-deep sticky start-0 z-10 px-4 py-3 text-start font-medium">
                  לקוח
                </th>
                {months.map((m) => (
                  <th key={m.key} className="px-4 py-3 text-end font-medium whitespace-nowrap">
                    {m.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-end font-semibold">סה״כ</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.customerId ?? "none"} className="border-ink-line border-t">
                  <td className="text-navy bg-cream-paper sticky start-0 z-10 px-4 py-3">
                    {c.customerId ? (
                      <Link href={`/customers/${c.customerId}`} className="hover:underline">
                        {c.customerName}
                      </Link>
                    ) : (
                      <span className="text-ink-faded">{c.customerName}</span>
                    )}
                  </td>
                  {c.cells.map((cell) => (
                    <td
                      key={cell.monthKey}
                      className="text-ink-soft px-4 py-3 text-end font-mono"
                      dir="ltr"
                    >
                      {fmtHours(cell.hours)}
                    </td>
                  ))}
                  <td className="text-navy px-4 py-3 text-end font-mono font-semibold" dir="ltr">
                    {c.totalHours.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-navy text-sm">
              <tr className="bg-cream-deep border-ink-line border-t-2">
                <td className="bg-cream-deep sticky start-0 z-10 px-4 py-3 font-semibold">
                  סה״כ לחודש
                </td>
                {months.map((m) => (
                  <td key={m.key} className="px-4 py-3 text-end font-mono font-semibold" dir="ltr">
                    {fmtHours(Math.round((monthTotals.get(m.key) ?? 0) * 100) / 100)}
                  </td>
                ))}
                <td className="px-4 py-3 text-end font-mono font-bold" dir="ltr">
                  {grandTotal.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-ink-faded mt-3 text-xs">
        השעות מקובצות לפי חודש קלנדרי (שעון ישראל). לחיצה על שם לקוח פותחת את הכרטיס שלו.
      </p>
    </div>
  );
}
