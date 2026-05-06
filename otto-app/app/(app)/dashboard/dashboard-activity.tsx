import Link from "next/link";
import { Phone, Mail, Calendar, StickyNote, Activity, Clock, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { relativeTimeHebrew } from "@/lib/relative-time";

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

function activityIcon(type: string) {
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (type) {
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

function parentFromActivity(item: ActivityFeedRow): { name: string; href: string } | null {
  if (item.customer_id && item.customers) {
    return { name: item.customers.name, href: `/customers/${item.customers.id}` };
  }
  if (item.lead_id && item.leads) {
    return { name: item.leads.name, href: `/leads/${item.leads.id}` };
  }
  return null;
}

export async function DashboardActivity() {
  const supabase = await createClient();

  const { data: recentActivities } = await supabase
    .from("activities")
    .select(
      "id, type, title, occurred_at, created_at, customer_id, lead_id, customers(id, name), leads(id, name)",
    )
    .order("occurred_at", { ascending: false })
    .limit(8);

  const items = (recentActivities ?? []) as unknown as ActivityFeedRow[];

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
          {items.map((item, i) => {
            const parent = parentFromActivity(item);
            const href = parent?.href ?? "/today";
            return (
              <li
                key={item.id}
                className="animate-slide-up"
                style={{ animationDelay: `${i * 28}ms` }}
              >
                <Link
                  href={href}
                  className="hover:bg-cream group -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors"
                >
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                    {activityIcon(item.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-navy truncate text-sm font-medium">{item.title}</div>
                    <div className="text-ink-faded mt-0.5 flex items-center gap-1.5 text-xs">
                      {parent && (
                        <>
                          <span className="text-ink-soft truncate">{parent.name}</span>
                          <span>·</span>
                        </>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
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
