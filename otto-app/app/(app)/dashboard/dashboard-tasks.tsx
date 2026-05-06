import Link from "next/link";
import { CheckSquare, Square, ArrowLeft, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  customer_id: string | null;
  lead_id: string | null;
  customers: { id: string; name: string } | null;
  leads: { id: string; name: string } | null;
};

function parentFromTask(item: TaskRow): { name: string; href: string } | null {
  if (item.customer_id && item.customers) {
    return { name: item.customers.name, href: `/customers/${item.customers.id}` };
  }
  if (item.lead_id && item.leads) {
    return { name: item.leads.name, href: `/leads/${item.leads.id}` };
  }
  return null;
}

export async function DashboardTasks() {
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayDateStr = startOfToday.toISOString().slice(0, 10);

  const [{ count: tasksDueToday }, { data: todayTasks }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("done","cancelled")')
      .eq("due_date", todayDateStr),
    supabase
      .from("tasks")
      .select("id, title, due_date, customer_id, lead_id, customers(id, name), leads(id, name)")
      .not("status", "in", '("done","cancelled")')
      .eq("due_date", todayDateStr)
      .order("due_date", { ascending: true })
      .limit(5),
  ]);

  const tasks = (todayTasks ?? []) as unknown as TaskRow[];
  const totalToday = tasksDueToday ?? 0;
  const isEmpty = tasks.length === 0;

  return (
    <div
      className={`shadow-card flex h-full flex-col rounded-2xl p-5 ${
        isEmpty ? "bg-cream-paper" : "bg-navy/[0.03] ring-navy/8 ring-1"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={14} className={isEmpty ? "text-ink-faded" : "text-navy"} />
          <h2 className={`text-sm font-semibold ${isEmpty ? "text-ink-soft" : "text-navy"}`}>
            המשימות שלי להיום
          </h2>
        </div>
        <Link
          href="/today"
          className="text-ink-faded hover:text-navy flex items-center gap-1 text-xs transition-colors"
        >
          {totalToday > 0 ? `${totalToday} סה"כ` : "הכל"} <ArrowLeft className="h-3 w-3" />
        </Link>
      </div>

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <Sparkles size={22} className="text-accent mb-2 opacity-60" />
          <p className="text-ink-soft text-sm font-medium">אין משימות להיום</p>
          <p className="text-ink-faded mt-0.5 text-xs">תהנה מהשקט</p>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {tasks.map((task, i) => {
            const parent = parentFromTask(task);
            const href = parent?.href ?? "/today";
            return (
              <li
                key={task.id}
                className="animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <Link
                  href={href}
                  className="hover:bg-navy/[0.04] group -mx-2 flex items-start gap-2.5 rounded-lg px-2 py-2.5 transition-colors"
                >
                  <Square
                    size={15}
                    className="text-ink-faded group-hover:text-navy mt-0.5 shrink-0 transition-colors"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-navy truncate text-sm font-medium">{task.title}</div>
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
