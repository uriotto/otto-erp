"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Sparkles, Plus } from "lucide-react";
import { createReport, generateMonthlyReport } from "../actions";
import { useToast } from "@/components/ui/toast";

type CustomerOption = {
  id: string;
  name: string;
  company: string | null;
};

const MONTH_NAMES = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export function NewReportForm({ customers }: { customers: CustomerOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const now = new Date();
  const [mode, setMode] = useState<"manual" | "auto">("auto");
  const [customerId, setCustomerId] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // Manual form fields
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"monthly" | "yearly" | "custom">("monthly");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [summary, setSummary] = useState("");

  function handleAutoGenerate() {
    if (!customerId) {
      toast.error("יש לבחור לקוח");
      return;
    }
    startTransition(async () => {
      const res = await generateMonthlyReport(customerId, year, month);
      if (res.ok) {
        toast.success("הדוח נוצר בהצלחה");
        router.push(`/reports/${res.id}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleManualCreate() {
    if (!title || !periodStart || !periodEnd) {
      toast.error("יש למלא כותרת ותקופה");
      return;
    }
    startTransition(async () => {
      const res = await createReport({
        customer_id: customerId || null,
        type,
        period_start: periodStart,
        period_end: periodEnd,
        title,
        summary: summary || null,
      });
      if (res.ok) {
        toast.success("הדוח נוצר");
        router.push(`/reports/${res.id}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back link */}
      <Link href="/reports" className="text-ink-soft hover:text-navy flex items-center gap-1 text-sm">
        <ArrowRight size={15} className="rtl:rotate-180" />
        חזרה לדוחות
      </Link>

      <div>
        <h1 className="text-navy text-display-sm font-bold">דוח חדש</h1>
        <p className="text-ink-soft mt-1 text-sm">צור דוח חודשי אוטומטי או הגדר דוח ידנית</p>
      </div>

      {/* Mode toggle */}
      <div className="border-ink-line flex rounded-xl border p-0.5">
        <button
          type="button"
          onClick={() => setMode("auto")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === "auto" ? "bg-navy text-cream-paper shadow-sm" : "text-ink-soft hover:text-navy"
          }`}
        >
          <Sparkles size={14} />
          צור אוטומטית
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === "manual"
              ? "bg-navy text-cream-paper shadow-sm"
              : "text-ink-soft hover:text-navy"
          }`}
        >
          <Plus size={14} />
          הגדרה ידנית
        </button>
      </div>

      <div className="shadow-card bg-cream-paper space-y-4 rounded-xl p-5">
        {/* Customer select (shared) */}
        <div>
          <label className="text-navy mb-1 block text-sm font-medium">לקוח</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="border-ink-line text-navy w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">בחר לקוח{mode === "manual" ? " (אופציונלי)" : ""}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company ? `${c.name} — ${c.company}` : c.name}
              </option>
            ))}
          </select>
        </div>

        {mode === "auto" ? (
          <>
            {/* Month/Year selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-navy mb-1 block text-sm font-medium">חודש</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="border-ink-line text-navy w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-navy mb-1 block text-sm font-medium">שנה</label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="border-ink-line text-navy w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-ink-soft text-xs">
              הדוח יאסוף אוטומטית את כל שעות העבודה והחשבוניות של הלקוח לתקופה זו.
            </p>

            <button
              type="button"
              onClick={handleAutoGenerate}
              disabled={pending}
              className="bg-navy text-cream-paper hover:bg-navy-deep w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {pending ? "יוצר דוח..." : "צור דוח חודשי"}
            </button>
          </>
        ) : (
          <>
            {/* Manual form */}
            <div>
              <label className="text-navy mb-1 block text-sm font-medium">כותרת הדוח</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="למשל: דוח חודשי — ינואר 2026"
                className="border-ink-line w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="text-navy mb-1 block text-sm font-medium">סוג דוח</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "monthly" | "yearly" | "custom")}
                className="border-ink-line text-navy w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              >
                <option value="monthly">חודשי</option>
                <option value="yearly">שנתי</option>
                <option value="custom">מותאם</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-navy mb-1 block text-sm font-medium">מתאריך</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="border-ink-line w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="text-navy mb-1 block text-sm font-medium">עד תאריך</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="border-ink-line w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-navy mb-1 block text-sm font-medium">
                סיכום <span className="text-ink-faded font-normal">(אופציונלי)</span>
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                placeholder="הוסף סיכום לדוח..."
                className="border-ink-line w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleManualCreate}
              disabled={pending}
              className="bg-navy text-cream-paper hover:bg-navy-deep w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {pending ? "יוצר..." : "צור דוח"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
