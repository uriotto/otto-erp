"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Receipt,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  Clock,
  Trash2,
  Send,
} from "lucide-react";
import { NewInvoiceDialog } from "./new-invoice-dialog";
import { bulkDeleteInvoices, bulkUpdateInvoiceStatus } from "./actions";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { useToast } from "@/components/ui/toast";
import { saveFilters, loadFilters } from "@/lib/persist-filters";

export type InvoiceStatusUI =
  | "draft"
  | "pending_review"
  | "sent"
  | "partial"
  | "paid"
  | "overdue"
  | "cancelled";

export type InvoiceTypeUI =
  | "advance"
  | "monthly_hours"
  | "project"
  | "expense"
  | "overage"
  | "other";

export type AgeBucket = "current" | "1-30" | "31-60" | "61-90" | "90+" | "paid";

export type InvoiceListItem = {
  id: string;
  number: string | null;
  issue_date: string | null;
  due_date: string | null;
  status: InvoiceStatusUI;
  total_amount: number;
  paid_amount: number;
  days_overdue: number;
  age_bucket: AgeBucket;
  customer_id: string | null;
  customer_name: string | null;
  customer_company: string | null;
};

export type CustomerOption = {
  id: string;
  name: string;
  company: string | null;
};

export type ProjectOption = {
  id: string;
  name: string;
  customer_id: string | null;
};

export type HourBankOption = {
  id: string;
  customer_id: string | null;
  purchased_hours: number;
  hourly_rate: number;
};

export const STATUS_LABELS: Record<InvoiceStatusUI, string> = {
  draft: "טיוטה",
  pending_review: "ממתין לאישור",
  sent: "נשלחה",
  partial: "חלקי",
  paid: "שולם",
  overdue: "בפיגור",
  cancelled: "מבוטל",
};

export const STATUS_STYLES: Record<InvoiceStatusUI, string> = {
  draft: "border-gray-200 bg-gray-50 text-gray-700",
  pending_review: "border-amber-200 bg-amber-50 text-amber-700",
  sent: "border-sky-200 bg-sky-50 text-sky-700",
  partial: "border-indigo-200 bg-indigo-50 text-indigo-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  overdue: "border-rose-200 bg-rose-50 text-rose-700",
  cancelled: "border-gray-200 bg-gray-100 text-gray-500",
};

export const TYPE_LABELS: Record<InvoiceTypeUI, string> = {
  advance: "מקדמה",
  monthly_hours: "חיוב שעות חודשי",
  project: "פרויקט",
  expense: "הוצאות",
  overage: "חריגה",
  other: "אחר",
};

const AGE_LABELS: Record<AgeBucket, string> = {
  current: "במועד",
  "1-30": "1–30 ימים",
  "31-60": "31–60 ימים",
  "61-90": "61–90 ימים",
  "90+": "90+ ימים",
  paid: "שולם",
};

