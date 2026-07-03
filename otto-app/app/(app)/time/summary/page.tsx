import { createClient } from "@/lib/supabase/server";
import { ilMonthRange, ilMonthKey, ilMonthKeyLabel } from "@/lib/dates";
import { HoursSummary, type SummaryCustomer, type SummaryCell } from "./hours-summary";

export const metadata = { title: "סיכום שעות — OTTO" };

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

export default async function HoursSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; billable?: string }>;
}) {
  const supabase = await createClient();
  const { from, to, billable } = await searchParams;

  // Default range: last 6 Israel-calendar months (inclusive), by month key yyyy-mm.
  const now = new Date();
  const defaultTo = ilMonthKey(now);
  const defaultFrom = ilMonthKey(ilMonthRange(now, -5).start);
  const fromKey = from && MONTH_KEY_RE.test(from) ? from : defaultFrom;
  const toKeyRaw = to && MONTH_KEY_RE.test(to) ? to : defaultTo;
  // Guard against inverted ranges.
  const [fromKey2, toKey] = fromKey <= toKeyRaw ? [fromKey, toKeyRaw] : [toKeyRaw, fromKey];

  const billableOnly = billable === "yes";

  // Build the inclusive list of month keys in range.
  const monthKeys: string[] = [];
  {
    const [fy = 0, fm = 1] = fromKey2.split("-").map(Number);
    const [ty = 0, tm = 1] = toKey.split("-").map(Number);
    let cursor = fy * 12 + (fm - 1);
    const last = ty * 12 + (tm - 1);
    // Cap at 24 months to keep the pivot readable.
    while (cursor <= last && monthKeys.length < 24) {
      monthKeys.push(`${Math.floor(cursor / 12)}-${String((cursor % 12) + 1).padStart(2, "0")}`);
      cursor++;
    }
  }

  const rangeStart = ilMonthRange(
    new Date(Date.UTC(Number(fromKey2.slice(0, 4)), Number(fromKey2.slice(5)) - 1, 15)),
  ).start;
  const rangeEnd = ilMonthRange(
    new Date(Date.UTC(Number(toKey.slice(0, 4)), Number(toKey.slice(5)) - 1, 15)),
  ).end;

  let query = supabase
    .from("time_entries")
    .select("customer_id, duration_minutes, billable, start_time")
    .gte("start_time", rangeStart.toISOString())
    .lt("start_time", rangeEnd.toISOString());
  if (billableOnly) query = query.eq("billable", true);

  const [{ data: entries }, { data: customers }] = await Promise.all([
    query,
    supabase.from("customers").select("id, name").order("name"),
  ]);

  const customerName = new Map((customers ?? []).map((c) => [c.id, c.name]));

  // Aggregate minutes per (customer, month).
  const NO_CUSTOMER = "__none__";
  const grid = new Map<string, Map<string, number>>(); // customerKey -> monthKey -> minutes
  for (const e of entries ?? []) {
    if (!e.start_time) continue;
    const monthKey = ilMonthKey(new Date(e.start_time));
    if (!monthKeys.includes(monthKey)) continue;
    const custKey = e.customer_id ?? NO_CUSTOMER;
    const row = grid.get(custKey) ?? new Map<string, number>();
    row.set(monthKey, (row.get(monthKey) ?? 0) + (e.duration_minutes ?? 0));
    grid.set(custKey, row);
  }

  const toHours = (min: number) => Math.round((min / 60) * 100) / 100;

  const summaryCustomers: SummaryCustomer[] = Array.from(grid.entries())
    .map(([custKey, row]) => {
      const cells: SummaryCell[] = monthKeys.map((mk) => ({
        monthKey: mk,
        hours: toHours(row.get(mk) ?? 0),
      }));
      const totalHours = toHours(Array.from(row.values()).reduce((s, v) => s + v, 0));
      return {
        customerId: custKey === NO_CUSTOMER ? null : custKey,
        customerName:
          custKey === NO_CUSTOMER ? "ללא לקוח" : (customerName.get(custKey) ?? "לא ידוע"),
        cells,
        totalHours,
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  const months = monthKeys.map((mk) => ({ key: mk, label: ilMonthKeyLabel(mk) }));

  return (
    <HoursSummary
      customers={summaryCustomers}
      months={months}
      fromKey={fromKey2}
      toKey={toKey}
      billableOnly={billableOnly}
    />
  );
}
