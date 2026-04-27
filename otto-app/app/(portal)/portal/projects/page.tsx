import { createClient } from "@/lib/supabase/server";
import { FolderKanban } from "lucide-react";

export const metadata = { title: "פרויקטים — פורטל לקוחות" };

const STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  completed: "הושלם",
  on_hold: "בהמתנה",
  cancelled: "מבוטל",
};

const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-sky-200 bg-sky-50 text-sky-700",
  on_hold: "border-amber-200 bg-amber-50 text-amber-700",
  cancelled: "border-gray-200 bg-gray-100 text-gray-500",
};

export default async function PortalProjectsPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, description, created_at, billing_model")
    .order("created_at", { ascending: false });

  const rows = projects ?? [];
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
        <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
          <ul className="divide-ink-line/60 divide-y">
            {rows.map((p) => (
              <li key={p.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="border-ink-line bg-cream mt-0.5 rounded-lg border p-1.5">
                      <FolderKanban size={14} className="text-navy" />
                    </div>
                    <div>
                      <div className="text-navy font-medium">{p.name}</div>
                      {p.description && (
                        <p className="text-ink-soft mt-0.5 text-sm">{p.description}</p>
                      )}
                      <div className="text-ink-faded mt-1 text-xs">
                        {new Date(p.created_at).toLocaleDateString("he-IL")}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status ?? "active"] ?? STATUS_STYLES.active}`}
                  >
                    {STATUS_LABELS[p.status ?? "active"] ?? p.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
