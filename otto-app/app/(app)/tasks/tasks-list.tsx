"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  CheckSquare,
  Square,
  Search,
  SearchX,
  Calendar,
  CalendarDays,
  FolderKanban,
  KanbanSquare,
  List,
  Star,
  AlertTriangle,
  Trash2,
  Check,
  Table2,
} from "lucide-react";
import { CalendarView, toDateKey } from "./calendar-view";
import type { Tables } from "@/lib/supabase/types";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { NewTaskDialog } from "./new-task-dialog";
import {
  deleteTask,
  quickCreateTask,
  toggleTaskComplete,
  updateTask,
  updateTaskStatus,
  bulkDeleteTasks,
  bulkUpdateTaskStatus,
} from "./actions";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";

const STATUS_LABELS: Record<string, string> = {
  todo: "לעשות",
  in_progress: "בעבודה",
  review: "ביקורת",
  done: "הושלם",
  cancelled: "בוטל",
};

const STATUS_ORDER = ["todo", "in_progress", "review", "done", "cancelled"] as const;

const STATUS_STYLES: Record<string, string> = {
  todo: "border-gray-200 bg-gray-50 text-gray-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  review: "border-purple-200 bg-purple-50 text-purple-700",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "נמוכה",
  medium: "בינונית",
  high: "גבוהה",
  urgent: "דחוף",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "border-gray-200 bg-gray-50 text-gray-600",
  medium: "border-blue-200 bg-blue-50 text-blue-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  urgent: "border-rose-200 bg-rose-50 text-rose-700",
};

export type TaskListItem = Pick<
  Tables<"tasks">,
  | "id"
  | "title"
  | "description"
  | "status"
  | "priority"
  | "due_date"
  | "completed_at"
  | "project_id"
  | "customer_id"
  | "lead_id"
  | "assigned_to"
  | "tags"
  | "order_index"
  | "created_at"
> & {
  project_name: string | null;
  customer_name: string | null;
  lead_name: string | null;
  assignee_name: string | null;
};

export type ProjectOption = { id: string; name: string };
export type UserOption = { id: string; name: string };
export type CustomerOption = { id: string; name: string };
export type LeadOption = { id: string; name: string };

const SEARCH_DEBOUNCE_MS = 200;

type ViewMode = "list" | "kanban" | "calendar" | "today" | "table";

