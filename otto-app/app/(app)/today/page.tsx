import Link from "next/link";
import { AlertCircle, Clock, Calendar, ArrowLeft, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ParentSearchItem } from "@/components/activities/parent-picker";
import { TodayActivityRow } from "./today-activity-row";
import { TodayTaskRow, type TodayTaskItem } from "./today-task-row";
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
  const todayDateStr = startOfToday.toISOString().slice(0, 10);

  // Open tasks (any due date), ordered by due ASC
  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id, title, description, status, priority, due_date, completed_at, customer_id, lead_id, customers(id, name), leads(id, name)",
    )
    .not("status", "in", '("done","cancelled")')
    .order("due_date", { ascending: true, nullsFirst: false });

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

  const normalizeMeetings = (rows: unknown[] | null): ActivityWithParent[] =>
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

  const normalizeTasks = (rows: unknown[] | null): TodayTaskItem[] =>
    (rows ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      const customers = Array.isArray(row.customers) ? row.customers[0] : row.customers;
      const leads = Array.isArray(row.leads) ? row.leads[0] : row.leads;
      return {
        id: row.id as string,
        title: row.title as string,
        status: row.status as string,
        priority: row.priority as string,
        due_date: (row.due_date as string | null) ?? null,
        completed_at: (row.completed_at as string | null) ?? null,
        customer_id: (row.customer_id as string | null) ?? null,
        lead_id: (row.lead_id as string | null) ?? null,
        customers: (customers as { id: string; name: string } | null) ?? null,
        leads: (leads as { id: string; name: string } | null) ?? null,
      };
    });

  const allTasks = normalizeTasks(tasks);
  const allMeetings = normalizeMeetings(meetings);

  // לקוחות + לידים לבורר ה-parent
  const [{ data: customers }, { data: leads }] = await Promise.all([
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("leads").select("id, name").order("name"),
  ]);
  const parentItems: ParentSearchItem[] = [
    ...(customers ?? []).map((c) => ({ id: c.id, name: c.name, kind: "customer" as const })),
    ...(leads ?? []).map((l) => ({ id: l.id, name: l.name, kind: "lead" as const })),
  ];

  const overdue = allTasks.filter((t) => t.due_date && t.due_date < todayDateStr);
  const dueToday = allTasks.filter((t) => t.due_date === todayDateStr);
  const upcoming = allTasks.filter((t) => t.due_date && t.due_date > todayDateStr);
  const noDueDate = allTasks.filter((t) => !t.due_date);

  const dateLabel = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-navy text-base font-semibold">{dateLabel}</p>
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
            <TodayTaskRow key={t.id} task={t} variant="overdue" />
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
            <TodayTaskRow key={t.id} task={t} variant="task" />
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
            <TodayTaskRow key={t.id} task={t} variant="upcoming" />
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
            <TodayTaskRow key={t.id} task={t} variant="upcoming" />
          ))}
        </Section>
      )}

      {allTasks.length === 0 && allMeetings.length === 0 && (
        <div className="bg-cream-paper shadow-card flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
          <span className="font-caveat text-accent mb-2 block text-[48px] leading-none opacity-75">
            יום חופשי ☕
          </span>
          <h3 className="text-display-sm text-navy mb-2">היום הזה פנוי</h3>
          <p className="text-ink-soft mx-auto mb-6 max-w-md text-sm leading-relaxed">
            אין משימות או פגישות מתוזמנות. אולי זה זמן ליצור פעילות חדשה או לקפוץ ללקוחות?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/customers"
              className="shadow-card text-navy bg-cream-paper flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:shadow-md"
            >
              לקוחות <ArrowLeft size={13} />
            </Link>
            <Link
              href="/leads"
              className="shadow-card text-navy bg-cream-paper flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:shadow-md"
            >
              לידים <ArrowLeft size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
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
    <section className="bg-cream-paper shadow-card rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-navy text-sm font-semibold">{title}</h2>
        <span className="bg-cream-deep text-ink-soft rounded-full px-2 py-0.5 text-xs font-medium">
          {count}
        </span>
      </div>
      <div className="space-y-1">{children}</div>
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
      ? "bg-red-50/60 ring-1 ring-red-200"
      : tone === "primary"
        ? "bg-navy/5 ring-1 ring-navy/15"
        : "bg-cream-paper";
  const valueColor = tone === "danger" ? "text-red-700" : "text-navy";

  return (
    <div className={`shadow-card rounded-2xl p-4 ${styles}`}>
      <div className="text-ink-soft mb-2 flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
      </div>
      <div className={`text-[28px] leading-none font-bold tracking-tight ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}
