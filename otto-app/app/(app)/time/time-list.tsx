"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Clock, Trash2, Building2, FolderKanban, ListChecks, Edit2 } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { assignCustomerToEntry, deleteTimeEntry } from "./actions";
import { NewTimeEntryDialog } from "./new-time-entry-dialog";
import { EditTimeEntryDialog } from "./edit-time-entry-dialog";

export type TimeEntryItem = Pick<
  Tables<"time_entries">,
  | "id"
  | "customer_id"
  | "project_id"
  | "task_id"
  | "start_time"
  | "end_time"
  | "duration_minutes"
  | "billable"
  | "billing_status"
  | "notes"
> & {
  customer_name: string | null;
  project_name: string | null;
  task_name: string | null;
};

export type CustomerOpt = Pick<Tables<"customers">, "id" | "name">;
export type ProjectOpt = Pick<Tables<"projects">, "id" | "name" | "customer_id">;
export type TaskOpt = Pick<Tables<"tasks">, "id" | "title" | "project_id">;

type View = "daily" | "weekly" | "monthly";

const VIEWS: { value: View; label: string }[] = [
  { value: "daily", label: "יומי" },
  { value: "weekly", label: "שבועי" },
  { value: "monthly", label: "חודשי" },
];

function formatDurationMinutes(min: number | null | undefined): string {
  if (!min || min <= 0) return "0:00";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatTimeRange(start: string, end: string | null): string {
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const s = new Date(start);
  if (!end) return fmt(s);
  return `${fmt(s)} - ${fmt(new Date(end))}`;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun
  x.setDate(x.getDate() - day);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TimeList({
  entries,
  customers,
  projects,
  tasks,
}: {
  entries: TimeEntryItem[];
  customers: CustomerOpt[];
  projects: ProjectOpt[];
  tasks: TaskOpt[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [showNew, setShowNew] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntryItem | null>(null);
  const [view, setView] = useState<View>(() => (searchParams.get("view") as View) || "daily");
  const [customerFilter, setCustomerFilter] = useState<string>(
    () => searchParams.get("customer") ?? "all",
  );
  const [projectFilter, setProjectFilter] = useState<string>(
    () => searchParams.get("project") ?? "all",
  );
  const [billableFilter, setBillableFilter] = useState<string>(
    () => searchParams.get("billable") ?? "all",
  );

  const updateUrl = useCallback(
    (params: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(params)) {
        if (v && v.length > 0 && v !== "all") sp.set(k, v);
        else sp.delete(k);
      }
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (customerFilter !== "all" && e.customer_id !== customerFilter) return false;
      if (projectFilter !== "all" && e.project_id !== projectFilter) return false;
      if (billableFilter === "yes" && !e.billable) return false;
      if (billableFilter === "no" && e.billable) return false;
      return true;
    });
  }, [entries, customerFilter, projectFilter, billableFilter]);

  const summary = useMemo(() => {
    const now = new Date();
    const wkStart = startOfWeek(now).getTime();
    const moStart = startOfMonth(now).getTime();
    let weekMin = 0;
    let monthMin = 0;
    let unbilledMin = 0;
    for (const e of entries) {
      const t = new Date(e.start_time).getTime();
      const dur = e.duration_minutes ?? 0;
      if (t >= wkStart) weekMin += dur;
      if (t >= moStart) monthMin += dur;
      if (e.billable && (e.billing_status === "unbilled" || !e.billing_status)) unbilledMin += dur;
    }
    return { weekMin, monthMin, unbilledMin };
  }, [entries]);

  const grouped = useMemo(() => {
    const groups = new Map<string, { date: Date; total: number; items: TimeEntryItem[] }>();
    for (const e of filtered) {
      const d = new Date(e.start_time);
      let bucketDate: Date;
      if (view === "daily") {
        bucketDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      } else if (view === "weekly") {
        bucketDate = startOfWeek(d);
      } else {
        bucketDate = startOfMonth(d);
      }
      const key = dateKey(bucketDate);
      const g = groups.get(key) ?? { date: bucketDate, total: 0, items: [] };
      g.total += e.duration_minutes ?? 0;
      g.items.push(e);
      groups.set(key, g);
    }
    return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filtered, view]);

  const handleDelete = async (id: string) => {
    if (!confirm("למחוק את הרשומה?")) return;
    const res = await deleteTimeEntry(id);
    if (res.error) toast.error(res.error);
    else toast.success("נמחק");
  };

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-md text-navy">שעות</h1>
          <p className="text-ink-soft mt-1 text-sm">{entries.length} רשומות ב-30 הימים האחרונים</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
        >
          <Plus size={16} />
          רשומה חדשה
        </button>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="שעות השבוע" minutes={summary.weekMin} />
        <SummaryCard label="שעות החודש" minutes={summary.monthMin} />
        <SummaryCard label="שעות לא מחויבות" minutes={summary.unbilledMin} accent />
      </div>

      {/* View tabs + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="bg-cream-paper border-ink-line inline-flex rounded-lg border p-1">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => {
                setView(v.value);
                updateUrl({ view: v.value });
              }}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                view === v.value ? "bg-navy text-cream-paper" : "text-ink-soft hover:text-navy"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <select
          value={customerFilter}
          onChange={(e) => {
            setCustomerFilter(e.target.value);
            updateUrl({ customer: e.target.value });
          }}
          className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="all">כל הלקוחות</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => {
            setProjectFilter(e.target.value);
            updateUrl({ project: e.target.value });
          }}
          className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="all">כל הפרויקטים</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={billableFilter}
          onChange={(e) => {
            setBillableFilter(e.target.value);
            updateUrl({ billable: e.target.value });
          }}
          className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="all">כל הסוגים</option>
          <option value="yes">לחיוב</option>
          <option value="no">לא לחיוב</option>
        </select>
      </div>

      {grouped.length === 0 ? (
        <EmptyState onNew={() => setShowNew(true)} />
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={dateKey(g.date)} className="space-y-2">
              <div className="border-ink-line text-ink-soft flex items-center justify-between border-b pb-1.5 text-sm">
                <span className="text-navy font-semibold">{formatGroupHeader(g.date, view)}</span>
                <span dir="ltr" className="font-mono">
                  {formatDurationMinutes(g.total)}
                </span>
              </div>
              <div className="space-y-1.5">
                {g.items.map((e) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    customers={customers}
                    onDelete={handleDelete}
                    onEdit={() => setEditEntry(e)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewTimeEntryDialog
          customers={customers}
          projects={projects}
          tasks={tasks}
          onClose={() => setShowNew(false)}
        />
      )}

      {editEntry && (
        <EditTimeEntryDialog
          entry={editEntry}
          customers={customers}
          projects={projects}
          tasks={tasks}
          onClose={() => setEditEntry(null)}
        />
      )}
    </div>
  );
}

function formatGroupHeader(d: Date, view: View): string {
  if (view === "daily")
    return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  if (view === "weekly") {
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return `שבוע ${d.toLocaleDateString("he-IL")} - ${end.toLocaleDateString("he-IL")}`;
  }
  return d.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

function SummaryCard({
  label,
  minutes,
  accent,
}: {
  label: string;
  minutes: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? "border-amber-200 bg-amber-50" : "bg-cream-paper border-ink-line"
      }`}
    >
      <div className="text-ink-soft text-xs font-medium uppercase">{label}</div>
      <div className="text-navy mt-1 font-mono text-2xl font-semibold" dir="ltr">
        {formatDurationMinutes(minutes)}
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  customers,
  onDelete,
  onEdit,
}: {
  entry: TimeEntryItem;
  customers: CustomerOpt[];
  onDelete: (id: string) => void;
  onEdit: () => void;
}) {
  const [assigning, setAssigning] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const noCustomer = !entry.customer_id;

  const handleAssign = (customerId: string) => {
    if (!customerId) return;
    startTransition(async () => {
      const res = await assignCustomerToEntry({
        entry_id: entry.id,
        customer_id: customerId,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("שויך ללקוח");
      setAssigning(false);
      router.refresh();
    });
  };

  return (
    <div
      className={`group flex items-start gap-3 rounded-xl border p-3 transition-colors ${
        noCustomer
          ? "border-amber-300 bg-amber-50 hover:border-amber-400"
          : "bg-cream-paper border-ink-line hover:border-ink-soft"
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          noCustomer ? "bg-amber-200 text-amber-800" : "bg-cream-deep text-navy"
        }`}
      >
        <Clock size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span dir="ltr" className="text-navy font-mono text-sm font-semibold">
            {formatTimeRange(entry.start_time, entry.end_time)}
          </span>
          <span dir="ltr" className="text-ink-soft font-mono text-xs">
            {formatDurationMinutes(entry.duration_minutes)}
          </span>
          {!entry.billable && (
            <span className="text-ink-faded border-ink-line bg-cream rounded-md border px-1.5 py-0.5 text-xs">
              לא לחיוב
            </span>
          )}
          {noCustomer && (
            <span className="rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
              חסר לקוח
            </span>
          )}
        </div>
        <div className="text-ink-soft mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          {entry.customer_name && (
            <span className="inline-flex items-center gap-1">
              <Building2 size={11} />
              {entry.customer_name}
            </span>
          )}
          {entry.project_name && (
            <span className="inline-flex items-center gap-1">
              <FolderKanban size={11} />
              {entry.project_name}
            </span>
          )}
          {entry.task_name && (
            <span className="inline-flex items-center gap-1">
              <ListChecks size={11} />
              {entry.task_name}
            </span>
          )}
        </div>
        {entry.notes && <div className="text-ink-soft mt-1 text-xs">{entry.notes}</div>}

        {noCustomer && (
          <div className="mt-2">
            {assigning ? (
              <div className="flex items-center gap-2">
                <select
                  autoFocus
                  defaultValue=""
                  onChange={(e) => handleAssign(e.target.value)}
                  disabled={pending}
                  className="border-ink-line focus:border-navy rounded-md border bg-white px-2 py-1 text-xs outline-none"
                >
                  <option value="">— בחר לקוח —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setAssigning(false)}
                  disabled={pending}
                  className="text-ink-faded hover:text-navy text-xs"
                >
                  ביטול
                </button>
                {pending && <Spinner size={12} />}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAssigning(true)}
                className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200"
              >
                + שייך ללקוח
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="text-ink-faded hover:text-navy"
          aria-label="ערוך רשומה"
        >
          <Edit2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          className="text-ink-faded hover:text-rose-600"
          aria-label="מחק רשומה"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-cream-deep mb-4 flex h-20 w-20 items-center justify-center rounded-full">
        <Clock size={48} className="text-navy/60" />
      </div>
      <h2 className="text-display-sm text-navy mb-2">אין שעות עדיין</h2>
      <p className="text-ink-soft mb-6 max-w-md text-sm">התחל טיימר מהכותרת או הוסף רשומה ידנית</p>
      <button
        type="button"
        onClick={onNew}
        className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
      >
        <Plus size={16} />
        רשומה חדשה
      </button>
    </div>
  );
}
