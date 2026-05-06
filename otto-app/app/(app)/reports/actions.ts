"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ReportActionResult = { ok: true; id: string } | { ok: false; error: string };
export type ReportUpdateResult = { ok: true } | { ok: false; error: string };

const CreateReportSchema = z.object({
  customer_id: z.string().uuid("יש לבחור לקוח").optional().nullable(),
  type: z.enum(["monthly", "yearly", "custom"]),
  period_start: z.string().min(1, "תאריך התחלה חובה"),
  period_end: z.string().min(1, "תאריך סיום חובה"),
  title: z.string().min(1, "כותרת חובה").max(300),
  summary: z.string().max(4000).optional().nullable(),
});

async function getTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, id")
    .eq("id", user.id)
    .single();
  return { supabase, profile };
}

export async function createReport(
  input: z.infer<typeof CreateReportSchema>,
): Promise<ReportActionResult> {
  const parsed = CreateReportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      tenant_id: profile.tenant_id,
      customer_id: parsed.data.customer_id || null,
      type: parsed.data.type,
      period_start: parsed.data.period_start,
      period_end: parsed.data.period_end,
      title: parsed.data.title,
      summary: parsed.data.summary || null,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !report) return { ok: false, error: error?.message ?? "שגיאה ביצירת הדוח" };

  revalidatePath("/reports");
  return { ok: true, id: report.id };
}

export async function approveReport(id: string): Promise<ReportUpdateResult> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { error } = await supabase
    .from("reports")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      visible_to_client: true,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/reports");
  revalidatePath(`/reports/${id}`);
  return { ok: true };
}

export async function saveDraftReport(id: string, summary: string): Promise<ReportUpdateResult> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { error } = await supabase
    .from("reports")
    .update({ summary, status: "draft" })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/reports/${id}`);
  return { ok: true };
}

export async function deleteReport(id: string): Promise<ReportUpdateResult> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/reports");
  return { ok: true };
}

export type ReportData = {
  totalHours?: number;
  totalBilled?: number;
  timeEntries?: Array<{
    id: string;
    date: string;
    hours: number;
    description: string | null;
    task_title: string | null;
    project_name: string | null;
  }>;
  invoices?: Array<{
    id: string;
    number: string | null;
    issue_date: string | null;
    total_amount: number;
    status: string;
  }>;
};

export async function generateMonthlyReport(
  customerId: string,
  year: number,
  month: number,
): Promise<ReportActionResult> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: customer } = await supabase
    .from("customers")
    .select("name")
    .eq("id", customerId)
    .single();

  if (!customer) return { ok: false, error: "לקוח לא נמצא" };

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

  const [{ data: timeEntriesRaw }, { data: invoicesRaw }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id, date, hours, description, tasks(title), projects(name)")
      .eq("customer_id", customerId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date", { ascending: true }),
    supabase
      .from("invoices")
      .select("id, number, issue_date, total_amount, status")
      .eq("customer_id", customerId)
      .gte("issue_date", periodStart)
      .lte("issue_date", periodEnd)
      .order("issue_date", { ascending: true }),
  ]);

  const timeEntries = (timeEntriesRaw ?? []).map((e) => {
    const raw = e as unknown as {
      id: string;
      date: string;
      hours: number;
      description: string | null;
      tasks: { title: string } | null;
      projects: { name: string } | null;
    };
    return {
      id: raw.id,
      date: raw.date,
      hours: raw.hours,
      description: raw.description,
      task_title: raw.tasks?.title ?? null,
      project_name: raw.projects?.name ?? null,
    };
  });

  const invoices = (invoicesRaw ?? []).map((inv) => ({
    id: inv.id,
    number: inv.number,
    issue_date: inv.issue_date,
    total_amount: inv.total_amount ?? 0,
    status: inv.status,
  }));

  const totalHours = timeEntries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const totalBilled = invoices.reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0);

  const reportData: ReportData = { totalHours, totalBilled, timeEntries, invoices };

  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      tenant_id: profile.tenant_id,
      customer_id: customerId,
      type: "monthly",
      period_start: periodStart,
      period_end: periodEnd,
      title: `דוח חודשי — ${customer.name} — ${MONTH_NAMES[month - 1]} ${year}`,
      status: "pending_review",
      data: reportData as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (error || !report) return { ok: false, error: error?.message ?? "שגיאה ביצירת הדוח" };

  revalidatePath("/reports");
  return { ok: true, id: report.id };
}
