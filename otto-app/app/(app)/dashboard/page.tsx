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
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "דשבורד — OTTO",
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

  const [
    { count: customersTotal },
    { count: customersActive },
    { count: leadsTotal },
    { data: openLeads },
    { count: tasksOpen },
    { count: tasksOverdue },
    { count: meetingsToday },
    { count: activitiesThisWeek },
    { data: leadsWon },
    { data: recentCustomers },
    { data: recentLeads },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("value, status").not("status", "in", '("won","lost")'),
    supabase
      .from("activities")
      .select("*", { count: "exact", head: true })
      .eq("type", "task")
      .is("completed_at", null),
    supabase
      .from("activities")
      .select("*", { count: "exact", head: true })
      .eq("type", "task")
      .is("completed_at", null)
      .lt("due_at", startOfToday.toISOString()),
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
      .from("customers")
      .select("id, name, company, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("leads")
      .select("id, name, company, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const openPipelineValue = (openLeads ?? []).reduce((sum, l) => sum + (l.value ?? 0), 0);
  const wonValue = (leadsWon ?? []).reduce((sum, l) => sum + (l.value ?? 0), 0);

  const displayName = profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "אורי";
  const greeting = getGreeting();

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

      {/* Top stats */}
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
          icon={<DollarSign size={18} />}
          label="פוטנציאל"
          value={`₪${openPipelineValue.toLocaleString("he-IL")}`}
          hint={wonValue ? `נסגר: ₪${wonValue.toLocaleString("he-IL")}` : undefined}
        />
        <StatCard
          icon={<Activity size={18} />}
          label="פעילויות השבוע"
          value={activitiesThisWeek ?? 0}
        />
      </div>

      {/* Today panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link
          href="/today"
          className={`bg-cream-paper hover:border-ink-soft border-ink-line group rounded-2xl border p-5 transition-all ${
            (tasksOverdue ?? 0) > 0 ? "border-red-200 bg-red-50/30" : ""
          }`}
        >
          <div className="text-ink-soft mb-2 flex items-center gap-1.5 text-xs">
            <AlertCircle size={14} className={(tasksOverdue ?? 0) > 0 ? "text-red-600" : ""} />
            משימות באיחור
          </div>
          <div
            className={`text-display-md font-bold ${(tasksOverdue ?? 0) > 0 ? "text-red-700" : "text-navy"}`}
          >
            {tasksOverdue ?? 0}
          </div>
          <div className="text-ink-faded mt-2 flex items-center gap-1 text-xs">
            לדף היום <ArrowLeft size={11} />
          </div>
        </Link>

        <Link
          href="/today"
          className="bg-cream-paper hover:border-ink-soft border-ink-line group rounded-2xl border p-5 transition-all"
        >
          <div className="text-ink-soft mb-2 flex items-center gap-1.5 text-xs">
            <CheckCircle2 size={14} />
            משימות פתוחות
          </div>
          <div className="text-display-md text-navy font-bold">{tasksOpen ?? 0}</div>
          <div className="text-ink-faded mt-2 flex items-center gap-1 text-xs">
            לדף היום <ArrowLeft size={11} />
          </div>
        </Link>

        <Link
          href="/today"
          className="bg-cream-paper hover:border-ink-soft border-ink-line group rounded-2xl border p-5 transition-all"
        >
          <div className="text-ink-soft mb-2 flex items-center gap-1.5 text-xs">
            <Calendar size={14} className="text-orange-600" />
            פגישות היום
          </div>
          <div className="text-display-md text-navy font-bold">{meetingsToday ?? 0}</div>
          <div className="text-ink-faded mt-2 flex items-center gap-1 text-xs">
            לדף היום <ArrowLeft size={11} />
          </div>
        </Link>
      </div>

      {/* Recent items */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentList
          title="לקוחות אחרונים"
          icon={<Users size={14} className="text-blue-600" />}
          items={(recentCustomers ?? []).map((c) => ({
            id: c.id,
            title: c.name,
            subtitle: c.company,
            href: `/customers/${c.id}`,
            date: c.created_at,
          }))}
          emptyText="אין עדיין לקוחות"
          allHref="/customers"
        />
        <RecentList
          title="לידים אחרונים"
          icon={<TrendingUp size={14} className="text-purple-600" />}
          items={(recentLeads ?? []).map((l) => ({
            id: l.id,
            title: l.name,
            subtitle: l.company,
            href: `/leads/${l.id}`,
            date: l.created_at,
          }))}
          emptyText="אין עדיין לידים"
          allHref="/leads"
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
  tone?: "primary";
}) {
  const styles = tone === "primary" ? "border-navy/10 bg-navy/5" : "border-ink-line bg-cream-paper";

  const content = (
    <div
      className={`rounded-2xl border p-5 transition-colors ${styles} ${href ? "hover:border-ink-soft" : ""}`}
    >
      <div className="text-ink-soft mb-2 flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </div>
      <div className="text-display-md text-navy font-bold">{value}</div>
      {hint && <div className="text-ink-faded mt-1 text-xs">{hint}</div>}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function RecentList({
  title,
  icon,
  items,
  emptyText,
  allHref,
}: {
  title: string;
  icon: React.ReactNode;
  items: { id: string; title: string; subtitle?: string | null; href: string; date: string }[];
  emptyText: string;
  allHref: string;
}) {
  return (
    <div className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-navy text-sm font-semibold">{title}</h2>
        </div>
        <Link
          href={allHref}
          className="text-ink-faded hover:text-navy flex items-center gap-1 text-xs transition-colors"
        >
          הכל <ArrowLeft size={11} />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-ink-faded py-4 text-center text-sm">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="hover:bg-cream flex items-center justify-between rounded-lg px-2 py-2 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-navy truncate text-sm font-medium">{item.title}</div>
                  {item.subtitle && (
                    <div className="text-ink-faded truncate text-xs">{item.subtitle}</div>
                  )}
                </div>
                <span className="text-ink-faded ms-3 shrink-0 text-xs">
                  {new Date(item.date).toLocaleDateString("he-IL", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
