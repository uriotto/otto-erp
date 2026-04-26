import Link from "next/link";
import {
  Banknote,
  AlertTriangle,
  FileText,
  LayoutGrid,
  TrendingUp,
  Users,
  Calendar,
  ArrowLeft,
  CreditCard,
  Receipt,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { relativeTimeHebrew } from "@/lib/relative-time";
import { exportFinancialDataCsv } from "./actions";

export const metadata = {
  title: "פיננסים — OTTO",
};

interface InvoiceRow {
  id: string;
  number: string | null;
  customer_id: string | null;
  status: string | null;
  type: string | null;
  issue_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  total_amount: number | null;
}

interface InvoiceAgingRow {
  id: string;
  customer_id: string | null;
  status: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  age_bucket: string | null;
  days_overdue: number | null;
  due_date: string | null;
}

interface PaymentRow {
  id: string;
  invoice_id: string | null;
  amount: number | null;
  method: string | null;
  paid_at: string | null;
}

interface HourBankRow {
  id: string;
  status: string | null;
  total_amount: number | null;
}

interface CustomerLite {
  id: string;
  name: string;
}

const AGE_BUCKET_ORDER: ReadonlyArray<{
  key: string;
  label: string;
  tone: "ok" | "info" | "warn" | "danger" | "critical";
}> = [
  { key: "current", label: "בתוקף", tone: "ok" },
  { key: "1-30", label: "1-30 ימים", tone: "info" },
  { key: "31-60", label: "31-60 ימים", tone: "warn" },
  { key: "61-90", label: "61-90 ימים", tone: "danger" },
  { key: "90+", label: "מעל 90 ימים", tone: "critical" },
];

function formatCurrency(amount: number): string {
  return amount.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("he-IL");
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("he-IL", { month: "short", year: "2-digit" });
}

export default async function FinancePage() {
  const supabase = await createClient();

  const sb = supabase;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonth = addMonths(monthStart, 1);
  const yearAgo = addMonths(monthStart, -11);

  const [
    paymentsThisMonthRes,
    openInvoicesRes,
    agingRes,
    activeBanksRes,
    paymentsLast12Res,
    customersRes,
    recentPaymentsRes,
  ] = await Promise.all([
    sb
      .from("payments")
      .select("amount")
      .gte("paid_at", monthStart.toISOString())
      .lt("paid_at", nextMonth.toISOString()),
    sb
      .from("invoices_aging")
      .select(
        "id, customer_id, status, total_amount, paid_amount, age_bucket, days_overdue, due_date",
      )
      .neq("age_bucket", "paid"),
    sb
      .from("invoices_aging")
      .select(
        "id, customer_id, status, total_amount, paid_amount, age_bucket, days_overdue, due_date",
      ),
    sb.from("hour_banks").select("id, status, total_amount").eq("status", "active"),
    sb.from("payments").select("amount, paid_at, invoice_id").gte("paid_at", yearAgo.toISOString()),
    sb.from("customers").select("id, name"),
    sb
      .from("payments")
      .select("id, invoice_id, amount, method, paid_at")
      .order("paid_at", { ascending: false })
      .limit(8),
  ]);

  const paymentsThisMonth = ((paymentsThisMonthRes.data ?? []) as PaymentRow[]).reduce(
    (sum, p) => sum + Number(p.amount ?? 0),
    0,
  );

  const openInvoices = (openInvoicesRes.data ?? []) as InvoiceAgingRow[];
  const openInvoiceTotal = openInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total_amount ?? 0) - Number(inv.paid_amount ?? 0)),
    0,
  );

  const overdue30Plus = openInvoices
    .filter(
      (inv) => inv.age_bucket === "31-60" || inv.age_bucket === "61-90" || inv.age_bucket === "90+",
    )
    .reduce((sum, inv) => sum + (Number(inv.total_amount ?? 0) - Number(inv.paid_amount ?? 0)), 0);

  const activeBanks = (activeBanksRes.data ?? []) as HourBankRow[];
  const activeBanksTotal = activeBanks.reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0);

  // Aging report grouping
  const agingAll = (agingRes.data ?? []) as InvoiceAgingRow[];
  const agingGroups = AGE_BUCKET_ORDER.map((b) => {
    const items = agingAll.filter((inv) => inv.age_bucket === b.key);
    const outstanding = items.reduce(
      (sum, inv) => sum + (Number(inv.total_amount ?? 0) - Number(inv.paid_amount ?? 0)),
      0,
    );
    return { ...b, count: items.length, outstanding };
  });

  // Revenue last 12 months
  const paymentsLast12 = (paymentsLast12Res.data ?? []) as PaymentRow[];
  const months: { label: string; total: number; key: string }[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const start = addMonths(monthStart, -i);
    const end = addMonths(start, 1);
    const total = paymentsLast12
      .filter((p) => {
        if (!p.paid_at) return false;
        const t = new Date(p.paid_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      })
      .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    months.push({
      label: monthLabel(start),
      total,
      key: `${start.getFullYear()}-${start.getMonth()}`,
    });
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.total));

  // Top customers - need join: payments -> invoices -> customers
  const invoiceIds = Array.from(
    new Set(paymentsLast12.map((p) => p.invoice_id).filter((x): x is string => Boolean(x))),
  );

  let topCustomers: { id: string; name: string; total: number; invoiceCount: number }[] = [];
  const customers = (customersRes.data ?? []) as CustomerLite[];
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  if (invoiceIds.length > 0) {
    const invForCustRes = await sb.from("invoices").select("id, customer_id").in("id", invoiceIds);
    const invForCust = (invForCustRes.data ?? []) as { id: string; customer_id: string | null }[];
    const invToCustomer = new Map(invForCust.map((i) => [i.id, i.customer_id]));

    const totals = new Map<string, { total: number; invoices: Set<string> }>();
    for (const p of paymentsLast12) {
      if (!p.invoice_id) continue;
      const cid = invToCustomer.get(p.invoice_id);
      if (!cid) continue;
      const entry = totals.get(cid) ?? { total: 0, invoices: new Set<string>() };
      entry.total += Number(p.amount ?? 0);
      entry.invoices.add(p.invoice_id);
      totals.set(cid, entry);
    }

    topCustomers = Array.from(totals.entries())
      .map(([id, v]) => ({
        id,
        name: customerMap.get(id) ?? "—",
        total: v.total,
        invoiceCount: v.invoices.size,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }

  // Cash flow forecast: open invoices broken by week (next 4 weeks based on due_date)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekBuckets: { label: string; range: string; total: number }[] = [];
  for (let w = 0; w < 4; w += 1) {
    const start = new Date(today);
    start.setDate(start.getDate() + w * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const total = openInvoices
      .filter((inv) => {
        if (!inv.due_date) return false;
        const d = new Date(inv.due_date).getTime();
        return d >= start.getTime() && d < end.getTime();
      })
      .reduce(
        (sum, inv) => sum + (Number(inv.total_amount ?? 0) - Number(inv.paid_amount ?? 0)),
        0,
      );
    weekBuckets.push({
      label: `שבוע ${w + 1}`,
      range: `${formatDate(start.toISOString())} – ${formatDate(end.toISOString())}`,
      total,
    });
  }

  // Recent payments enrichment
  const recentPayments = (recentPaymentsRes.data ?? []) as PaymentRow[];
  const recentInvoiceIds = Array.from(
    new Set(recentPayments.map((p) => p.invoice_id).filter((x): x is string => Boolean(x))),
  );
  let recentInvoiceMap = new Map<string, { number: string | null; customer_id: string | null }>();
  if (recentInvoiceIds.length > 0) {
    const recentInvRes = await sb
      .from("invoices")
      .select("id, number, customer_id")
      .in("id", recentInvoiceIds);
    const recentInv = (recentInvRes.data ?? []) as InvoiceRow[];
    recentInvoiceMap = new Map(
      recentInv.map((inv) => [inv.id, { number: inv.number, customer_id: inv.customer_id }]),
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display-md text-navy">פיננסים</h1>
          <p className="text-ink-soft mt-1 text-sm">סקירה פיננסית, גילוי חובות ותזרים מזומנים</p>
        </div>
        <div className="flex gap-2">
          <ExportCsvButton label="ייצוא Excel" action={exportFinancialDataCsv} />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={<Banknote size={18} />} label="הכנסה החודש" value={paymentsThisMonth} />
        <KpiCard
          icon={<FileText size={18} />}
          label="חשבוניות פתוחות"
          value={openInvoiceTotal}
          tone="primary"
        />
        <KpiCard
          icon={<AlertTriangle size={18} />}
          label="בפיגור 30+"
          value={overdue30Plus}
          tone={overdue30Plus > 0 ? "warning" : undefined}
        />
        <KpiCard
          icon={<LayoutGrid size={18} />}
          label="בנקי שעות פעילים"
          value={activeBanksTotal}
          hint={`${activeBanks.length} בנקים`}
        />
      </div>

      {/* Aging + Revenue chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AgingCard groups={agingGroups} />
        <RevenueChartCard months={months} maxMonth={maxMonth} />
      </div>

      {/* Top customers + Cash flow */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TopCustomersCard customers={topCustomers} />
        <CashFlowCard weeks={weekBuckets} activeBanksTotal={activeBanksTotal} />
      </div>

      {/* Recent payments */}
      <RecentPaymentsCard
        payments={recentPayments}
        invoiceMap={recentInvoiceMap}
        customerMap={customerMap}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
  tone?: "primary" | "warning";
}) {
  const toneStyles =
    tone === "primary"
      ? "border-navy/15 bg-navy/5"
      : tone === "warning"
        ? "border-red-200 bg-red-50/40"
        : "border-ink-line bg-cream-paper";
  const valueColor = tone === "warning" ? "text-red-700" : "text-navy";

  return (
    <div className={`rounded-2xl border p-5 transition-all duration-200 ${toneStyles}`}>
      <div className="text-ink-soft mb-2 flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </div>
      <div
        className={`font-mono text-3xl font-bold ${valueColor}`}
        dir="ltr"
        style={{ textAlign: "start" }}
      >
        ₪{formatCurrency(value)}
      </div>
      {hint && <div className="text-ink-faded mt-1 text-xs">{hint}</div>}
    </div>
  );
}

function AgingCard({
  groups,
}: {
  groups: ReadonlyArray<{
    key: string;
    label: string;
    tone: "ok" | "info" | "warn" | "danger" | "critical";
    count: number;
    outstanding: number;
  }>;
}) {
  const toneClasses: Record<string, string> = {
    ok: "text-emerald-700 bg-emerald-50 border-emerald-200",
    info: "text-blue-700 bg-blue-50 border-blue-200",
    warn: "text-amber-700 bg-amber-50 border-amber-200",
    danger: "text-orange-700 bg-orange-50 border-orange-200",
    critical: "text-red-700 bg-red-50 border-red-200",
  };

  return (
    <div className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle size={14} className="text-navy" />
        <h2 className="text-navy text-sm font-semibold">דוח גיול חובות</h2>
      </div>
      <ul className="divide-ink-line/70 divide-y">
        {groups.map((g) => (
          <li key={g.key}>
            <Link
              href={`/invoices?age=${encodeURIComponent(g.key)}`}
              className="hover:bg-cream group -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[g.tone]}`}
                >
                  {g.label}
                </span>
                <span className="text-ink-soft text-xs">{g.count} חשבוניות</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-navy font-mono text-sm font-semibold" dir="ltr">
                  ₪{formatCurrency(g.outstanding)}
                </span>
                <ArrowLeft size={12} className="text-ink-faded group-hover:text-navy" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RevenueChartCard({
  months,
  maxMonth,
}: {
  months: { label: string; total: number; key: string }[];
  maxMonth: number;
}) {
  return (
    <div className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp size={14} className="text-navy" />
        <h2 className="text-navy text-sm font-semibold">הכנסות 12 חודשים אחרונים</h2>
      </div>
      <ul className="space-y-2">
        {months.map((m) => {
          const widthPct = maxMonth > 0 ? Math.max(2, (m.total / maxMonth) * 100) : 2;
          return (
            <li key={m.key} className="flex items-center gap-3">
              <span className="text-ink-soft w-16 shrink-0 text-xs">{m.label}</span>
              <div className="bg-cream-deep relative h-6 flex-1 overflow-hidden rounded-md">
                <div
                  className="bg-navy h-full rounded-md transition-all"
                  style={{ width: `${widthPct}%` }}
                />
                <span
                  className="absolute inset-y-0 end-2 flex items-center font-mono text-xs font-semibold text-white mix-blend-difference"
                  dir="ltr"
                >
                  {m.total > 0 ? `₪${formatCurrency(m.total)}` : ""}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TopCustomersCard({
  customers,
}: {
  customers: { id: string; name: string; total: number; invoiceCount: number }[];
}) {
  return (
    <div className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users size={14} className="text-navy" />
        <h2 className="text-navy text-sm font-semibold">לקוחות מובילים (12 חודשים)</h2>
      </div>
      {customers.length === 0 ? (
        <p className="text-ink-faded py-6 text-center text-sm">אין נתוני תשלומים</p>
      ) : (
        <ul className="divide-ink-line/70 divide-y">
          {customers.map((c, idx) => (
            <li key={c.id}>
              <Link
                href={`/customers/${c.id}`}
                className="hover:bg-cream group -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-ink-faded w-5 text-xs font-bold">{idx + 1}</span>
                  <div>
                    <div className="text-navy text-sm font-medium">{c.name}</div>
                    <div className="text-ink-faded text-xs">{c.invoiceCount} חשבוניות</div>
                  </div>
                </div>
                <span className="text-navy font-mono text-sm font-semibold" dir="ltr">
                  ₪{formatCurrency(c.total)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CashFlowCard({
  weeks,
  activeBanksTotal,
}: {
  weeks: { label: string; range: string; total: number }[];
  activeBanksTotal: number;
}) {
  const total = weeks.reduce((s, w) => s + w.total, 0);
  return (
    <div className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center gap-2">
        <Calendar size={14} className="text-navy" />
        <h2 className="text-navy text-sm font-semibold">תחזית תזרים</h2>
      </div>
      <ul className="space-y-2">
        {weeks.map((w) => (
          <li
            key={w.label}
            className="border-ink-line/60 flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <div>
              <div className="text-navy text-sm font-medium">{w.label}</div>
              <div className="text-ink-faded text-xs">{w.range}</div>
            </div>
            <span className="text-navy font-mono text-sm font-semibold" dir="ltr">
              ₪{formatCurrency(w.total)}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-ink-line mt-4 space-y-1.5 border-t pt-4 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-ink-soft">סה״כ צפוי 4 שבועות</span>
          <span className="text-navy font-mono font-semibold" dir="ltr">
            ₪{formatCurrency(total)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-soft">בנקי שעות פעילים</span>
          <span className="text-navy font-mono font-semibold" dir="ltr">
            ₪{formatCurrency(activeBanksTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

function RecentPaymentsCard({
  payments,
  invoiceMap,
  customerMap,
}: {
  payments: PaymentRow[];
  invoiceMap: Map<string, { number: string | null; customer_id: string | null }>;
  customerMap: Map<string, string>;
}) {
  const methodLabel: Record<string, string> = {
    bank_transfer: "העברה בנקאית",
    credit_card: "אשראי",
    cash: "מזומן",
    check: "צ׳ק",
    other: "אחר",
  };

  return (
    <div className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center gap-2">
        <CreditCard size={14} className="text-navy" />
        <h2 className="text-navy text-sm font-semibold">תשלומים אחרונים</h2>
      </div>
      {payments.length === 0 ? (
        <p className="text-ink-faded py-6 text-center text-sm">אין תשלומים אחרונים</p>
      ) : (
        <ul className="divide-ink-line/70 divide-y">
          {payments.map((p) => {
            const inv = p.invoice_id ? invoiceMap.get(p.invoice_id) : null;
            const customerName = inv?.customer_id ? (customerMap.get(inv.customer_id) ?? "—") : "—";
            const href = p.invoice_id ? `/invoices/${p.invoice_id}` : "/invoices";
            return (
              <li key={p.id}>
                <Link
                  href={href}
                  className="hover:bg-cream group -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors"
                >
                  <div className="border-ink-line bg-cream mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border">
                    <Receipt size={12} className="text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-navy truncate text-sm font-medium">{customerName}</span>
                      <span className="text-navy font-mono text-sm font-semibold" dir="ltr">
                        ₪{formatCurrency(Number(p.amount ?? 0))}
                      </span>
                    </div>
                    <div className="text-ink-faded mt-0.5 flex items-center gap-1.5 text-xs">
                      {inv?.number && <span>חשבונית {inv.number}</span>}
                      {inv?.number && <span>·</span>}
                      <span>{p.method ? (methodLabel[p.method] ?? p.method) : "—"}</span>
                      <span>·</span>
                      <span>{p.paid_at ? relativeTimeHebrew(p.paid_at) : ""}</span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
