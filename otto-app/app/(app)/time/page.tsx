import { createClient } from "@/lib/supabase/server";
import { ilDayEnd, ilDayStart, ilDayKey, ilMonthRange } from "@/lib/dates";
import { TimeList, type TimeEntryItem, type PendingTotal } from "./time-list";

export const metadata = { title: "שעות — OTTO" };

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const supabase = await createClient();

  const { from, to } = await searchParams;

  // Default range = current month (Israel calendar). from/to params are Israel days (yyyy-mm-dd).
  const now = new Date();
  const fromDate = from ? ilDayStart(from) : ilMonthRange(now).start;
  const toDate = to ? ilDayEnd(to) : now;
  const fromISO = fromDate.toISOString();
  const toISO = toDate.toISOString();

  const [
    { data: entries },
    { data: customers },
    { data: projects },
    { data: tasks },
    { data: activeBanks },
    { data: tenantSettings },
    { data: pendingEntries },
  ] = await Promise.all([
    supabase
      .from("time_entries")
      .select(
        "id, customer_id, project_id, task_id, start_time, end_time, duration_minutes, billable, billing_status, notes",
      )
      .gte("start_time", fromISO)
      .lte("start_time", toISO)
      .order("start_time", { ascending: false }),
    supabase
      .from("customers")
      .select("id, name, billing_model_default, hourly_rate_override")
      .order("name"),
    supabase.from("projects").select("id, name, customer_id").is("deleted_at", null).order("name"),
    supabase.from("tasks").select("id, title, project_id").order("title"),
    supabase.from("hour_banks").select("customer_id").eq("status", "active"),
    supabase.from("tenant_settings").select("default_hourly_rate").maybeSingle(),
    // The "pending billing" bar must reflect everything that would actually be
    // invoiced - the invoice actions ignore the date filter, so this query does too.
    supabase
      .from("time_entries")
      .select("customer_id, duration_minutes, start_time")
      .eq("billable", true)
      .in("billing_status", ["pending", "overage"]),
  ]);

  const customerMap = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const taskMap = new Map((tasks ?? []).map((t) => [t.id, t.title]));
  const customersWithActiveBank = new Set(
    (activeBanks ?? []).map((b) => b.customer_id).filter(Boolean) as string[],
  );

  const pendingMap = new Map<string, { minutes: number; oldest: string }>();
  for (const e of pendingEntries ?? []) {
    if (!e.customer_id) continue;
    const prev = pendingMap.get(e.customer_id);
    pendingMap.set(e.customer_id, {
      minutes: (prev?.minutes ?? 0) + (e.duration_minutes ?? 0),
      oldest: prev && prev.oldest <= e.start_time ? prev.oldest : e.start_time,
    });
  }
  const pendingTotals: PendingTotal[] = Array.from(pendingMap.entries())
    .filter(([customerId]) => customerMap.has(customerId))
    .map(([customerId, v]) => ({ customerId, minutes: v.minutes, oldest: v.oldest }));

  const items: TimeEntryItem[] = (entries ?? []).map((e) => ({
    ...e,
    customer_name: e.customer_id ? (customerMap.get(e.customer_id) ?? null) : null,
    project_name: e.project_id ? (projectMap.get(e.project_id) ?? null) : null,
    task_name: e.task_id ? (taskMap.get(e.task_id) ?? null) : null,
  }));

  const rangeFrom = ilDayKey(fromDate);
  const rangeTo = ilDayKey(toDate);

  return (
    <TimeList
      entries={items}
      customers={customers ?? []}
      projects={projects ?? []}
      tasks={tasks ?? []}
      customersWithActiveBank={customersWithActiveBank}
      defaultHourlyRate={tenantSettings?.default_hourly_rate ?? 0}
      pendingTotals={pendingTotals}
      rangeFrom={rangeFrom}
      rangeTo={rangeTo}
    />
  );
}