function formatILS(amount: number): string {
  return `₪${amount.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isThisMonth(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function InvoicesList({
  invoices,
  customers,
  projects,
  hourBanks,
}: {
  invoices: InvoiceListItem[];
  customers: CustomerOption[];
  projects: ProjectOption[];
  hourBanks: HourBankOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
  const toast = useToast();

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(visibleIds: string[]) {
    const allSelected = visibleIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...visibleIds]));
    }
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    if (!confirm(`למחוק ${ids.length} חשבוניות? (רק טיוטות ומבוטלות יימחקו)`)) return;
    startBulk(async () => {
      const res = await bulkDeleteInvoices(ids);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const msg =
        res.skipped > 0
          ? `נמחקו ${res.deleted}, דולגו ${res.skipped} (לא ניתן למחוק)`
          : `נמחקו ${res.deleted} חשבוניות`;
      toast.success(msg);
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleBulkStatus(status: "sent" | "cancelled") {
    const ids = Array.from(selected);
    const label = status === "sent" ? "נשלחה" : "מבוטל";
    if (!confirm(`לשנות סטטוס ${ids.length} חשבוניות ל"${label}"?`)) return;
    startBulk(async () => {
      const res = await bulkUpdateInvoiceStatus(ids, status);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`עודכנו ${res.updated} חשבוניות`);
      setSelected(new Set());
      router.refresh();
    });
  }

  const [status, setStatus] = useState<string>(
    searchParams.get("status") ?? loadFilters("invoices")?.status ?? "all",
  );
  const [customerId, setCustomerId] = useState<string>(
    searchParams.get("customer") ?? loadFilters("invoices")?.customer ?? "all",
  );
  const [age, setAge] = useState<string>(
    searchParams.get("age") ?? loadFilters("invoices")?.age ?? "all",
  );
  const [type, setType] = useState<string>(
    searchParams.get("type") ?? loadFilters("invoices")?.type ?? "all",
  );

  // Persist filters to URL and localStorage
  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (customerId !== "all") params.set("customer", customerId);
    if (age !== "all") params.set("age", age);
    if (type !== "all") params.set("type", type);
    const query = params.toString();
    router.replace(query ? `/invoices?${query}` : "/invoices", { scroll: false });
    saveFilters("invoices", { status, customer: customerId, age, type });
  }, [status, customerId, age, type, router]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (status !== "all" && inv.status !== status) return false;
      if (customerId !== "all" && inv.customer_id !== customerId) return false;
      if (age !== "all" && inv.age_bucket !== age) return false;
      // type filter handled if we had type column - it's not in aging view; skip
      return true;
    });
  }, [invoices, status, customerId, age]);

  // KPIs
  const kpis = useMemo(() => {
    let openTotal = 0;
    let overdue30 = 0;
    let overdue60 = 0;
    let collectedThisMonth = 0;
    for (const inv of invoices) {
      const remaining = inv.total_amount - inv.paid_amount;
      const isOpen = inv.status !== "paid" && inv.status !== "cancelled" && remaining > 0;
      if (isOpen) openTotal += remaining;
      if (isOpen && inv.days_overdue >= 30) overdue30 += remaining;
      if (isOpen && inv.days_overdue >= 60) overdue60 += remaining;
      if (inv.status === "paid" && isThisMonth(inv.issue_date)) {
        collectedThisMonth += inv.paid_amount;
      } else if (inv.paid_amount > 0 && isThisMonth(inv.issue_date)) {
        collectedThisMonth += inv.paid_amount;
      }
    }
    return { openTotal, overdue30, overdue60, collectedThisMonth };
  }, [invoices]);

  // Note: type filter is informational here since aging view doesn't expose type.
  // We hide the type filter from URL for now and keep it as a UI placeholder.
  void type;
  void setType;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-md text-navy">חשבוניות</h1>
          <p className="text-ink-soft mt-1 text-sm">{invoices.length} חשבוניות סך הכל</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          <Plus size={16} />
          חשבונית חדשה
        </button>
      </div>

      {/* KPI summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={<Wallet size={16} />}
          label='סה"כ פתוח'
          value={formatILS(kpis.openTotal)}
          tone="navy"
        />
        <KpiCard
          icon={<Clock size={16} />}
          label="בפיגור 30+"
          value={formatILS(kpis.overdue30)}
          tone={kpis.overdue30 > 0 ? "amber" : "muted"}
        />
        <KpiCard
          icon={<AlertTriangle size={16} />}
          label="בפיגור 60+"
          value={formatILS(kpis.overdue60)}
          tone={kpis.overdue60 > 0 ? "rose" : "muted"}
        />
        <KpiCard
          icon={<CheckCircle2 size={16} />}
          label="נגבה החודש"
          value={formatILS(kpis.collectedThisMonth)}
          tone="emerald"
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "כל הסטטוסים" },
            ...(Object.keys(STATUS_LABELS) as InvoiceStatusUI[]).map((s) => ({
              value: s,
              label: STATUS_LABELS[s],
            })),
          ]}
        />
        <FilterSelect
          value={customerId}
          onChange={setCustomerId}
          options={[
            { value: "all", label: "כל הלקוחות" },
            ...customers.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <FilterSelect
          value={age}
          onChange={setAge}
          options={[
            { value: "all", label: "כל הגילאים" },
            ...(Object.keys(AGE_LABELS) as AgeBucket[]).map((a) => ({
              value: a,
              label: AGE_LABELS[a],
            })),
          ]}
        />
      </div>

      {invoices.length === 0 ? (
        <EmptyState onNew={() => setShowNew(true)} />
      ) : filtered.length === 0 ? (
        <NoResults />
      ) : (
        <div className="bg-cream-paper border-ink-line overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-ink-line/60 border-b">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((inv) => selected.has(inv.id))}
                    onChange={() => toggleSelectAll(filtered.map((inv) => inv.id))}
                    className="cursor-pointer rounded"
                  />
                </th>
                <Th>מספר</Th>
                <Th>לקוח</Th>
                <Th>הוצאה</Th>
                <Th>תשלום עד</Th>
                <Th>סטטוס</Th>
                <Th>גיל</Th>
                <Th align="end">סכום</Th>
                <Th align="end">שולם</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  inv={inv}
                  isSelected={selected.has(inv.id)}
                  onToggleSelect={() => toggleSelect(inv.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BulkActionBar
        selectedCount={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: "סמן כנשלחה",
            icon: Send,
            isPending: bulkPending,
            onClick: () => handleBulkStatus("sent"),
          },
          {
            label: "בטל",
            isPending: bulkPending,
            onClick: () => handleBulkStatus("cancelled"),
          },
          {
            label: "מחק",
            icon: Trash2,
            variant: "danger",
            isPending: bulkPending,
            onClick: handleBulkDelete,
          },
        ]}
      />

      {showNew && (
        <NewInvoiceDialog
          customers={customers}
          projects={projects}
          hourBanks={hourBanks}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "end" }) {
  return (
    <th
      className={`text-ink-soft px-4 py-3 font-medium ${align === "end" ? "text-end" : "text-start"}`}
      scope="col"
    >
      {children}
    </th>
  );
}

function InvoiceRow({
  inv,
  isSelected,
  onToggleSelect,
}: {
  inv: InvoiceListItem;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const router = useRouter();
  const remaining = Math.max(inv.total_amount - inv.paid_amount, 0);
  const overdue =
    inv.status !== "paid" && inv.status !== "cancelled" && inv.days_overdue > 0 && remaining > 0;

  return (
    <tr
      onClick={() => router.push(`/invoices/${inv.id}`)}
      className={`border-ink-line cursor-pointer border-t transition-colors ${isSelected ? "bg-navy/5" : "hover:bg-cream-deep/40"}`}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer rounded"
        />
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/invoices/${inv.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-navy hover:text-navy-deep font-mono font-semibold"
          dir="ltr"
        >
          {inv.number ?? "טיוטה"}
        </Link>
      </td>
      <td className="px-4 py-3">
        <div className="text-navy">{inv.customer_name ?? "—"}</div>
        {inv.customer_company && (
          <div className="text-ink-faded text-xs">{inv.customer_company}</div>
        )}
      </td>
      <td className="text-ink-soft px-4 py-3">
        {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("he-IL") : "—"}
      </td>
      <td className="text-ink-soft px-4 py-3">
        <span className={overdue ? "font-medium text-rose-700" : ""}>
          {inv.due_date ? new Date(inv.due_date).toLocaleDateString("he-IL") : "—"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status]}`}
        >
          {STATUS_LABELS[inv.status]}
        </span>
      </td>
      <td className="text-ink-soft px-4 py-3 text-xs">
        {AGE_LABELS[inv.age_bucket] ?? inv.age_bucket}
      </td>
      <td className="text-navy px-4 py-3 text-end font-mono" dir="ltr">
        {formatILS(inv.total_amount)}
      </td>
      <td className="px-4 py-3 text-end font-mono" dir="ltr">
        <span className={inv.paid_amount > 0 ? "text-emerald-700" : "text-ink-faded"}>
          {formatILS(inv.paid_amount)}
        </span>
      </td>
    </tr>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "navy" | "amber" | "rose" | "emerald" | "muted";
}) {
  const toneClasses: Record<string, string> = {
    navy: "border-ink-line bg-cream-paper text-navy",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    muted: "border-ink-line bg-cream-paper text-ink-soft",
  };
  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <div className="text-ink-soft mb-1 flex items-center gap-1.5 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-mono text-lg font-semibold" dir="ltr">
        {value}
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="border-ink-line bg-cream-paper/40 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <div className="bg-cream-deep mb-4 flex h-20 w-20 items-center justify-center rounded-full">
        <Receipt size={48} className="text-navy/60" />
      </div>
      <h2 className="text-display-sm text-navy mb-2">אין עדיין חשבוניות</h2>
      <p className="text-ink-soft mb-6 max-w-md text-sm">
        צור את החשבונית הראשונה שלך — נשמור את הנתונים, ו-Make יוכל להמשיך משם ל-Finbot
      </p>
      <button
        type="button"
        onClick={onNew}
        className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors"
      >
        <Plus size={16} />
        חשבונית חדשה
      </button>
    </div>
  );
}

function NoResults() {
  return (
    <div className="border-ink-line bg-cream-paper/40 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <div className="bg-cream-deep mb-4 flex h-20 w-20 items-center justify-center rounded-full">
        <Calendar size={48} className="text-navy/60" />
      </div>
      <h2 className="text-display-sm text-navy mb-2">אין חשבוניות בסינון הזה</h2>
    </div>
  );
}
