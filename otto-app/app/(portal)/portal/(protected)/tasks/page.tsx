import { getPortalCustomer } from "@/lib/portal";
import { CheckCircle2, Circle, Clock, AlertCircle, Calendar } from "lucide-react";

export const metadata = { title: "משימות — פורטל לקוחות" };

const STATUS_LABELS: Record<string, string> = {
  todo: "לביצוע",
  in_progress: "בביצוע",
  review: "לבדיקה",
  done: "הושלם",
  cancelled: "בוטל",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "נמוכה",
  medium: "רגילה",
  high: "גבוהה",
  urgent: "דחוף",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-gray-50 text-gray-600 border-gray-200",
  medium: "bg-sky-50 text-sky-700 border-sky-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  urgent: "bg-rose-50 text-rose-700 border-rose-200",
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString("he-IL");
}

type FilterValue = "open" | "completed" | "all";

export default async function PortalTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { supabase, customer } = await getPortalCustomer();
  const params = await searchParams;
  const filter = (params.filter ?? "open") as FilterValue;

  // מציאת כל הפרויקטים של הלקוח
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("customer_id", customer.id);

  const projectIds = (projects ?? []).map((p) => p.id);
  const projectMap = Object.fromEntries((projects ?? []).map((p) => [p.id, p.name]));

  if (projectIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-display-md text-navy">משימות</h1>
        </div>
        <p className="text-ink-faded py-12 text-center text-sm">אין פרויקטים פעילים עדיין</p>
      </div>
    );
  }

  // שליפת משימות לפי project_id של הלקוח, ללא portal_hidden
  let query = supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_date, due_at, project_id, completed_at")
    .in("project_id", projectIds)
    .eq("portal_hidden", false)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filter === "open") {
    query = query.not("status", "in", '("done","cancelled")');
  } else if (filter === "completed") {
    query = query.eq("status", "done");
  }

  const { data: tasks } = await query;
  const rows = tasks ?? [];

  const openCount = rows.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const doneCount = rows.filter((t) => t.status === "done").length;

  const FILTERS: { value: FilterValue; label: string }[] = [
    { value: "open", label: "פתוחות" },
    { value: "completed", label: "הושלמו" },
    { value: "all", label: "הכל" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md text-navy">משימות</h1>
        <p className="text-ink-soft mt-1 text-sm">
          {openCount} פתוחות · {doneCount} הושלמו
        </p>
      </div>

      {/* פילטרים */}
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <a
            key={f.value}
            href={`/portal/tasks?filter=${f.value}`}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-navy text-cream border-navy"
                : "border-ink-line text-ink-soft hover:text-navy hover:border-navy"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-faded py-12 text-center text-sm">
          {filter === "open" ? "אין משימות פתוחות" : "אין משימות להצגה"}
        </p>
      ) : (
        <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
          <ul className="divide-ink-line/60 divide-y">
            {rows.map((task) => {
              const isDone = task.status === "done";
              const isCancelled = task.status === "cancelled";
              const dueDate = task.due_date ?? (task.due_at ? task.due_at.slice(0, 10) : null);
              const due = dueDate ? new Date(dueDate + "T00:00:00") : null;
              const isOverdue = !isDone && !isCancelled && due && due.getTime() < Date.now();
              const projectName = task.project_id ? (projectMap[task.project_id] ?? null) : null;

              return (
                <li key={task.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : isCancelled ? (
                      <AlertCircle size={16} className="text-ink-faded" />
                    ) : task.status === "in_progress" ? (
                      <Clock size={16} className="text-sky-500" />
                    ) : (
                      <Circle size={16} className="text-ink-faded" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${isDone || isCancelled ? "text-ink-faded line-through" : "text-navy"}`}
                    >
                      {task.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {projectName && <span className="text-ink-faded text-xs">{projectName}</span>}
                      {due && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${isOverdue ? "font-medium text-rose-500" : "text-ink-faded"}`}
                        >
                          <Calendar size={10} />
                          {formatDate(dueDate)}
                          {isOverdue && " · באיחור"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-ink-faded text-xs">
                      {STATUS_LABELS[task.status ?? "todo"] ?? task.status}
                    </span>
                    {task.priority && task.priority !== "medium" && (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority] ?? ""}`}
                      >
                        {PRIORITY_LABELS[task.priority] ?? task.priority}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
