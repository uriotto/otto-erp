import Link from "next/link";
import { CheckCircle2, CheckSquare, Square, ArrowLeft } from "lucide-react";
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

  const { count: tasksDueToday } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .not("status", "in", '("done","cancelled")')
    .eq("due_date", todayDateStr);

  const { data: todayTasks } = await supabase
    .from("tasks")
    .select("id, title, due_date, customer_id, lead_id, customers(id, name), leads(id, name)")
    .not("status", "in", '("done","cancelled")')
    .eq("due_date", todayDateStr)
    .order("due_date", { ascending: true })
    .limit(5);

  const tasks = (todayTasks ?? []) as unknown as TaskRow[];
  const totalToday = tasksDueToday ?? 0;

  return (
    <div className="bg-cream-paper shadow-card rounded-2xl p-5">
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
            const parent = parentFromTask(task);
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
