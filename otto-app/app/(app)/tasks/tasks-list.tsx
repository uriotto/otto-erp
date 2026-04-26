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
  FolderKanban,
  KanbanSquare,
  List,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { NewTaskDialog } from "./new-task-dialog";
import { deleteTask, quickCreateTask, toggleTaskComplete, updateTaskStatus } from "./actions";

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

type ViewMode = "list" | "kanban";

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
  const [view, setView] = useState<ViewMode>(() =>
    searchParams.get("view") === "kanban" ? "kanban" : "list",
  );

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
    updateUrl({ view: v === "kanban" ? "kanban" : undefined });
  };

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
      ) : (
        <ListView tasks={filtered} />
      )}

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

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="border-ink-line bg-cream-paper inline-flex items-center rounded-lg border p-0.5">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
          view === "list" ? "bg-navy text-cream-paper" : "text-ink-soft hover:text-navy"
        }`}
        aria-pressed={view === "list"}
      >
        <List size={14} />
        רשימה
      </button>
      <button
        type="button"
        onClick={() => onChange("kanban")}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
          view === "kanban" ? "bg-navy text-cream-paper" : "text-ink-soft hover:text-navy"
        }`}
        aria-pressed={view === "kanban"}
      >
        <KanbanSquare size={14} />
        קנבן
      </button>
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

function TaskRow({ task }: { task: TaskListItem }) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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

  const remove = () => {
    if (!confirm(`למחוק את "${task.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteTask(task.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("המשימה נמחקה");
        router.refresh();
      }
    });
  };

  return (
    <li className="hover:bg-cream-deep/40 flex items-center gap-3 px-4 py-3 transition-colors">
      <button
        type="button"
        onClick={toggle}
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
      <StatusSelect taskId={task.id} status={task.status} />

      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        aria-label="מחק"
        className="text-ink-faded shrink-0 rounded-md p-1 transition-colors hover:text-rose-600 disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>
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