export function TasksList({
  tasks,
  projects,
  users,
  customers,
  leads,
}: {
  tasks: TaskListItem[];
  projects: ProjectOption[];
  users: UserOption[];
  customers: CustomerOption[];
  leads: LeadOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [projectFilter, setProjectFilter] = useState<string>(
    () => searchParams.get("project") ?? "all",
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    () => searchParams.get("status") ?? "all",
  );
  const [priorityFilter, setPriorityFilter] = useState<string>(
    () => searchParams.get("priority") ?? "all",
  );
  const [assigneeFilter, setAssigneeFilter] = useState<string>(
    () => searchParams.get("assignee") ?? "all",
  );
  const [view, setView] = useState<ViewMode>(() => {
    const v = searchParams.get("view");
    const modes = ["kanban", "calendar", "today", "table"] as const;
    return modes.includes(v as (typeof modes)[number]) ? (v as ViewMode) : "list";
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();

  const updateUrl = useCallback(
    (params: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(params)) {
        if (v && v.length > 0 && v !== "all" && v !== "list") sp.set(k, v);
        else sp.delete(k);
      }
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      updateUrl({ q: query.trim() || undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (projectFilter !== "all" && t.project_id !== projectFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false;
      if (!q) return true;
      const haystack = [t.title, t.description, t.project_name, t.assignee_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tasks, query, projectFilter, statusFilter, priorityFilter, assigneeFilter]);

  const clearAll = () => {
    setQuery("");
    setProjectFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    updateUrl({
      q: undefined,
      project: undefined,
      status: undefined,
      priority: undefined,
      assignee: undefined,
    });
  };

  const setViewMode = (v: ViewMode) => {
    setView(v);
    updateUrl({ view: v !== "list" ? v : undefined });
  };

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
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    if (!confirm(`למחוק ${ids.length} משימות?`)) return;
    startBulk(async () => {
      const res = await bulkDeleteTasks(ids);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`נמחקו ${res.deleted} משימות`);
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleBulkStatus(status: string) {
    const ids = Array.from(selected);
    startBulk(async () => {
      const res = await bulkUpdateTaskStatus(ids, status);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`עודכנו ${res.updated} משימות`);
      setSelected(new Set());
      router.refresh();
    });
  }

  const handleQuickCapture = async (title: string, dueDate: string | null) => {
    const res = await quickCreateTask({
      title,
      project_id: projectFilter !== "all" ? projectFilter : null,
      assigned_to: assigneeFilter !== "all" ? assigneeFilter : null,
      priority:
        priorityFilter !== "all"
          ? (priorityFilter as "low" | "medium" | "high" | "urgent")
          : undefined,
      due_date: dueDate,
    });
    if (res.error) {
      toast.error(res.error);
      return false;
    }
    toast.success("משימה נוצרה");
    router.refresh();
    return true;
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-md text-navy">משימות</h1>
          <p className="text-ink-soft mt-1 text-sm">{tasks.length} משימות סך הכל</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setViewMode} />
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            משימה חדשה
          </button>
        </div>
      </div>

      <QuickCapture onSubmit={handleQuickCapture} />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search
            size={16}
            className="text-ink-faded pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפש משימה..."
            className="border-ink-line focus:border-navy w-full rounded-lg border bg-white py-2 ps-10 pe-3 text-sm outline-none"
          />
        </div>
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
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            updateUrl({ status: e.target.value });
          }}
          className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="all">כל הסטטוסים</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            updateUrl({ priority: e.target.value });
          }}
          className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="all">כל העדיפויות</option>
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => {
            setAssigneeFilter(e.target.value);
            updateUrl({ assignee: e.target.value });
          }}
          className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="all">כל המשובצים</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {tasks.length === 0 ? (
        <EmptyState onNew={() => setShowNew(true)} />
      ) : filtered.length === 0 ? (
        <NoResults query={query} onClear={clearAll} />
      ) : view === "kanban" ? (
        <KanbanView tasks={filtered} />
      ) : view === "calendar" ? (
        <CalendarView tasks={filtered} />
      ) : view === "today" ? (
        <TodayView tasks={filtered} />
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
                <th className="text-ink-soft px-4 py-3 text-start font-medium">כותרת</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">פרויקט</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">סטטוס</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">עדיפות</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">תאריך יעד</th>
              </tr>
            </thead>
            <tbody className="divide-ink-line/40 divide-y">
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className={`transition-colors ${selected.has(t.id) ? "bg-navy/5" : "hover:bg-cream/30"}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      className="cursor-pointer rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-navy font-medium ${t.completed_at ? "line-through opacity-50" : ""}`}
                    >
                      {t.title}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.project_name ? (
                      <span className="text-ink-soft inline-flex items-center gap-1 text-xs">
                        <FolderKanban size={11} />
                        {t.project_name}
                      </span>
                    ) : (
                      <span className="text-ink-faded text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status ?? "todo"] ?? ""}`}
                    >
                      {STATUS_LABELS[t.status ?? "todo"] ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.priority ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[t.priority] ?? ""}`}
                      >
                        {PRIORITY_LABELS[t.priority] ?? t.priority}
                      </span>
                    ) : (
                      <span className="text-ink-faded text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-ink-soft text-xs">
                      {t.due_date ? new Date(t.due_date).toLocaleDateString("he-IL") : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ListView tasks={filtered} />
      )}

      <BulkActionBar
        selectedCount={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: "סמן כהושלם",
            variant: "default",
            isPending: bulkPending,
            onClick: () => handleBulkStatus("done"),
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
        <NewTaskDialog
          projects={projects}
          users={users}
          customers={customers}
          leads={leads}
          defaultProjectId={projectFilter !== "all" ? projectFilter : undefined}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

const VIEW_TABS: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
  { mode: "today", icon: <Star size={14} />, label: "היום" },
  { mode: "list", icon: <List size={14} />, label: "רשימה" },
  { mode: "kanban", icon: <KanbanSquare size={14} />, label: "קנבן" },
  { mode: "calendar", icon: <CalendarDays size={14} />, label: "יומן" },
  { mode: "table", icon: <Table2 size={14} />, label: "טבלה" },
];

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="border-ink-line bg-cream-paper inline-flex items-center rounded-lg border p-0.5">
      {VIEW_TABS.map(({ mode, icon, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === mode ? "bg-navy text-cream-paper" : "text-ink-soft hover:text-navy"
          }`}
          aria-pressed={view === mode}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}

type DueOption = "today" | "tomorrow" | "this_week" | "none";

const QC_DUE_LABELS: Record<DueOption, string> = {
  today: "היום",
  tomorrow: "מחר",
  this_week: "השבוע",
  none: "ללא תאריך",
};

function qcDateFor(option: DueOption): string | null {
  if (option === "none") return null;
  const d = new Date();
  if (option === "tomorrow") d.setDate(d.getDate() + 1);
  if (option === "this_week") {
    const dow = d.getDay();
    const offset = (5 - dow + 7) % 7;
    d.setDate(d.getDate() + offset);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function QuickCapture({
  onSubmit,
}: {
  onSubmit: (title: string, dueDate: string | null) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const [due, setDue] = useState<DueOption>("none");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim().length > 0 && !isPending) {
      const title = value.trim();
      const dueDate = qcDateFor(due);
      startTransition(async () => {
        const ok = await onSubmit(title, dueDate);
        if (ok) setValue("");
        inputRef.current?.focus();
      });
    }
  };

  return (
    <div className="bg-cream-paper border-ink-line mb-4 rounded-2xl border p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-navy text-cream-paper flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <Plus size={18} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="הוסף משימה במהירות... (Enter לשמירה)"
          className="placeholder:text-ink-faded flex-1 bg-transparent text-sm outline-none"
          disabled={isPending}
        />
        {isPending && <Spinner size={14} className="text-navy" />}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 ps-12">
        {(Object.keys(QC_DUE_LABELS) as DueOption[]).map((opt) => {
          const isActive = due === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setDue(opt)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                isActive
                  ? "border-navy bg-navy text-cream-paper"
                  : "border-ink-line text-ink-soft hover:border-navy bg-white"
              }`}
            >
              {QC_DUE_LABELS[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ tasks }: { tasks: TaskListItem[] }) {
  return (
    <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
      <ul className="divide-ink-line divide-y">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </ul>
    </div>
  );
}

function EditableTaskRow({ task, onDone }: { task: TaskListItem; onDone: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.due_date?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<string>(task.status);
  const [priority, setPriority] = useState<string>(task.priority);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set("title", title.trim());
    fd.set("description", description);
    fd.set("due_date", dueDate);
    fd.set("status", status);
    fd.set("priority", priority);
    startTransition(async () => {
      const res = await updateTask(undefined as never, fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`למחוק את "${task.title}"?`)) return;
    startDelete(async () => {
      const res = await deleteTask(task.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  const inputCls =
    "border-ink-line focus:border-navy rounded-lg border bg-white px-2 py-1.5 text-sm outline-none";

  return (
    <li className="px-4 py-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="כותרת"
          autoFocus
          className={`${inputCls} w-full`}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="תיאור (אופציונלי)"
          rows={2}
          className={`${inputCls} w-full resize-none`}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputCls}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={inputCls}
          >
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between">
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
              onClick={onDone}
              className="text-ink-soft hover:text-navy rounded-lg px-3 py-1.5 text-xs"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={pending || !title.trim()}
              className="bg-navy text-cream-paper flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              <Check size={12} />
              שמור
            </button>
          </div>
        </div>
      </form>
    </li>
  );
}

function TaskRow({ task }: { task: TaskListItem }) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  const isDone = task.status === "done";
  const due = task.due_date ? new Date(task.due_date) : null;
  // eslint-disable-next-line react-hooks/purity
  const isOverdue = due && due.getTime() < Date.now() && !isDone && task.status !== "cancelled";

  const toggle = () => {
    startTransition(async () => {
      const res = await toggleTaskComplete(task.id, !isDone);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  };

  if (editing) {
    return <EditableTaskRow task={task} onDone={() => setEditing(false)} />;
  }

  return (
    <li
      className="hover:bg-cream-deep/40 flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
      onClick={() => setEditing(true)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        disabled={isPending}
        aria-label={isDone ? "בטל סימון כהושלם" : "סמן כהושלם"}
        className="text-ink-soft hover:text-navy shrink-0 transition-colors disabled:opacity-50"
      >
        {isDone ? <CheckSquare size={20} className="text-emerald-600" /> : <Square size={20} />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-sm font-medium ${
            isDone ? "text-ink-faded line-through" : "text-navy"
          }`}
        >
          {task.title}
        </div>
        <div className="text-ink-soft mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {task.project_name && (
            <span className="inline-flex items-center gap-1">
              <FolderKanban size={11} />
              {task.project_name}
            </span>
          )}
          {due && (
            <span className={`inline-flex items-center gap-1 ${isOverdue ? "text-rose-600" : ""}`}>
              <Calendar size={11} />
              {due.toLocaleDateString("he-IL")}
              {isOverdue && <AlertTriangle size={11} />}
            </span>
          )}
          {task.assignee_name && <span>· {task.assignee_name}</span>}
        </div>
      </div>

      <PriorityPill priority={task.priority} />
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
          STATUS_STYLES[task.status] ?? "border-ink-line bg-cream text-ink-soft"
        }`}
      >
        {STATUS_LABELS[task.status] ?? task.status}
      </span>
    </li>
  );
}

function StatusSelect({ taskId, status }: { taskId: string; status: string }) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    startTransition(async () => {
      const res = await updateTaskStatus(taskId, next);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  };

  return (
    <select
      value={status}
      onChange={onChange}
      disabled={isPending}
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium outline-none disabled:opacity-50 ${
        STATUS_STYLES[status] ?? "border-ink-line bg-cream text-ink-soft"
      }`}
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
        PRIORITY_STYLES[priority] ?? "border-ink-line bg-cream text-ink-soft"
      }`}
    >
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

function KanbanView({ tasks }: { tasks: TaskListItem[] }) {
  const toast = useToast();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const effectiveTasks = useMemo<TaskListItem[]>(
    () =>
      tasks.map((t) =>
        overrides[t.id] ? { ...t, status: overrides[t.id] as TaskListItem["status"] } : t,
      ),
    [tasks, overrides],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TaskListItem[]>();
    for (const s of STATUS_ORDER) map.set(s, []);
    for (const t of effectiveTasks) {
      const arr = map.get(t.status);
      if (arr) arr.push(t);
    }
    return map;
  }, [effectiveTasks]);

  const handleDrop = (targetStatus: string, taskId: string, fromStatus: string) => {
    setDragOverCol(null);
    setDraggingId(null);
    if (targetStatus === fromStatus) return;
    setOverrides((prev) => ({ ...prev, [taskId]: targetStatus }));
    startTransition(async () => {
      const res = await updateTaskStatus(taskId, targetStatus);
      if (res.error) {
        toast.error(res.error);
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {STATUS_ORDER.map((s) => {
        const items = grouped.get(s) ?? [];
        const isOver = dragOverCol === s;
        return (
          <div
            key={s}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOverCol(s);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDragOverCol((cur) => (cur === s ? null : cur));
            }}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData("application/x-task-id");
              const fromStatus = e.dataTransfer.getData("application/x-task-status");
              if (taskId) handleDrop(s, taskId, fromStatus);
            }}
            className={`bg-cream-deep/50 rounded-2xl p-3 transition-all ${
              isOver ? "ring-navy/40 ring-2" : ""
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-navy text-sm font-semibold">{STATUS_LABELS[s]}</h3>
              <span className="text-ink-soft text-xs">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((t) => (
                <KanbanCard
                  key={t.id}
                  task={t}
                  isDragging={draggingId === t.id}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("application/x-task-id", t.id);
                    e.dataTransfer.setData("application/x-task-status", t.status);
                    setDraggingId(t.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverCol(null);
                  }}
                />
              ))}
              {items.length === 0 && (
                <div className="text-ink-faded py-4 text-center text-xs">אין משימות</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  task,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  task: TaskListItem;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const due = task.due_date ? new Date(task.due_date) : null;
  const isOverdue =
    due &&
    // eslint-disable-next-line react-hooks/purity
    due.getTime() < Date.now() &&
    task.status !== "done" &&
    task.status !== "cancelled";
  const initial = task.assignee_name?.trim().slice(0, 1) ?? null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-cream-paper border-ink-line hover:border-ink-soft cursor-grab rounded-xl border p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="text-navy mb-2 text-sm font-medium">{task.title}</div>
      {task.project_name && (
        <div className="text-ink-soft mb-2 flex items-center gap-1 text-xs">
          <FolderKanban size={11} />
          <span className="truncate">{task.project_name}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PriorityPill priority={task.priority} />
          {due && (
            <span
              className={`text-ink-soft inline-flex items-center gap-1 text-xs ${
                isOverdue ? "text-rose-600" : ""
              }`}
            >
              <Calendar size={11} />
              {due.toLocaleDateString("he-IL")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusSelect taskId={task.id} status={task.status} />
          {initial && (
            <span
              title={task.assignee_name ?? ""}
              className="bg-navy text-cream-paper flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
            >
              {initial}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-cream-deep mb-4 flex h-20 w-20 items-center justify-center rounded-full">
        <CheckSquare size={48} className="text-navy/60" />
      </div>
      <h2 className="text-display-sm text-navy mb-2">התחל לנהל משימות</h2>
      <p className="text-ink-soft mb-6 max-w-md text-sm">
        ארגן את העבודה היומית — לפי פרויקט, עדיפות, תאריך יעד ומשובץ
      </p>
      <button
        type="button"
        onClick={onNew}
        className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
      >
        <Plus size={16} />
        צור משימה ראשונה
      </button>
    </div>
  );
}

function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-cream-deep mb-4 flex h-20 w-20 items-center justify-center rounded-full">
        <SearchX size={48} className="text-navy/60" />
      </div>
      <h2 className="text-display-sm text-navy mb-2">
        {query ? `לא נמצאו תוצאות עבור "${query}"` : "אין משימות בסינון הזה"}
      </h2>
      <button
        type="button"
        onClick={onClear}
        className="text-ink-soft hover:text-navy text-sm underline"
      >
        נקה חיפוש וסינון
      </button>
    </div>
  );
}

function TodayView({ tasks }: { tasks: TaskListItem[] }) {
  const todayKey = toDateKey(new Date());

  const overdue = tasks.filter(
    (t) =>
      t.due_date &&
      t.due_date.slice(0, 10) < todayKey &&
      t.status !== "done" &&
      t.status !== "cancelled",
  );
  const dueToday = tasks.filter((t) => t.due_date?.slice(0, 10) === todayKey);
  const urgentNoDate = tasks.filter(
    (t) =>
      !t.due_date &&
      t.status !== "done" &&
      t.status !== "cancelled" &&
      (t.priority === "urgent" || t.priority === "high"),
  );

  if (overdue.length === 0 && dueToday.length === 0 && urgentNoDate.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-cream-deep mb-4 flex h-20 w-20 items-center justify-center rounded-full">
          <CheckSquare size={40} className="text-emerald-500" />
        </div>
        <h2 className="text-display-sm text-navy mb-1">הכל מסודר להיום!</h2>
        <p className="text-ink-soft text-sm">אין משימות דחופות או בפיגור</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {overdue.length > 0 && (
        <TodaySection
          title={`בפיגור — ${overdue.length} משימות`}
          tasks={overdue}
          headerClass="text-rose-700 border-rose-200"
          bgClass="bg-rose-50/60"
        />
      )}
      {dueToday.length > 0 && (
        <TodaySection
          title={`להיום — ${dueToday.length} משימות`}
          tasks={dueToday}
          headerClass="text-navy border-navy/20"
          bgClass="bg-cream-paper"
        />
      )}
      {urgentNoDate.length > 0 && (
        <TodaySection
          title={`דחוף ללא תאריך — ${urgentNoDate.length} משימות`}
          tasks={urgentNoDate}
          headerClass="text-amber-700 border-amber-200"
          bgClass="bg-amber-50/40"
        />
      )}
    </div>
  );
}

function TodaySection({
  title,
  tasks,
  headerClass,
  bgClass,
}: {
  title: string;
  tasks: TaskListItem[];
  headerClass: string;
  bgClass: string;
}) {
  return (
    <div className={`border-ink-line overflow-hidden rounded-2xl border ${bgClass}`}>
      <div className={`border-b px-4 py-2.5 text-xs font-semibold uppercase ${headerClass}`}>
        {title}
      </div>
      <ul className="divide-ink-line/60 divide-y">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </ul>
    </div>
  );
}
