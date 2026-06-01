import { createClient } from "@/lib/supabase/server";
import { TimeList, type TimeEntryItem } from "./time-list";

export const metadata = { title: "שעות — OTTO" };

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const supabase = await createClient();

  const { from, to } = await searchParams;

  // Default range = current month. Otherwise honour the from/to params (yyyy-mm-dd).
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromDate = from ? new Date(`${from}T00:00:00`) : defaultFrom;
  const toDate = to ? new Date(`${to}T23:59:59`) : now;
  const fromISO = fromDate.toISOString();
  const toISO = toDate.toISOString();

  const [
    { data: entries },
    { data: customers },
    { data: projects },
    { data: tasks },
    { data: activeBanks },
    { data: tenantSettings },
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
  ]);

  const customerMap = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const taskMap = new Map((tasks ?? []).map((t) => [t.id, t.title]));
  const customersWithActiveBank = new Set(
    (activeBanks ?? []).map((b) => b.customer_id).filter(Boolean) as string[],
  );

  const items: TimeEntryItem[] = (entries ?? []).map((e) => ({
    ...e,
    customer_name: e.customer_id ? (customerMap.get(e.customer_id) ?? null) : null,
    project_name: e.project_id ? (projectMap.get(e.project_id) ?? null) : null,
    task_name: e.task_id ? (taskMap.get(e.task_id) ?? null) : null,
  }));

  const rangeFrom = fromDate.toISOString().slice(0, 10);
  const rangeTo = toDate.toISOString().slice(0, 10);

  return (
    <TimeList
      entries={items}
      customers={customers ?? []}
      projects={projects ?? []}
      tasks={tasks ?? []}
      customersWithActiveBank={customersWithActiveBank}
      defaultHourlyRate={tenantSettings?.default_hourly_rate ?? 0}
      rangeFrom={rangeFrom}
      rangeTo={rangeTo}
    />
  );
}
