import Link from "next/link";
import { Users, TrendingUp, CheckSquare, BarChart2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

function StatCard({
  value,
  label,
  sub,
  href,
  icon,
  accent,
}: {
  value: string | number;
  label: string;
  sub?: string;
  href?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  const content = (
    <div
      className={[
        "bg-cream-paper flex flex-col gap-3 rounded-2xl p-5",
        accent ? "animate-accent-pulse" : "shadow-card",
        href && "cursor-pointer",
        href && accent && "transition-transform duration-200 hover:-translate-y-1",
        href && !accent && "transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={`text-[30px] leading-none font-bold tracking-tight tabular-nums ${
          accent ? "text-accent" : "text-navy"
        }`}
      >
        {value}
      </div>
      <div>
        <div
          className={`flex items-center gap-1.5 text-xs font-medium ${accent ? "text-accent/80" : "text-ink-soft"}`}
        >
          <span className="shrink-0">{icon}</span>
          {label}
        </div>
        {sub && <div className="text-ink-faded mt-0.5 text-[11px]">{sub}</div>}
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function SecondaryStatItem({
  value,
  label,
  href,
  accent,
}: {
  value: string | number;
  label: string;
  href?: string;
  accent?: boolean;
}) {
  const content = (
    <div className="flex items-baseline gap-1.5">
      <span
        className={`text-[18px] leading-none font-bold tabular-nums ${accent ? "text-accent" : "text-navy"}`}
      >
        {value}
      </span>
      <span className="text-ink-faded text-xs">{label}</span>
    </div>
  );

  return href ? (
    <Link href={href} className="transition-opacity hover:opacity-70">
      {content}
    </Link>
  ) : (
    content
  );
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
  const isOverdue = (tasksOverdue ?? 0) > 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          <StatCard
            key="customers"
            icon={<Users size={13} />}
            label="לקוחות"
            value={customersTotal ?? 0}
            sub={customersActive ? `${customersActive} פעילים` : undefined}
            href="/customers"
          />,
          <StatCard
            key="leads"
            icon={<TrendingUp size={13} />}
            label="לידים פעילים"
            value={(openLeads ?? []).length}
            sub={leadsTotal ? `מתוך ${leadsTotal} סה"כ` : undefined}
            href="/leads"
          />,
          <StatCard
            key="tasks"
            icon={<CheckSquare size={13} />}
            label="משימות להיום"
            value={tasksDueToday ?? 0}
            sub={isOverdue ? `${tasksOverdue} באיחור` : undefined}
            href="/today"
            accent={isOverdue}
          />,
          <StatCard
            key="pipeline"
            icon={<BarChart2 size={13} />}
            label="פוטנציאל בפייפליין"
            value={`₪${openPipelineValue.toLocaleString("he-IL")}`}
            sub={wonValue ? `נסגר: ₪${wonValue.toLocaleString("he-IL")}` : undefined}
          />,
        ].map((card, i) => (
          <div key={i} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
            {card}
          </div>
        ))}
      </div>

      <div
        className="animate-fade-in flex items-center gap-6 px-1"
        style={{ animationDelay: "280ms" }}
      >
        <SecondaryStatItem value={tasksOpen ?? 0} label="משימות פתוחות" href="/today" />
        <div className="bg-ink-line h-3 w-px" aria-hidden />
        <SecondaryStatItem value={meetingsToday ?? 0} label="פגישות היום" href="/calendar" />
        <div className="bg-ink-line h-3 w-px" aria-hidden />
        <SecondaryStatItem value={activitiesThisWeek ?? 0} label="פעילויות השבוע" />
        {isOverdue && (
          <>
            <div className="bg-ink-line h-3 w-px" aria-hidden />
            <SecondaryStatItem value={tasksOverdue ?? 0} label="באיחור" href="/today" accent />
          </>
        )}
      </div>
    </div>
  );
}
