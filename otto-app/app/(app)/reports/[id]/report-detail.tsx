"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Timer,
  Receipt,
  Edit3,
  Save,
} from "lucide-react";
import { approveReport, saveDraftReport } from "../actions";
import type { ReportData } from "../actions";
import { useToast } from "@/components/ui/toast";

type ReportRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  period_start: string;
  period_end: string;
  summary: string | null;
  visible_to_client: boolean;
  created_at: string;
  approved_at: string | null;
  customer_id: string | null;
  customers: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
  } | null;
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

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString("he-IL", { day: "2-digit", month: "long", year: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

function formatHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${String(mins).padStart(2, "0")} שעות`;
}

function formatILS(amount: number): string {
  return `₪${amount.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ReportDetail({
  report,
  reportData,
}: {
  report: ReportRow;
  reportData: ReportData;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editingSummary, setEditingSummary] = useState(false);
  const [summary, setSummary] = useState(report.summary ?? "");

  function handleApprove() {
    startTransition(async () => {
      const res = await approveReport(report.id);
      if (res.ok) {
        toast.success("הדוח אושר ונשלח ללקוח");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleSaveDraft() {
    startTransition(async () => {
      const res = await saveDraftReport(report.id, summary);
      if (res.ok) {
        toast.success("הדוח נשמר כטיוטה");
        setEditingSummary(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const timeEntries = reportData.timeEntries ?? [];
  const invoices = reportData.invoices ?? [];
  const totalHours = reportData.totalHours ?? timeEntries.reduce((s, e) => s + e.hours, 0);
  const totalBilled = reportData.totalBilled ?? invoices.reduce((s, i) => s + i.total_amount, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back */}
      <Link
        href="/reports"
        className="text-ink-soft hover:text-navy flex items-center gap-1 text-sm"
      >
        <ArrowRight size={15} className="rtl:rotate-180" />
        חזרה לדוחות
      </Link>

      {/* Header card */}
      <div className="shadow-card bg-cream-paper rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[report.status] ?? STATUS_STYLES.draft}`}
              >
                {report.status === "approved" && <CheckCircle2 size={11} />}
                {report.status === "pending_review" && <Clock size={11} />}
                {STATUS_LABELS[report.status] ?? report.status}
              </span>
              <span className="text-ink-faded text-xs">
                {report.visible_to_client ? (
                  <span className="flex items-center gap-0.5 text-emerald-600">
                    <Eye size={11} /> גלוי ללקוח
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5">
                    <EyeOff size={11} /> לא גלוי ללקוח
                  </span>
                )}
              </span>
            </div>
            <h1 className="text-navy text-display-sm font-bold">{report.title}</h1>
            {report.customers && (
              <Link
                href={`/customers/${report.customers.id}`}
                className="text-ink-soft hover:text-navy mt-0.5 block text-sm"
              >
                {report.customers.company || report.customers.name}
              </Link>
            )}
            <p className="text-ink-faded mt-1 text-xs" dir="ltr">
              {formatPeriod(report.period_start, report.period_end)}
            </p>
          </div>

          {/* Actions for pending_review */}
          {report.status === "pending_review" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={handleSaveDraft}
                className="border-ink-line text-ink-soft hover:text-navy rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                שמור כטיוטה
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleApprove}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                אשר ושלח ללקוח
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI summary */}
      {(timeEntries.length > 0 || invoices.length > 0) && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="shadow-card bg-cream-paper rounded-xl p-4 text-center">
            <Timer size={18} className="text-ink-faded mx-auto mb-1" />
            <p className="text-navy text-xl font-bold" dir="ltr">
              {formatHours(totalHours)}
            </p>
            <p className="text-ink-faded text-xs">שעות מחויבות</p>
          </div>
          <div className="shadow-card bg-cream-paper rounded-xl p-4 text-center">
            <Receipt size={18} className="text-ink-faded mx-auto mb-1" />
            <p className="text-navy text-xl font-bold" dir="ltr">
              {formatILS(totalBilled)}
            </p>
            <p className="text-ink-faded text-xs">סה"כ חויב</p>
          </div>
          <div className="shadow-card bg-cream-paper rounded-xl p-4 text-center">
            <FileText size={18} className="text-ink-faded mx-auto mb-1" />
            <p className="text-navy text-xl font-bold">{invoices.length}</p>
            <p className="text-ink-faded text-xs">חשבוניות</p>
          </div>
        </div>
      )}

      {/* Summary section */}
      <div className="shadow-card bg-cream-paper rounded-xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-navy font-semibold">סיכום</h2>
          {!editingSummary && (
            <button
              type="button"
              onClick={() => setEditingSummary(true)}
              className="text-ink-faded hover:text-navy p-1 transition-colors"
              title="ערוך סיכום"
            >
              <Edit3 size={14} />
            </button>
          )}
        </div>
        {editingSummary ? (
          <div className="space-y-3">
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              placeholder="הוסף סיכום לדוח..."
              className="border-ink-line w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={pending}
                className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Save size={13} />
                שמור
              </button>
              <button
                type="button"
                onClick={() => {
                  setSummary(report.summary ?? "");
                  setEditingSummary(false);
                }}
                className="text-ink-soft rounded-lg px-3 py-1.5 text-sm hover:underline"
              >
                ביטול
              </button>
            </div>
          </div>
        ) : (
          <p className="text-ink-soft text-sm whitespace-pre-wrap">
            {summary || (
              <span className="text-ink-faded italic">אין סיכום עדיין. לחץ על עריכה להוספה.</span>
            )}
          </p>
        )}
      </div>

      {/* Time entries */}
      {timeEntries.length > 0 && (
        <div className="shadow-card bg-cream-paper rounded-xl p-5">
          <h2 className="text-navy mb-3 font-semibold">פירוט שעות ({timeEntries.length})</h2>
          <div className="space-y-2">
            {timeEntries.map((entry) => (
              <div
                key={entry.id}
                className="border-ink-line flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-ink text-sm font-medium">
                    {entry.task_title ?? entry.description ?? "—"}
                  </p>
                  {entry.project_name && (
                    <p className="text-ink-faded text-xs">{entry.project_name}</p>
                  )}
                </div>
                <div className="text-end">
                  <p className="text-navy text-sm font-semibold" dir="ltr">
                    {formatHours(entry.hours)}
                  </p>
                  <p className="text-ink-faded text-xs" dir="ltr">
                    {new Date(entry.date).toLocaleDateString("he-IL", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t pt-3">
            <span className="text-ink-soft text-sm font-medium">סה"כ</span>
            <span className="text-navy font-bold" dir="ltr">
              {formatHours(totalHours)}
            </span>
          </div>
        </div>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="shadow-card bg-cream-paper rounded-xl p-5">
          <h2 className="text-navy mb-3 font-semibold">חשבוניות ({invoices.length})</h2>
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="border-ink-line flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-ink text-sm font-medium">
                    {inv.number ? `חשבונית ${inv.number}` : "חשבונית"}
                  </p>
                  {inv.issue_date && (
                    <p className="text-ink-faded text-xs" dir="ltr">
                      {new Date(inv.issue_date).toLocaleDateString("he-IL", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <div className="text-end">
                  <p className="text-navy text-sm font-semibold" dir="ltr">
                    {formatILS(inv.total_amount)}
                  </p>
                  <p className="text-ink-faded text-xs">{inv.status}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t pt-3">
            <span className="text-ink-soft text-sm font-medium">סה"כ</span>
            <span className="text-navy font-bold" dir="ltr">
              {formatILS(totalBilled)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
