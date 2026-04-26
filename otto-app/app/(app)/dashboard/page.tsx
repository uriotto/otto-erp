import Link from "next/link";
import {
  Users,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowLeft,
  DollarSign,
  Activity,
  Phone,
  Mail,
  StickyNote,
  CheckSquare,
  Square,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { relativeTimeHebrew } from "@/lib/relative-time";

export const metadata = {
  title: "דשבורד — OTTO",
};

type ActivityFeedRow = {
  id: string;
  type: string;
  title: string;
  occurred_at: string;
  created_at: string;
  customer_id: string | null;
  lead_id: string | null;
  customers: { id: string; name: string } | null;
  leads: { id: string; name: string } | null;
};

type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  customer_id: string | null;
  lead_id: string | null;
  customers: { id: string; name: string } | null;
  leads: { id: string; name: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase.from("users").select("full_name, email").single();
  const { data: tenant } = await supabase.from("tenants").select("name").single();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const todayDateStr = startOfToday.toISOString().slice(0, 10);

  const [
    { count: customersTotal },
    { count: customersActive },
    { count: leadsTotal },
    { data: openLeads },
    { count: tasksOpen },
    { count: tasksOverdue },
    { count: tasksDueToday },
    { count: meetingsToday },
    { count: activitiesThisWeek },
    { data: leadsWon },
    { data: recentActivities },
    { data: todayTasks },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("value, status").not("status", "in", '("won","lost")'),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("done","cancelled")'),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("done","cancelled")')
      .lt("due_date", todayDateStr),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("done","cancelled")')
      .eq("due_date", todayDateStr),
    supabase
      .from("activities")
      .select("*", { count: "exact", head: true })
      .eq("type", "meeting")
      .gte("occurred_at", startOfToday.toISOString())
      .lte("occurred_at", endOfToday.toISOString()),
    supabase
      .from("activities")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString()),
    supabase.from("leads").select("value").eq("status", "won"),
    supabase
      .from("activities")
      .select(
        "id, type, title, occurred_at, created_at, customer_id, lead_id, customers(id, name), leads(id, name)",
      )
      .order("occurred_at", { ascending: false })
      .limit(8),
    supabase
      .from("tasks")
      .select("id, title, due_date, customer_id, lead_id, customers(id, name), leads(id, name)")
      .not("status", "in", '("done","cancelled")')
      .eq("due_date", todayDateStr)
      .order("due_date", { ascending: true })
      .limit(5),
  ]);

  const openPipelineValue = (openLeads ?? []).reduce((sum, l) => sum + (l.value ?? 0), 0);
  const wonValue = (leadsWon ?? []).reduce((sum, l) => sum + (l.value ?? 0), 0);

  const displayName = profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "אורי";
  const greeting = getGreeting();

  const feedItems = (recentActivities ?? []) as unknown as ActivityFeedRow[];
  const tasks = (todayTasks ?? []) as unknown as TaskRow[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-md text-navy">
          {greeting}, {displayName}
        </h1>
        <p className="text-ink-soft mt-1 text-sm">
          {tenant?.name ?? "OTTO"} ·{" "}
          {new Date().toLocaleDateString("he-IL", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      {/* Top: 4 primary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Users size={18} />}
          label="לקוחות"
          value={customersTotal ?? 0}
          hint={customersActive ? `${customersActive} פעילים` : undefined}
          href="/customers"
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="לידים פעילים"
          value={(openLeads ?? []).length}
          hint={leadsTotal ? `מתוך ${leadsTotal} סה"כ` : undefined}
          href="/leads"
          tone="primary"
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="משימות היום"
          value={tasksDueToday ?? 0}
          hint={(tasksOverdue ?? 0) > 0 ? `${tasksOverdue} באיחור` : undefined}
          href="/today"
          tone={(tasksOverdue ?? 0) > 0 ? "warning" : undefined}
        />
        <StatCard
          icon={<Activity size={18} />}
          label="פעילויות השבוע"
          value={activitiesThisWeek ?? 0}
        />
      </div>

      {/* Middle: activity feed (60%) + today's tasks (40%) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ActivityFeed items={feedItems} />
        </div>
        <div className="lg:col-span-2">
          <TodayTasksCard tasks={tasks} totalToday={tasksDueToday ?? 0} />
        </div>
      </div>

      {/* Bottom: secondary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<DollarSign size={18} />}
          label="פוטנציאל"
          value={`₪${openPipelineValue.toLocaleString("he-IL")}`}
          hint={wonValue ? `נסגר: ₪${wonValue.toLocaleString("he-IL")}` : undefined}
        />
        <StatCard
          icon={<AlertCircle size={18} />}
          label="משימות באיחור"
          value={tasksOverdue ?? 0}
          href="/today"
          tone={(tasksOverdue ?? 0) > 0 ? "warning" : undefined}
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="משימות פתוחות"
          value={tasksOpen ?? 0}
          href="/today"
        />
        <StatCard
          icon={<Calendar size={18} />}
          label="פגישות היום"
          value={meetingsToday ?? 0}
          href="/today"
        />
      </div>
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

function StatCard({
  icon,
  label,
  value,
  hint,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "primary" | "warning";
}) {
  const toneStyles =
    tone === "primary"
      ? "border-navy/15 bg-navy/5"
      : tone === "warning"
        ? "border-red-200 bg-red-50/40"
        : "border-ink-line bg-cream-paper";

  const interactive = href
    ? "hover:-translate-y-0.5 hover:shadow-md hover:border-navy/30 transition-all duration-200"
    : "transition-all duration-200";

  const valueColor = tone === "warning" ? "text-red-700" : "text-navy";

  const content = (
    <div className={`rounded-2xl border p-5 ${toneStyles} ${interactive}`}>
      <div className="text-ink-soft mb-2 flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </div>
      <div className={`text-display-md font-bold ${valueColor}`}>{value}</div>
      {hint && <div className="text-ink-faded mt-1 text-xs">{hint}</div>}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function activityIcon(type: string) {
  const size = 14;
  switch (type) {
    case "call":
      return <Phone size={size} className="text-emerald-600" />;
    case "email":
      return <Mail size={size} className="text-blue-600" />;
    case "meeting":
      return <Calendar size={size} className="text-orange-600" />;
    case "note":
      return <StickyNote size={size} className="text-amber-600" />;
    default:
      return <Activity size={size} className="text-ink-soft" />;
  }
}

function parentFromActivity(item: ActivityFeedRow | TaskRow): {
  name: string;
  href: string;
} | null {
  if (item.customer_id && item.customers) {
    return { name: item.customers.name, href: `/customers/${item.customers.id}` };
  }
  if (item.lead_id && item.leads) {
    return { name: item.leads.name, href: `/leads/${item.leads.id}` };
  }
  return null;
}

function ActivityFeed({ items }: { items: ActivityFeedRow[] }) {
  return (
    <div className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-navy" />
          <h2 className="text-navy text-sm font-semibold">פעילות אחרונה</h2>
        </div>
        <Link
          href="/today"
          className="text-ink-faded hover:text-navy flex items-center gap-1 text-xs transition-colors"
        >
          הכל <ArrowLeft size={11} />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-ink-faded py-6 text-center text-sm">אין עדיין פעילויות</p>
      ) : (
        <ul className="divide-ink-line/70 divide-y">
          {items.map((item) => {
            const parent = parentFromActivity(item);
            const href = parent?.href ?? "/today";
            return (
              <li key={item.id}>
                <Link
                  href={href}
                  className="hover:bg-cream group -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors"
                >
                  <div className="border-ink-line bg-cream mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border">
                    {activityIcon(item.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-navy truncate text-sm font-medium">{item.title}</div>
                    <div className="text-ink-faded mt-0.5 flex items-center gap-1.5 text-xs">
                      {parent ? (
                        <span className="text-ink-soft truncate">{parent.name}</span>
                      ) : (
                        <span className="text-ink-faded">ללא קישור</span>
                      )}
                      <span className="text-ink-faded">·</span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {relativeTimeHebrew(item.occurred_at)}
                      </span>
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

function TodayTasksCard({ tasks, totalToday }: { tasks: TaskRow[]; totalToday: number }) {
  return (
    <div className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={14} className="text-navy" />
          <h2 className="text-navy text-sm font-semibold">המשימות שלי להיום</h2>
        </div>
        <Link
          href="/today"
          className="text-ink-faded hover:text-navy flex items-center gap-1 text-xs transition-colors"
        >
          {totalToday > 0 ? `${totalToday} סה"כ` : "הכל"} <ArrowLeft size={11} />
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="py-6 text-center">
          <CheckCircle2 size={28} className="text-ink-faded mx-auto mb-2 opacity-50" />
          <p className="text-ink-faded text-sm">אין משימות להיום</p>
          <p className="text-ink-faded mt-0.5 text-xs">תהנה מהשקט</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((task) => {
            const parent = parentFromActivity(task);
            const href = parent?.href ?? "/today";
            return (
              <li key={task.id}>
                <Link
                  href={href}
                  className="hover:bg-cream group -mx-2 flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors"
                >
                  <Square
                    size={16}
                    className="text-ink-faded group-hover:text-navy mt-0.5 shrink-0 transition-colors"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-navy truncate text-sm">{task.title}</div>
                    {parent && (
                      <div className="text-ink-faded mt-0.5 truncate text-xs">{parent.name}</div>
                    )}
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
