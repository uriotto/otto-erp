import { getPortalCustomer } from "@/lib/portal";
import { FolderKanban, CheckCircle2, Circle, Calendar } from "lucide-react";

export const metadata = { title: "פרויקטים — פורטל לקוחות" };

const STATUS_LABELS: Record<string, string> = {
  planning: "בתכנון",
  active: "פעיל",
  completed: "הושלם",
  on_hold: "בהמתנה",
  cancelled: "מבוטל",
};

const STATUS_STYLES: Record<string, string> = {
  planning: "border-blue-200 bg-blue-50 text-blue-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-sky-200 bg-sky-50 text-sky-700",
  on_hold: "border-amber-200 bg-amber-50 text-amber-700",
  cancelled: "border-gray-200 bg-gray-100 text-gray-500",
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString("he-IL");
}

export default async function PortalProjectsPage() {
  const { supabase, customer } = await getPortalCustomer();

  const [{ data: projects }, { data: milestones }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, description, created_at, due_date, phase")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("milestones")
      .select("id, project_id, name, due_date, completed_at, order_index")
      .order("order_index", { ascending: true }),
  ]);

  const rows = projects ?? [];
  const allMilestones = milestones ?? [];
  const active = rows.filter((p) => p.status === "active");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md text-navy">פרויקטים</h1>
        <p className="text-ink-soft mt-1 text-sm">
          {active.length} פעילים · {rows.length} סך הכל
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-faded py-12 text-center text-sm">אין פרויקטים עדיין</p>
      ) : (
        <div className="space-y-4">
          {rows.map((p) => {
            const projectMilestones = allMilestones.filter((m) => m.project_id === p.id);
            const completedCount = projectMilestones.filter((m) => m.completed_at).length;
            const totalCount = projectMilestones.length;
            const pct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

            return (
              <div
                key={p.id}
                className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border"
              >
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="border-ink-line bg-cream mt-0.5 rounded-lg border p-1.5">
                        <FolderKanban size={15} className="text-navy" />
                      </div>
                      <div>
                        <div className="text-navy font-semibold">{p.name}</div>
                        {p.description && (
                          <p className="text-ink-soft mt-0.5 text-sm">{p.description}</p>
                        )}
                        {p.due_date && (
                          <div className="text-ink-faded mt-1 inline-flex items-center gap-1 text-xs">
                            <Calendar size={11} />
                            יעד: {formatDate(p.due_date)}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status ?? "active"] ?? STATUS_STYLES.active}`}
                    >
                      {STATUS_LABELS[p.status ?? "active"] ?? p.status}
                    </span>
                  </div>

                  {totalCount > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-ink-soft">התקדמות</span>
                        <span className="text-navy font-semibold">
                          {completedCount}/{totalCount} · {pct}%
                        </span>
                      </div>
                      <div className="bg-cream-deep h-1.5 overflow-hidden rounded-full">
                        <div
                          className="bg-navy h-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {totalCount > 0 && (
                  <div className="border-ink-line/60 border-t">
                    <ul className="divide-ink-line/40 divide-y px-5">
                      {projectMilestones.map((m) => {
                        const isDone = !!m.completed_at;
                        const due = m.due_date ? new Date(m.due_date) : null;
                        const isOverdue = !isDone && due && due.getTime() < Date.now();

                        return (
                          <li key={m.id} className="flex items-center gap-3 py-2.5">
                            {isDone ? (
                              <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
                            ) : (
                              <Circle size={15} className="text-ink-faded shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <span
                                className={`text-sm ${isDone ? "text-ink-faded line-through" : "text-navy"}`}
                              >
                                {m.name}
                              </span>
                            </div>
                            {due && (
                              <span
                                className={`shrink-0 text-xs ${isOverdue ? "text-rose-500" : "text-ink-faded"}`}
                              >
                                {formatDate(m.due_date)}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
