"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Clock,
  Trash2,
  Building2,
  FolderKanban,
  ListChecks,
  Check,
  Table2,
  CalendarDays,
  CalendarRange,
  Calendar,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import {
  assignCustomerToEntry,
  deleteTimeEntry,
  updateTimeEntry,
  bulkDeleteTimeEntries,
  bulkToggleBillable,
} from "./actions";
import { NewTimeEntryDialog } from "./new-time-entry-dialog";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";

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

type View = "daily" | "weekly" | "monthly" | "table";

const VIEWS: { value: View; label: string; icon: React.ReactNode }[] = [
  { value: "daily", label: "יומי", icon: <CalendarDays size={14} /> },
  { value: "weekly", label: "שבועי", icon: <CalendarRange size={14} /> },
  { value: "monthly", label: "חודשי", icon: <Calendar size={14} /> },
  { value: "table", label: "טבלה", icon: <Table2 size={14} /> },
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => (searchParams.get("view") as View) || "daily");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
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
      if (e.billable && (e.billing_status === "pending" || !e.billing_status)) unbilledMin += dur;
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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((e) => e.id)));
    }
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    if (!confirm(`למחוק ${ids.length} רשומות שעות?`)) return;
    startBulk(async () => {
      const res = await bulkDeleteTimeEntries(ids);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`נמחקו ${res.deleted} רשומות`);
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleBulkBillable(billable: boolean) {
    const ids = Array.from(selected);
    startBulk(async () => {
      const res = await bulkToggleBillable(ids, billable);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`עודכנו ${res.updated} רשומות`);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-md text-navy">שעות</h1>
          <p className="text-ink-soft mt-1 text-sm">{entries.length} רשומות ב-30 הימים האחרונים</p>
        </div>
        <div className="flex items-center gap-2">
          <TimeViewToggle
            view={view}
            onChange={(v) => {
              setView(v);
              updateUrl({ view: v });
            }}
          />
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            רשומה חדשה
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="שעות השבוע" minutes={summary.weekMin} />
        <SummaryCard label="שעות החודש" minutes={summary.monthMin} />
        <SummaryCard label="שעות לא מחויבות" minutes={summary.unbilledMin} accent />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
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

      {filtered.length === 0 ? (
        <EmptyState onNew={() => setShowNew(true)} />
      ) : view === "table" ? (
        <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-ink-line/60 border-b">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="cursor-pointer rounded"
                  />
                </th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">תאריך</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">לקוח</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">פרויקט</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">משימה</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">שעות</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">סוג</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody className="divide-ink-line/40 divide-y">
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className={`transition-colors ${selected.has(e.id) ? "bg-navy/5" : "hover:bg-cream/30"}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggleSelect(e.id)}
                      className="cursor-pointer rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-ink-soft text-xs">
                      {new Date(e.start_time).toLocaleDateString("he-IL")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {e.customer_name ? (
                      <span className="text-ink-soft inline-flex items-center gap-1 text-xs">
                        <Building2 size={11} />
                        {e.customer_name}
                      </span>
                    ) : (
                      <span className="text-ink-faded text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.project_name ? (
                      <span className="text-ink-soft inline-flex items-center gap-1 text-xs">
                        <FolderKanban size={11} />
                        {e.project_name}
                      </span>
                    ) : (
                      <span className="text-ink-faded text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-ink-soft text-xs">{e.task_name ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    <span className="text-navy text-xs font-medium">
                      {formatDurationMinutes(e.duration_minutes)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${e.billable ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-100 text-gray-500"}`}
                    >
                      {e.billable ? "לחיוב" : "לא לחיוב"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <BillingStatusBadge entry={e} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : grouped.length === 0 ? (
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
                    projects={projects}
                    tasks={tasks}
                    editing={editingId === e.id}
                    onToggleEdit={() => setEditingId((id) => (id === e.id ? null : e.id))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <BulkActionBar
        selectedCount={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: "סמן לחיוב",
            variant: "default",
            isPending: bulkPending,
            onClick: () => handleBulkBillable(true),
          },
          {
            label: "הסר חיוב",
            variant: "default",
            isPending: bulkPending,
            onClick: () => handleBulkBillable(false),
          },
          {
            label: "מחק",
            icon: Trash2,
            variant: "danger",
            isPending: bulkPending,
            onClick: handleBulkDelete,
          },
        ]}
      />

      {showNew && (
        <NewTimeEntryDialog
          customers={customers}
          projects={projects}
          tasks={tasks}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function TimeViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="border-ink-line bg-cream flex rounded-xl border p-0.5">
      {VIEWS.map(({ value, label, icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            view === value ? "bg-navy text-cream-paper shadow-sm" : "text-ink-soft hover:text-navy"
          }`}
          aria-pressed={view === value}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
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

// ── helper functions for time manipulation ──────────────────────────────────

function dateStr(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeStr(iso: string | null): string {
  if (!iso) return "09:00";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildIso(date: string, time: string): string {
  if (!date || !time) return "";
  return new Date(`${date}T${time}`).toISOString();
}

function diffMinutes(date: string, startT: string, endT: string): number {
  const s = new Date(`${date}T${startT}`).getTime();
  const e = new Date(`${date}T${endT}`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  return Math.ceil((e - s) / 60000);
}

function addMinutesToTime(time: string, min: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.max(0, Math.min(60 * 24 - 1, (h ?? 0) * 60 + (m ?? 0) + min));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ── EntryRow ─────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  customers,
  projects,
  tasks,
  editing,
  onToggleEdit,
}: {
  entry: TimeEntryItem;
  customers: CustomerOpt[];
  projects: ProjectOpt[];
  tasks: TaskOpt[];
  editing: boolean;
  onToggleEdit: () => void;
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

  if (editing) {
    return (
      <EditEntryRow
        entry={entry}
        customers={customers}
        projects={projects}
        tasks={tasks}
        onClose={onToggleEdit}
      />
    );
  }

  return (
    <div
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
        noCustomer
          ? "border-amber-300 bg-amber-50 hover:border-amber-400"
          : "bg-cream-paper border-ink-line hover:border-navy/30"
      }`}
      onClick={onToggleEdit}
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
          <BillingStatusBadge entry={entry} />
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
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}

// ── EditEntryRow ──────────────────────────────────────────────────────────────

function EditEntryRow({
  entry,
  customers,
  projects,
  tasks,
  onClose,
}: {
  entry: TimeEntryItem;
  customers: CustomerOpt[];
  projects: ProjectOpt[];
  tasks: TaskOpt[];
  onClose: () => void;
}) {
  const [date, setDate] = useState(dateStr(entry.start_time));
  const [startT, setStartT] = useState(timeStr(entry.start_time));
  const [endT, setEndT] = useState(timeStr(entry.end_time));
  const [duration, setDuration] = useState<number>(entry.duration_minutes ?? 60);
  const [customerId, setCustomerId] = useState(entry.customer_id ?? "");
  const [projectId, setProjectId] = useState(entry.project_id ?? "");
  const [taskId, setTaskId] = useState(entry.task_id ?? "");
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [billable, setBillable] = useState<boolean>(entry.billable);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const editing = useRef<"start" | "end" | "duration" | null>(null);

  useEffect(() => {
    if (editing.current !== "start") return;
    setEndT(addMinutesToTime(startT, duration));
    editing.current = null;
  }, [startT, duration]);

  useEffect(() => {
    if (editing.current !== "end") return;
    const d = diffMinutes(date, startT, endT);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d > 0) setDuration(d);
    editing.current = null;
  }, [endT, date, startT]);

  useEffect(() => {
    if (editing.current !== "duration") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (duration > 0) setEndT(addMinutesToTime(startT, duration));
    editing.current = null;
  }, [duration, startT]);

  const filteredProjects = useMemo(
    () => (customerId ? projects.filter((p) => p.customer_id === customerId) : projects),
    [projects, customerId],
  );
  const filteredTasks = useMemo(
    () => (projectId ? tasks.filter((t) => t.project_id === projectId) : []),
    [tasks, projectId],
  );

  const startISO = buildIso(date, startT);
  const endISO = buildIso(date, endT);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("id", entry.id);
    fd.set("start_time", startISO);
    fd.set("end_time", endISO);
    fd.set("customer_id", customerId);
    fd.set("project_id", projectId);
    fd.set("task_id", taskId);
    fd.set("notes", notes);
    if (billable) fd.set("billable", "on");
    startTransition(async () => {
      const res = await updateTimeEntry({}, fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("הרשומה עודכנה");
      onClose();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm("למחוק את הרשומה?")) return;
    startDelete(async () => {
      const res = await deleteTimeEntry(entry.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("נמחק");
      onClose();
      router.refresh();
    });
  }

  const inputCls =
    "border-ink-line focus:border-navy w-full rounded-lg border bg-white px-2 py-1.5 text-sm outline-none";

  return (
    <div className="border-navy/30 space-y-3 rounded-xl border bg-white p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="hidden" name="start_time" value={startISO} />
        <input type="hidden" name="end_time" value={endISO} />

        <div>
          <label className="text-ink-soft mb-1 block text-xs uppercase">תאריך</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-ink-soft mb-1 block text-xs uppercase">התחלה</label>
            <input
              type="time"
              value={startT}
              onChange={(e) => {
                editing.current = "start";
                setStartT(e.target.value);
              }}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-ink-soft mb-1 block text-xs uppercase">סיום</label>
            <input
              type="time"
              value={endT}
              onChange={(e) => {
                editing.current = "end";
                setEndT(e.target.value);
              }}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-ink-soft mb-1 block text-xs uppercase">משך (דקות)</label>
            <input
              type="number"
              min={1}
              step={1}
              value={duration || ""}
              onChange={(e) => {
                editing.current = "duration";
                setDuration(parseInt(e.target.value || "0", 10));
              }}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="text-ink-soft mb-1 block text-xs uppercase">לקוח</label>
          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setProjectId("");
              setTaskId("");
            }}
            className={inputCls}
          >
            <option value="">— ללא —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-ink-soft mb-1 block text-xs uppercase">פרויקט</label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setTaskId("");
              }}
              disabled={!customerId}
              className={`${inputCls} disabled:opacity-50`}
            >
              <option value="">— ללא —</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-ink-soft mb-1 block text-xs uppercase">משימה</label>
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              disabled={!projectId}
              className={`${inputCls} disabled:opacity-50`}
            >
              <option value="">— ללא —</option>
              {filteredTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-ink-soft mb-1 block text-xs uppercase">הערות</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputCls} resize-none`}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={billable}
            onChange={(e) => setBillable(e.target.checked)}
          />
          לחיוב
        </label>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700"
          >
            <Trash2 size={12} />
            מחק
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-ink-soft hover:text-navy rounded-lg px-3 py-1.5 text-xs"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-navy text-cream-paper flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              <Check size={12} />
              שמור
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function BillingStatusBadge({ entry }: { entry: TimeEntryItem }) {
  if (!entry.billable) return null;

  const status = entry.billing_status;

  if (status === "allocated_to_bank") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
        בנק
      </span>
    );
  }
  if (status === "overage") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-700">
        עודף
      </span>
    );
  }
  if (status === "invoiced") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
        חויב
      </span>
    );
  }
  // pending / null — billable but not yet allocated
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-500">
      ממתין
    </span>
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
