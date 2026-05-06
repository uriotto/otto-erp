import Link from "next/link";
import { Activity, Phone, Mail, Calendar, StickyNote, Clock, ArrowLeft } from "lucide-react";
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
                  <div className="bg-cream-deep mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
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
