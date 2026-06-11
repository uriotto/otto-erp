import Link from "next/link";
import { Phone, Mail, Calendar, StickyNote, Activity, Clock, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { relativeTimeHebrew } from "@/lib/relative-time";

type FeedItem = {
  id: string;
  kind: "activity" | "time_entry";
  type: string;
  title: string;
  occurred_at: string;
  customer_name: string | null;
  customer_id: string | null;
  href: string;
};

function activityIcon(item: FeedItem) {
  const cls = "h-3.5 w-3.5 shrink-0";
  if (item.kind === "time_entry") return <Clock className={`${cls} text-accent`} />;
  switch (item.type) {
    case "call":
      return <Phone className={`${cls} text-emerald-600`} />;
    case "email":
      return <Mail className={`${cls} text-navy`} />;
    case "meeting":
      return <Calendar className={`${cls} text-accent`} />;
    case "note":
      return <StickyNote className={`${cls} text-ink-soft`} />;
    default:
      return <Activity className={`${cls} text-ink-faded`} />;
  }
}

export async function DashboardActivity() {
  const supabase = await createClient();

  const [activitiesRes, timeEntriesRes] = await Promise.all([
    supabase
      .from("activities")
      .select(
        "id, type, title, occurred_at, customer_id, lead_id, customers(id, name), leads(id, name)",
      )
      .order("occurred_at", { ascending: false })
      .limit(8),
    supabase
      .from("time_entries")
      .select("id, duration_minutes, notes, end_time, customer_id, customers(id, name)")
      .order("end_time", { ascending: false })
      .limit(8),
  ]);

  const activityItems: FeedItem[] = (activitiesRes.data ?? []).map((a) => {
    const customer = a.customers as { id: string; name: string } | null;
    const lead = a.leads as { id: string; name: string } | null;
    return {
      id: `act-${a.id}`,
      kind: "activity",
      type: a.type,
      title: a.title,
      occurred_at: a.occurred_at,
      customer_name: customer?.name ?? lead?.name ?? null,
      customer_id: a.customer_id,
      href: customer ? `/customers/${customer.id}` : lead ? `/leads/${lead.id}` : "/today",
    };
  });

  const timeItems: FeedItem[] = (timeEntriesRes.data ?? []).map((t) => {
    const customer = t.customers as { id: string; name: string } | null;
    const hours = Math.floor(t.duration_minutes / 60);
    const mins = t.duration_minutes % 60;
    const duration = hours > 0 ? `${hours}ש' ${mins}ד'` : `${mins} דקות`;
    const label = customer ? `${duration} - ${customer.name}` : `${duration} ללא שיוך`;
    return {
      id: `te-${t.id}`,
      kind: "time_entry",
      type: "time_entry",
      title: t.notes ? `${label} · ${t.notes}` : label,
      occurred_at: t.end_time,
      customer_name: customer?.name ?? null,
      customer_id: t.customer_id,
      href: customer ? `/customers/${customer.id}` : "/time",
    };
  });

  const items = [...activityItems, ...timeItems]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 8);

  return (
    <div className="bg-cream-paper shadow-card rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-navy text-sm font-semibold">פעילות אחרונה</h2>
        <Link
          href="/today"
          className="text-ink-faded hover:text-navy flex items-center gap-1 text-xs transition-colors"
        >
          הכל <ArrowLeft className="h-3 w-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-ink-faded py-6 text-center text-sm">אין עדיין פעילויות</p>
      ) : (
        <ul className="divide-ink-line/60 divide-y">
          {items.map((item, i) => (
            <li
              key={item.id}
              className="animate-slide-up"
              style={{ animationDelay: `${i * 28}ms` }}
            >
              <Link
                href={item.href}
                className="hover:bg-cream group -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors"
              >
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                  {activityIcon(item)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-navy truncate text-sm font-medium">{item.title}</div>
                  <div className="text-ink-faded mt-0.5 flex items-center gap-1.5 text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {relativeTimeHebrew(item.occurred_at)}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
