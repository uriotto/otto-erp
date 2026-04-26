import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Calendar, ArrowLeft, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_META, type ActivityType } from "@/components/activities/activity-types";
import type { ParentSearchItem } from "@/components/activities/parent-picker";
import { TodayActivityRow } from "./today-activity-row";
import { TodayNewButton } from "./today-new-button";

export const metadata = { title: "היום — OTTO" };

type ActivityWithParent = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  occurred_at: string;
  due_at: string | null;
  end_at: string | null;
  completed_at: string | null;
  customer_id: string | null;
  lead_id: string | null;
  customers: { id: string; name: string } | null;
  leads: { id: string; name: string } | null;
};

export default async function TodayPage() {
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // Open tasks (any due date), ordered by due ASC
  const { data: tasks } = await supabase
    .from("activities")
    .select(
      "id, type, title, body, occurred_at, due_at, end_at, completed_at, customer_id, lead_id, customers(id, name), leads(id, name)",
    )
    .eq("type", "task")
    .is("completed_at", null)
    .order("due_at", { ascending: true, nullsFirst: false });

  // Today's meetings
  const { data: meetings } = await supabase
    .from("activities")
    .select(
      "id, type, title, body, occurred_at, due_at, end_at, completed_at, customer_id, lead_id, customers(id, name), leads(id, name)",
    )
    .eq("type", "meeting")
    .gte("occurred_at", startOfToday.toISOString())
    .lte("occurred_at", endOfToday.toISOString())
    .order("occurred_at", { ascending: true });

  // Supabase מחזיר את ה-join כ-array או null. נורמליזציה ל-object יחיד.
  const normalize = (rows: unknown[] | null): ActivityWithParent[] =>
    (rows ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      const customers = Array.isArray(row.customers) ? row.customers[0] : row.customers;
      const leads = Array.isArray(row.leads) ? row.leads[0] : row.leads;
      return {
        ...(row as Omit<ActivityWithParent, "customers" | "leads">),
        customers: (customers as ActivityWithParent["customers"]) ?? null,
        leads: (leads as ActivityWithParent["leads"]) ?? null,
      };
    });

  const allTasks = normalize(tasks);
  const allMeetings = normalize(meetings);

  // לקוחות + לידים לבורר ה-parent
  const [{ data: customers }, { data: leads }] = await Promise.all([
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("leads").select("id, name").order("name"),
  ]);
  const parentItems: ParentSearchItem[] = [
    ...(customers ?? []).map((c) => ({ id: c.id, name: c.name, kind: "customer" as const })),
    ...(leads ?? []).map((l) => ({ id: l.id, name: l.name, kind: "lead" as const })),
  ];

  const overdue = allTasks.filter((t) => t.due_at && new Date(t.due_at) < startOfToday);
  const dueToday = allTasks.filter(
    (t) => t.due_at && new Date(t.due_at) >= startOfToday && new Date(t.due_at) <= endOfToday,
  );
  const upcoming = allTasks.filter((t) => t.due_at && new Date(t.due_at) > endOfToday);
  const noDueDate = allTasks.filter((t) => !t.due_at);

  const greeting = getGreeting();
  const dateLabel = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-display-sm text-navy">{greeting}</h1>
          <p className="text-ink-soft mt-1 text-sm">{dateLabel}</p>
        </div>
        <TodayNewButton parentItems={parentItems} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<AlertCircle size={18} />}
          label="באיחור"
          value={overdue.length}
          tone={overdue.length > 0 ? "danger" : "neutral"}
        />
        <StatCard
          icon={<Clock size={18} />}
          label="היום"
          value={dueToday.length + allMeetings.length}
          tone="primary"
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="ממתין"
          value={upcoming.length + noDueDate.length}
          tone="neutral"
        />
      </div>

      {overdue.length > 0 && (
        <Section
          title="משימות באיחור"
          icon={<AlertCircle size={16} className="text-red-600" />}
          count={overdue.length}
        >
          {overdue.map((t) => (
            <TodayActivityRow key={t.id} activity={t} variant="overdue" />
          ))}
        </Section>
      )}

      {allMeetings.length > 0 && (
        <Section
          title="פגישות היום"
          icon={<Calendar size={16} className="text-orange-600" />}
          count={allMeetings.length}
        >
          {allMeetings.map((m) => (
            <TodayActivityRow key={m.id} activity={m} variant="meeting" />
          ))}
        </Section>
      )}

      {dueToday.length > 0 && (
        <Section
          title="משימות להיום"
          icon={<Clock size={16} className="text-blue-600" />}
          count={dueToday.length}
        >
          {dueToday.map((t) => (
            <TodayActivityRow key={t.id} activity={t} variant="task" />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section
          title="משימות עתידיות"
          icon={<TrendingUp size={16} className="text-gray-600" />}
          count={upcoming.length}
        >
          {upcoming.map((t) => (
            <TodayActivityRow key={t.id} activity={t} variant="upcoming" />
          ))}
        </Section>
      )}

      {noDueDate.length > 0 && (
        <Section
          title="משימות ללא תאריך יעד"
          icon={<Clock size={16} className="text-gray-400" />}
          count={noDueDate.length}
        >
          {noDueDate.map((t) => (
            <TodayActivityRow key={t.id} activity={t} variant="upcoming" />
          ))}
        </Section>
      )}

      {allTasks.length === 0 && allMeetings.length === 0 && (
        <div className="border-ink-line bg-cream-paper rounded-2xl border border-dashed py-16 text-center">
          <CheckCircle2 size={40} className="text-ink-faded mx-auto mb-3" />
          <p className="text-navy mb-1 font-semibold">אין משימות פתוחות. כל הכבוד 👏</p>
          <p className="text-ink-soft text-sm">הוסף משימות חדשות בדף של לקוח או ליד.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              href="/customers"
              className="border-ink-line text-navy hover:border-navy flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors"
            >
              לקוחות <ArrowLeft size={13} />
            </Link>
            <Link
              href="/leads"
              className="border-ink-line text-navy hover:border-navy flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors"
            >
              לידים <ArrowLeft size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "לילה טוב";
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-navy font-semibold">{title}</h2>
        <span className="text-ink-faded text-sm">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "danger" | "primary" | "neutral";
}) {
  const styles =
    tone === "danger"
      ? "border-red-200 bg-red-50"
      : tone === "primary"
        ? "border-navy/10 bg-navy/5"
        : "border-ink-line bg-cream-paper";
  const valueColor =
    tone === "danger" ? "text-red-700" : tone === "primary" ? "text-navy" : "text-navy";

  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <div className="text-ink-soft mb-1 flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </div>
      <div className={`text-display-md font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}
