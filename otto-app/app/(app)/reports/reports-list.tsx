"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart2,
  Plus,
  CheckCircle2,
  Clock,
  FileText,
  Trash2,
  Eye,
  EyeOff,
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import { ViewToggle, useStoredView, type ViewOption } from "@/components/ui/view-toggle";
import { BulkActionBar, type BulkAction } from "@/components/ui/bulk-action-bar";
import { useToast } from "@/components/ui/toast";
import { approveReport, deleteReport } from "./actions";
import type { ReportListItem } from "./page";
import { saveFilters, loadFilters } from "@/lib/persist-filters";

type CustomerOption = {
  id: string;
  name: string;
  company: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  pending_review: "ממתין לאישור",
  approved: "מאושר",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-gray-200 bg-gray-50 text-gray-600",
  pending_review: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const TYPE_LABELS: Record<string, string> = {
  monthly: "חודשי",
  yearly: "שנתי",
  custom: "מותאם",
};

type ViewType = "cards" | "table";

const VIEW_OPTIONS: ViewOption<ViewType>[] = [
  { id: "cards", icon: LayoutGrid, label: "כרטיסים" },
  { id: "table", icon: LayoutList, label: "טבלה" },
];

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

export function ReportsList({
  reports,
  customers,
  activeStatus,
  activeType,
}: {
  reports: ReportListItem[];
  customers: CustomerOption[];
  activeStatus: string;
  activeType: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useStoredView<ViewType>("reports-view", "cards");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  // Restore filters from localStorage on fresh load
  useEffect(() => {
    if (!searchParams.toString()) {
      const saved = loadFilters("reports");
      if (saved?.status || saved?.type) {
        const params = new URLSearchParams();
        if (saved.status) params.set("status", saved.status);
        if (saved.type) params.set("type", saved.type);
        router.push(`/reports?${params.toString()}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/reports?${params.toString()}`);
    saveFilters("reports", {
      status: key === "status" ? value : (searchParams.get("status") ?? ""),
      type: key === "type" ? value : (searchParams.get("type") ?? ""),
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === reports.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reports.map((r) => r.id)));
    }
  }

  function handleBulkDelete() {
    startTransition(async () => {
      let failed = 0;
      for (const id of selected) {
        const res = await deleteReport(id);
        if (!res.ok) failed++;
      }
      if (failed > 0) toast.error(`נכשלה מחיקת ${failed} דוחות`);
      else toast.success("הדוחות נמחקו");
      setSelected(new Set());
    });
  }

  function handleApprove(id: string) {
    startTransition(async () => {
      const res = await approveReport(id);
      if (res.ok) toast.success("הדוח אושר ונשלח ללקוח");
      else toast.error(res.error);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteReport(id);
      if (res.ok) toast.success("הדוח נמחק");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="text-navy" size={22} />
          <h1 className="text-navy text-display-sm font-bold">דוחות</h1>
          <span className="text-ink-faded text-sm">({reports.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle
            storageKey="reports-view"
            views={VIEW_OPTIONS}
            defaultView="cards"
            current={view}
            onChange={setView}
          />
          <Link
            href="/reports/new"
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            <span>דוח חדש</span>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={activeStatus}
          onChange={(e) => setFilter("status", e.target.value)}
          className="border-ink-line text-navy rounded-lg border px-3 py-1.5 text-sm"
        >
          <option value="">כל הסטטוסים</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={activeType}
          onChange={(e) => setFilter("type", e.target.value)}
          className="border-ink-line text-navy rounded-lg border px-3 py-1.5 text-sm"
        >
          <option value="">כל הסוגים</option>
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Empty state */}
      {reports.length === 0 && (
        <div className="border-ink-line rounded-xl border-2 border-dashed py-16 text-center">
          <BarChart2 className="text-ink-faded mx-auto mb-3" size={36} />
          <p className="text-navy font-semibold">אין דוחות עדיין</p>
          <p className="text-ink-soft mt-1 text-sm">צור דוח ידני או צור דוח חודשי אוטומטי</p>
          <Link
            href="/reports/new"
            className="bg-navy text-cream-paper hover:bg-navy-deep mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            דוח חדש
          </Link>
        </div>
      )}

      {/* Cards view */}
      {reports.length > 0 && view === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`shadow-card bg-cream-paper group relative rounded-xl p-4 transition-shadow hover:shadow-md ${
                selected.has(report.id) ? "ring-navy ring-2" : ""
              }`}
            >
              {/* Select checkbox */}
              <input
                type="checkbox"
                checked={selected.has(report.id)}
                onChange={() => toggleSelect(report.id)}
                className="absolute start-3 top-3 h-4 w-4 cursor-pointer rounded"
              />

              <div className="ms-6">
                {/* Status badge */}
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[report.status] ?? STATUS_STYLES.draft}`}
                  >
                    {report.status === "approved" && <CheckCircle2 size={10} />}
                    {report.status === "pending_review" && <Clock size={10} />}
                    {STATUS_LABELS[report.status] ?? report.status}
                  </span>
                  <span className="text-ink-faded text-[11px]">
                    {TYPE_LABELS[report.type] ?? report.type}
                  </span>
                </div>

                {/* Title */}
                <Link href={`/reports/${report.id}`} className="text-navy hover:underline">
                  <p className="line-clamp-2 text-sm font-semibold">{report.title}</p>
                </Link>

                {/* Customer */}
                {report.customers && (
                  <p className="text-ink-soft mt-0.5 text-xs">
                    {report.customers.company || report.customers.name}
                  </p>
                )}

                {/* Period */}
                <p className="text-ink-faded mt-1 text-xs" dir="ltr">
                  {formatPeriod(report.period_start, report.period_end)}
                </p>

                {/* Visibility */}
                <div className="mt-2 flex items-center gap-1">
                  {report.visible_to_client ? (
                    <Eye size={12} className="text-emerald-600" />
                  ) : (
                    <EyeOff size={12} className="text-ink-faded" />
                  )}
                  <span className="text-ink-faded text-[11px]">
                    {report.visible_to_client ? "גלוי ללקוח" : "לא גלוי ללקוח"}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href={`/reports/${report.id}`}
                    className="border-ink-line text-navy hover:bg-cream-shadow rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
                  >
                    <FileText size={12} className="me-1 inline" />
                    צפייה
                  </Link>
                  {report.status === "pending_review" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleApprove(report.id)}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <CheckCircle2 size={12} className="me-1 inline" />
                      אשר
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDelete(report.id)}
                    className="text-ink-faded rounded-lg p-1 transition-colors hover:text-rose-600 disabled:opacity-50"
                    title="מחק דוח"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table view */}
      {reports.length > 0 && view === "table" && (
        <div className="shadow-card bg-cream-paper overflow-hidden rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-ink-line border-b">
                <th className="px-4 py-3 text-start">
                  <input
                    type="checkbox"
                    checked={selected.size === reports.length && reports.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer rounded"
                  />
                </th>
                <th className="text-ink-soft px-4 py-3 text-start text-xs font-semibold tracking-wide uppercase">
                  כותרת
                </th>
                <th className="text-ink-soft px-4 py-3 text-start text-xs font-semibold tracking-wide uppercase">
                  לקוח
                </th>
                <th className="text-ink-soft px-4 py-3 text-start text-xs font-semibold tracking-wide uppercase">
                  תקופה
                </th>
                <th className="text-ink-soft px-4 py-3 text-start text-xs font-semibold tracking-wide uppercase">
                  סטטוס
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-ink-line divide-y">
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className={`hover:bg-cream-deep/40 transition-colors ${selected.has(report.id) ? "bg-navy/5" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(report.id)}
                      onChange={() => toggleSelect(report.id)}
                      className="h-4 w-4 cursor-pointer rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/reports/${report.id}`}
                      className="text-navy font-medium hover:underline"
                    >
                      {report.title}
                    </Link>
                    <span className="text-ink-faded ms-2 text-xs">
                      {TYPE_LABELS[report.type] ?? report.type}
                    </span>
                  </td>
                  <td className="text-ink-soft px-4 py-3 text-sm">
                    {report.customers ? report.customers.company || report.customers.name : "—"}
                  </td>
                  <td className="text-ink-soft px-4 py-3 text-xs" dir="ltr">
                    {formatPeriod(report.period_start, report.period_end)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[report.status] ?? STATUS_STYLES.draft}`}
                    >
                      {STATUS_LABELS[report.status] ?? report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {report.status === "pending_review" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleApprove(report.id)}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                        >
                          אשר
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleDelete(report.id)}
                        className="text-ink-faded p-1 transition-colors hover:text-rose-600 disabled:opacity-50"
                        title="מחק"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <BulkActionBar
          selectedCount={selected.size}
          onClear={() => setSelected(new Set())}
          actions={[
            {
              label: "מחק",
              icon: Trash2,
              variant: "danger",
              onClick: handleBulkDelete,
              isPending: pending,
            } satisfies BulkAction,
          ]}
        />
      )}
    </div>
  );
}
