import Link from "next/link";
import {
  Users,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  Activity,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

function StatCard({
  icon,
  label,
  value,
  hint,
  href,
  tone,
  iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "primary" | "warning";
  iconBg?: string;
}) {
  const cardStyles = tone === "warning" ? "bg-red-50 ring-1 ring-red-200" : "bg-cream-paper";
  const interactive = href
    ? "hover:-translate-y-1 hover:shadow-lg transition-all duration-200 cursor-pointer"
    : "";
  const valueColor = tone === "warning" ? "text-red-700" : "text-navy";

  const content = (
    <div className={`shadow-card rounded-2xl p-5 ${cardStyles} ${interactive}`}>
      <div className="mb-4 flex items-start justify-between">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg ?? "bg-navy/8"}`}
        >
          {icon}
        </span>
      </div>
      <div className={`text-[30px] leading-none font-bold tracking-tight ${valueColor}`}>
        {value}
      </div>
      <div className="text-ink-soft mt-2 text-xs font-medium">{label}</div>
      {hint && <div className="text-ink-faded mt-1 text-[11px]">{hint}</div>}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export async function DashboardStats() {
  const supabase = await createClient();

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
  ]);

  const openPipelineValue = (openLeads ?? []).reduce((sum, l) => sum + (l.value ?? 0), 0);
  const wonValue = (leadsWon ?? []).reduce((sum, l) => sum + (l.value ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Users size={17} className="text-blue-600" />}
          label="לקוחות"
          value={customersTotal ?? 0}
          hint={customersActive ? `${customersActive} פעילים` : undefined}
          href="/customers"
          iconBg="bg-blue-50"
        />
        <StatCard
          icon={<TrendingUp size={17} className="text-emerald-600" />}
          label="לידים פעילים"
          value={(openLeads ?? []).length}
          hint={leadsTotal ? `מתוך ${leadsTotal} סה"כ` : undefined}
          href="/leads"
          iconBg="bg-emerald-50"
        />
        <StatCard
          icon={
            <CheckCircle2
              size={17}
              className={(tasksOverdue ?? 0) > 0 ? "text-red-600" : "text-orange-500"}
            />
          }
          label="משימות היום"
          value={tasksDueToday ?? 0}
          hint={(tasksOverdue ?? 0) > 0 ? `${tasksOverdue} באיחור` : undefined}
          href="/today"
          tone={(tasksOverdue ?? 0) > 0 ? "warning" : undefined}
          iconBg={(tasksOverdue ?? 0) > 0 ? "bg-red-50" : "bg-orange-50"}
        />
        <StatCard
          icon={<Activity size={17} className="text-purple-600" />}
          label="פעילויות השבוע"
          value={activitiesThisWeek ?? 0}
          iconBg="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<DollarSign size={17} className="text-amber-600" />}
          label="פוטנציאל בפייפליין"
          value={`₪${openPipelineValue.toLocaleString("he-IL")}`}
          hint={wonValue ? `נסגר: ₪${wonValue.toLocaleString("he-IL")}` : undefined}
          iconBg="bg-amber-50"
        />
        <StatCard
          icon={
            <AlertCircle
              size={17}
              className={(tasksOverdue ?? 0) > 0 ? "text-red-600" : "text-ink-faded"}
            />
          }
          label="משימות באיחור"
          value={tasksOverdue ?? 0}
          href="/today"
          tone={(tasksOverdue ?? 0) > 0 ? "warning" : undefined}
          iconBg={(tasksOverdue ?? 0) > 0 ? "bg-red-50" : "bg-cream-deep"}
        />
        <StatCard
          icon={<CheckCircle2 size={17} className="text-teal-600" />}
          label="משימות פתוחות"
          value={tasksOpen ?? 0}
          href="/today"
          iconBg="bg-teal-50"
        />
        <StatCard
          icon={<Calendar size={17} className="text-indigo-600" />}
          label="פגישות היום"
          value={meetingsToday ?? 0}
          href="/today"
          iconBg="bg-indigo-50"
        />
      </div>
    </div>
  );
}
