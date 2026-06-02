import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

/**
 * "מצב העסק" snapshot - the core business numbers for the master dashboard
 * and the morning brief. Single shared source so the dashboard screen, the
 * /api/bot/metrics endpoint, and the Telegram bot all report identical figures.
 *
 * All money is in NIS, all "this month" windows are calendar-month-to-date.
 */
export interface BusinessSnapshot {
  /** ISO month, e.g. "2026-06" */
  month: string;
  /** Weighted average billed rate this month (NIS/hour), 0 if no rated hours */
  effectiveHourlyRate: number;
  hoursThisMonth: number;
  billableHoursThisMonth: number;
  /** billable / total hours this month, 0-100 */
  utilizationPct: number;
  /** Sum of payments received this month */
  paymentsThisMonth: number;
  /** Outstanding (total - paid) on all non-paid invoices */
  openInvoicesTotal: number;
  /** Outstanding on invoices 30+ days overdue */
  overdue30Plus: number;
  /** Monthly recurring revenue: sum of active customers' retainer amounts */
  mrr: number;
  /** Total value of active hour banks */
  activeHourBanksTotal: number;
  /** Open pipeline value (leads not won/lost) */
  pipelineOpen: number;
  /** Value of leads won this month */
  pipelineWonThisMonth: number;
}

type Client = SupabaseClient<Database>;

interface TimeEntryLite {
  duration_minutes: number | null;
  billable: boolean | null;
  hourly_rate_at_entry: number | null;
}
interface PaymentLite {
  amount: number | null;
}
interface InvoiceAgingLite {
  total_amount: number | null;
  paid_amount: number | null;
  age_bucket: string | null;
}
interface HourBankLite {
  total_amount: number | null;
}
interface RetainerLite {
  retainer_monthly_amount: number | null;
}
interface LeadValueLite {
  value: number | null;
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

/**
 * Compute the business snapshot. Pass `tenantId` when using a service-role
 * client (bot/API) so queries are tenant-scoped; omit it when using a
 * request-scoped server client where RLS already scopes the rows.
 */
export async function getBusinessSnapshot(
  sb: Client,
  opts: { tenantId?: string } = {},
): Promise<BusinessSnapshot> {
  const tenantId = opts.tenantId;
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonth = addMonths(monthStart, 1);

  // Untyped-friendly query helpers. invoices_aging is a view and some columns
  // are looked up loosely, so we cast the builder to keep this resilient to
  // generated-type drift (mirrors the pattern in app/(app)/finance).
  const from = (table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (sb as unknown as { from: (t: string) => any }).from(table);
    return {
      scoped(builder: (b: typeof q) => typeof q) {
        q = builder(q);
        if (tenantId) q = q.eq("tenant_id", tenantId);
        return q;
      },
    };
  };

  const [timeRes, paymentsRes, agingRes, banksRes, retainersRes, leadsOpenRes, leadsWonRes] =
    await Promise.all([
      from("time_entries").scoped((q) =>
        q
          .select("duration_minutes, billable, hourly_rate_at_entry")
          .gte("start_time", monthStart.toISOString())
          .lt("start_time", nextMonth.toISOString()),
      ),
      from("payments").scoped((q) =>
        q
          .select("amount")
          .gte("paid_at", monthStart.toISOString())
          .lt("paid_at", nextMonth.toISOString()),
      ),
      from("invoices_aging").scoped((q) =>
        q.select("total_amount, paid_amount, age_bucket").neq("age_bucket", "paid"),
      ),
      from("hour_banks").scoped((q) => q.select("total_amount").eq("status", "active")),
      from("customers").scoped((q) => q.select("retainer_monthly_amount").eq("status", "active")),
      from("leads").scoped((q) => q.select("value").not("status", "in", '("won","lost")')),
      from("leads").scoped((q) =>
        q
          .select("value")
          .eq("status", "won")
          .gte("updated_at", monthStart.toISOString())
          .lt("updated_at", nextMonth.toISOString()),
      ),
    ]);

  // Fail loud: a silently-zeroed query would feed Uri a wrong business number,
  // which is worse than no number at all. Any query error aborts the snapshot.
  for (const res of [
    timeRes,
    paymentsRes,
    agingRes,
    banksRes,
    retainersRes,
    leadsOpenRes,
    leadsWonRes,
  ]) {
    if (res.error) throw new Error(`metrics query failed: ${res.error.message}`);
  }

  const entries = (timeRes.data ?? []) as TimeEntryLite[];
  let totalMinutes = 0;
  let billableMinutes = 0;
  let ratedMinutes = 0;
  let ratedValue = 0;
  for (const e of entries) {
    const mins = Number(e.duration_minutes ?? 0);
    totalMinutes += mins;
    if (e.billable) billableMinutes += mins;
    if (e.hourly_rate_at_entry != null) {
      ratedMinutes += mins;
      ratedValue += mins * Number(e.hourly_rate_at_entry);
    }
  }
  const effectiveHourlyRate = ratedMinutes > 0 ? ratedValue / ratedMinutes : 0;
  const hoursThisMonth = totalMinutes / 60;
  const billableHoursThisMonth = billableMinutes / 60;
  const utilizationPct = totalMinutes > 0 ? (billableMinutes / totalMinutes) * 100 : 0;

  const paymentsThisMonth = ((paymentsRes.data ?? []) as PaymentLite[]).reduce(
    (sum, p) => sum + Number(p.amount ?? 0),
    0,
  );

  const aging = (agingRes.data ?? []) as InvoiceAgingLite[];
  const openInvoicesTotal = aging.reduce(
    (sum, inv) => sum + (Number(inv.total_amount ?? 0) - Number(inv.paid_amount ?? 0)),
    0,
  );
  const overdue30Plus = aging
    .filter(
      (inv) => inv.age_bucket === "31-60" || inv.age_bucket === "61-90" || inv.age_bucket === "90+",
    )
    .reduce((sum, inv) => sum + (Number(inv.total_amount ?? 0) - Number(inv.paid_amount ?? 0)), 0);

  const activeHourBanksTotal = ((banksRes.data ?? []) as HourBankLite[]).reduce(
    (sum, b) => sum + Number(b.total_amount ?? 0),
    0,
  );

  const mrr = ((retainersRes.data ?? []) as RetainerLite[]).reduce(
    (sum, c) => sum + Number(c.retainer_monthly_amount ?? 0),
    0,
  );

  const pipelineOpen = ((leadsOpenRes.data ?? []) as LeadValueLite[]).reduce(
    (sum, l) => sum + Number(l.value ?? 0),
    0,
  );
  const pipelineWonThisMonth = ((leadsWonRes.data ?? []) as LeadValueLite[]).reduce(
    (sum, l) => sum + Number(l.value ?? 0),
    0,
  );

  return {
    month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
    effectiveHourlyRate: Math.round(effectiveHourlyRate),
    hoursThisMonth: Math.round(hoursThisMonth * 10) / 10,
    billableHoursThisMonth: Math.round(billableHoursThisMonth * 10) / 10,
    utilizationPct: Math.round(utilizationPct),
    paymentsThisMonth: Math.round(paymentsThisMonth),
    openInvoicesTotal: Math.round(openInvoicesTotal),
    overdue30Plus: Math.round(overdue30Plus),
    mrr: Math.round(mrr),
    activeHourBanksTotal: Math.round(activeHourBanksTotal),
    pipelineOpen: Math.round(pipelineOpen),
    pipelineWonThisMonth: Math.round(pipelineWonThisMonth),
  };
}
