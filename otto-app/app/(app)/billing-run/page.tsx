import { createClient } from "@/lib/supabase/server";
import { ilMonthRange, ilMonthLabel, ilDayKey } from "@/lib/dates";
import { BillingRunList, type BillingRunRow, type RetainerRow } from "./billing-run-list";

export const metadata = { title: "חיוב חודשי — OTTO" };

export default async function BillingRunPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();
  const { month } = await searchParams;

  // Default period: the previous Israel-calendar month. ?month=yyyy-mm overrides.
  const now = new Date();
  let range = ilMonthRange(now, -1);
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const anchor = ilMonthRange(new Date(Date.UTC(y ?? now.getUTCFullYear(), (m ?? 1) - 1, 15)));
    range = anchor;
  }
  const label = ilMonthLabel(range.start);
  const untilISO = range.end.toISOString();

  const [{ data: entries }, { data: customers }, { data: settings }] = await Promise.all([
    // All unbilled billable work up to the end of the reviewed month
    // (older unbilled hours are still owed - they're included, not hidden).
    supabase
      .from("time_entries")
      .select("customer_id, duration_minutes, hourly_rate_at_entry, is_overage, start_time")
      .eq("billable", true)
      .in("billing_status", ["pending", "overage"])
      .not("customer_id", "is", null)
      .lt("start_time", untilISO),
    supabase
      .from("customers")
      .select(
        "id, name, company, email, billing_model_default, hourly_rate_override, retainer_monthly_amount, status",
      )
      .eq("status", "active")
      .order("name"),
    supabase.from("tenant_settings").select("default_hourly_rate").maybeSingle(),
  ]);

  const defaultRate = Number(settings?.default_hourly_rate ?? 425);
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  type Agg = { minutes: number; overageMinutes: number; amount: number; inMonthMinutes: number };
  const byCustomer = new Map<string, Agg>();
  for (const e of entries ?? []) {
    if (!e.customer_id) continue;
    const customer = customerById.get(e.customer_id);
    // Retainer customers are billed a fixed monthly amount (separate section below) -
    // their tracked hours are informational, never billed hourly. Exclude them here
    // to prevent double billing.
    if (customer?.billing_model_default === "retainer") continue;
    const rate =
      Number(e.hourly_rate_at_entry) || Number(customer?.hourly_rate_override) || defaultRate;
    const minutes = e.duration_minutes ?? 0;
    const agg = byCustomer.get(e.customer_id) ?? {
      minutes: 0,
      overageMinutes: 0,
      amount: 0,
      inMonthMinutes: 0,
    };
    agg.minutes += minutes;
    if (e.is_overage) agg.overageMinutes += minutes;
    agg.amount += (minutes / 60) * rate;
    if (e.start_time && new Date(e.start_time) >= range.start) agg.inMonthMinutes += minutes;
    byCustomer.set(e.customer_id, agg);
  }

  const rows: BillingRunRow[] = Array.from(byCustomer.entries())
    .map(([customerId, agg]) => {
      const customer = customerById.get(customerId);
      return {
        customerId,
        customerName: customer?.name ?? "לקוח לא ידוע",
        company: customer?.company ?? null,
        hasEmail: Boolean(customer?.email),
        hours: Math.round((agg.minutes / 60) * 100) / 100,
        overageHours: Math.round((agg.overageMinutes / 60) * 100) / 100,
        olderHours: Math.round(((agg.minutes - agg.inMonthMinutes) / 60) * 100) / 100,
        estimatedAmount: Math.round(agg.amount * 100) / 100,
        missingRate: !customer?.hourly_rate_override && !defaultRate,
      };
    })
    .sort((a, b) => b.estimatedAmount - a.estimatedAmount);

  const retainers: RetainerRow[] = (customers ?? [])
    .filter((c) => c.billing_model_default === "retainer" && Number(c.retainer_monthly_amount) > 0)
    .map((c) => ({
      customerId: c.id,
      customerName: c.name,
      company: c.company ?? null,
      hasEmail: Boolean(c.email),
      amount: Number(c.retainer_monthly_amount),
    }));

  return (
    <BillingRunList
      rows={rows}
      retainers={retainers}
      monthLabel={label}
      monthKey={ilDayKey(range.start).slice(0, 7)}
      untilISO={untilISO}
    />
  );
}
