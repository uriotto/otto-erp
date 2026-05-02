import { getPortalCustomer } from "@/lib/portal";
import { Clock } from "lucide-react";

export const metadata = { title: "דוח שעות — פורטל לקוחות" };

type MonthGroup = {
  label: string;
  yearMonth: string;
  entries: EntryRow[];
  totalMinutes: number;
};

type EntryRow = {
  id: string;
  start_time: string;
  duration_minutes: number;
  notes: string | null;
  project_id: string | null;
  project_name: string | null;
  billable: boolean;
};

function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}:00`;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
  });
}

function getYearMonth(iso: string) {
  return iso.slice(0, 7); // "YYYY-MM"
}

function monthLabel(ym: string) {
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

export default async function PortalTimesheetPage() {
  const { supabase, customer } = await getPortalCustomer();

  // שליפת פרויקטים של הלקוח
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
          <h1 className="text-display-md text-navy">דוח שעות</h1>
        </div>
        <p className="text-ink-faded py-12 text-center text-sm">אין נתונים להצגה</p>
      </div>
    );
  }

  // שליפת רשומות זמן מחויבות בלבד
  const { data: entries } = await supabase
    .from("time_entries")
    .select("id, start_time, duration_minutes, notes, project_id, billable")
    .eq("customer_id", customer.id)
    .eq("billable", true)
    .order("start_time", { ascending: false })
    .limit(500);

  const rows: EntryRow[] = (entries ?? []).map((e) => ({
    id: e.id,
    start_time: e.start_time,
    duration_minutes: e.duration_minutes,
    notes: e.notes,
    project_id: e.project_id,
    project_name: e.project_id ? (projectMap[e.project_id] ?? null) : null,
    billable: e.billable,
  }));

  // Group by month
  const monthMap = new Map<string, EntryRow[]>();
  for (const row of rows) {
    const ym = getYearMonth(row.start_time);
    if (!monthMap.has(ym)) monthMap.set(ym, []);
    monthMap.get(ym)!.push(row);
  }

  const months: MonthGroup[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([ym, monthRows]) => ({
      label: monthLabel(ym),
      yearMonth: ym,
      entries: monthRows,
      totalMinutes: monthRows.reduce((s, r) => s + r.duration_minutes, 0),
    }));

  const grandTotalMinutes = rows.reduce((s, r) => s + r.duration_minutes, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md text-navy">דוח שעות</h1>
        <p className="text-ink-soft mt-1 text-sm">שעות מחויבות לפי חודש ופרויקט</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-faded py-12 text-center text-sm">אין שעות מחויבות עדיין</p>
      ) : (
        <>
          {/* כרטיס סיכום */}
          <div className="bg-cream-paper border-ink-line flex items-center gap-4 rounded-2xl border px-5 py-4">
            <div className="bg-cream-deep border-ink-line rounded-xl border p-2.5">
              <Clock size={20} className="text-navy" />
            </div>
            <div>
              <p className="text-ink-soft text-xs">סה״כ שעות מחויבות</p>
              <p className="text-navy font-mono text-2xl font-bold" dir="ltr">
                {minutesToHours(grandTotalMinutes)}
              </p>
            </div>
          </div>

          {/* טבלאות לפי חודש */}
          {months.map((month) => (
            <section key={month.yearMonth}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-navy font-semibold">{month.label}</h2>
                <span className="text-ink-soft font-mono text-sm" dir="ltr">
                  {minutesToHours(month.totalMinutes)} שעות
                </span>
              </div>

              <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-ink-line/60 border-b">
                      <th className="text-ink-faded px-4 py-2.5 text-start text-xs font-medium">
                        תאריך
                      </th>
                      <th className="text-ink-faded px-4 py-2.5 text-start text-xs font-medium">
                        פרויקט
                      </th>
                      <th className="text-ink-faded px-4 py-2.5 text-start text-xs font-medium">
                        תיאור
                      </th>
                      <th className="text-ink-faded px-4 py-2.5 text-end text-xs font-medium">
                        שעות
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-ink-line/40 divide-y">
                    {month.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-cream-deep/40">
                        <td className="text-ink-soft px-4 py-2.5 text-xs" dir="ltr">
                          {formatDate(entry.start_time)}
                        </td>
                        <td className="text-navy px-4 py-2.5 text-xs">
                          {entry.project_name ?? "—"}
                        </td>
                        <td className="text-ink-soft max-w-[200px] truncate px-4 py-2.5 text-xs">
                          {entry.notes ?? "—"}
                        </td>
                        <td className="text-navy px-4 py-2.5 text-end font-mono text-xs" dir="ltr">
                          {minutesToHours(entry.duration_minutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-ink-line/60 border-t">
                      <td
                        colSpan={3}
                        className="text-ink-soft px-4 py-2.5 text-xs font-medium"
                      >
                        סה״כ חודשי
                      </td>
                      <td
                        className="text-navy px-4 py-2.5 text-end font-mono text-sm font-bold"
                        dir="ltr"
                      >
                        {minutesToHours(month.totalMinutes)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
