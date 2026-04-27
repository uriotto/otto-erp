"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  X,
  CheckSquare,
  ExternalLink,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { quickCreateTask, updateTask, deleteTask } from "@/app/(app)/tasks/actions";
import { useToast } from "@/components/ui/toast";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  description?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-50 text-blue-700",
  review: "bg-purple-50 text-purple-700",
  done: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-400",
};
const STATUS_LABELS: Record<string, string> = {
  todo: "לעשות",
  in_progress: "בעבודה",
  review: "ביקורת",
  done: "הושלם",
  cancelled: "בוטל",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-rose-50 text-rose-700",
  high: "bg-amber-50 text-amber-700",
  medium: "bg-sky-50 text-sky-700",
  low: "bg-gray-50 text-gray-500",
};
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "דחוף",
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך",
};

export function ProjectTasksList({
  projectId,
  initialTasks,
}: {
  projectId: string;
  initialTasks: Task[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddDetails, setShowAddDetails] = useState(false);
  const router = useRouter();

  const open = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const done = tasks.filter((t) => t.status === "done" || t.status === "cancelled");

  function handleAdded(task: Task) {
    setTasks((prev) => [task, ...prev]);
    setShowAdd(false);
    setShowAddDetails(false);
    router.refresh();
  }

  function handleUpdated(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingId(null);
    router.refresh();
  }

  function handleDeleted(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    router.refresh();
  }

  return (
    <div className="bg-cream-paper border-ink-line mt-4 rounded-2xl border p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={16} className="text-navy" />
          <h2 className="text-display-sm text-navy">משימות</h2>
          {tasks.length > 0 && (
            <span className="bg-navy/10 text-navy rounded-full px-2 py-0.5 text-xs font-semibold">
              {open.length} פתוחות
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!showAdd && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="text-ink-soft hover:text-navy flex items-center gap-1 text-xs transition-colors"
            >
              <Plus size={13} />
              משימה
            </button>
          )}
          <Link
            href={`/tasks?project=${projectId}`}
            className="text-ink-soft hover:text-navy flex items-center gap-1 text-xs transition-colors"
          >
            כל המשימות
            <ExternalLink size={11} />
          </Link>
        </div>
      </div>

      {showAdd && (
        <AddTaskForm
          projectId={projectId}
          showDetails={showAddDetails}
          onToggleDetails={() => setShowAddDetails((v) => !v)}
          onAdded={handleAdded}
          onCancel={() => {
            setShowAdd(false);
            setShowAddDetails(false);
          }}
        />
      )}

      {tasks.length === 0 && !showAdd ? (
        <p className="text-ink-faded text-sm">אין משימות לפרויקט זה</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {open.map((t) =>
            editingId === t.id ? (
              <EditTaskRow
                key={t.id}
                task={t}
                onUpdated={handleUpdated}
                onCancel={() => setEditingId(null)}
                onDeleted={handleDeleted}
              />
            ) : (
              <TaskRow
                key={t.id}
                task={t}
                onEdit={() => setEditingId(t.id)}
                onDelete={handleDeleted}
              />
            ),
          )}
          {done.length > 0 && open.length > 0 && (
            <p className="text-ink-faded pt-1 text-xs">+ {done.length} הושלמו / בוטלו</p>
          )}
          {done.length > 0 && open.length === 0 && (
            <p className="text-ink-soft text-sm">כל {done.length} המשימות הושלמו</p>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onEdit,
  onDelete,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, startDelete] = useTransition();
  const toast = useToast();

  function handleDelete() {
    if (!confirm("למחוק את המשימה?")) return;
    startDelete(async () => {
      const res = await deleteTask(task.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      onDelete(task.id);
    });
  }

  return (
    <div className="border-ink-line group flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[task.priority] ?? ""}`}
      >
        {PRIORITY_LABELS[task.priority]}
      </span>
      <span className="text-navy min-w-0 flex-1 truncate text-sm">{task.title}</span>
      {task.due_date && (
        <span
          className={`shrink-0 text-[10px] ${
            new Date(task.due_date) < new Date() ? "text-rose-600" : "text-ink-faded"
          }`}
        >
          {new Date(task.due_date).toLocaleDateString("he-IL", {
            day: "numeric",
            month: "numeric",
          })}
        </span>
      )}
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[task.status] ?? ""}`}
      >
        {STATUS_LABELS[task.status]}
      </span>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="text-ink-faded hover:text-navy rounded p-0.5"
          aria-label="ערוך"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-ink-faded rounded p-0.5 hover:text-rose-600"
          aria-label="מחק"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function EditTaskRow({
  task,
  onUpdated,
  onCancel,
  onDeleted,
}: {
  task: Task;
  onUpdated: (t: Task) => void;
  onCancel: () => void;
  onDeleted: (id: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.due_date?.slice(0, 10) ?? "");
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
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
      onUpdated({
        ...task,
        title: title.trim(),
        description,
        due_date: dueDate || null,
        status,
        priority,
      });
    });
  }

  function handleDelete() {
    if (!confirm("למחוק את המשימה?")) return;
    startDelete(async () => {
      const res = await deleteTask(task.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      onDeleted(task.id);
    });
  }

  const inputCls =
    "border-ink-line focus:border-navy rounded-lg border bg-white px-2 py-1.5 text-sm outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      className="border-navy/30 space-y-2 rounded-xl border bg-white p-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="כותרת"
        className={`${inputCls} w-full`}
        autoFocus
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
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
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
            onClick={onCancel}
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
  );
}

function AddTaskForm({
  projectId,
  showDetails,
  onToggleDetails,
  onAdded,
  onCancel,
}: {
  projectId: string;
  showDetails: boolean;
  onToggleDetails: () => void;
  onAdded: (task: Task) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await quickCreateTask({
        title: title.trim(),
        project_id: projectId,
        due_date: dueDate || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("משימה נוצרה");
      onAdded({
        id: res.taskId!,
        title: title.trim(),
        description,
        due_date: dueDate || null,
        status: "todo",
        priority: "medium",
      });
    });
  }

  const inputCls =
    "border-ink-line focus:border-navy rounded-lg border bg-white px-2 py-1.5 text-sm outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      className="border-ink-line mb-3 space-y-2 rounded-xl border bg-white p-3"
    >
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        placeholder="כותרת המשימה..."
        autoFocus
        disabled={pending}
        className={`${inputCls} w-full`}
      />

      {showDetails && (
        <>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="תיאור (אופציונלי)"
            rows={2}
            className={`${inputCls} w-full resize-none`}
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputCls}
          />
        </>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleDetails}
          className="text-ink-faded hover:text-navy flex items-center gap-1 text-xs"
        >
          {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showDetails ? "פחות" : "תיאור ותאריך"}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-ink-faded hover:text-navy rounded p-1"
          >
            <X size={14} />
          </button>
          <button
            type="submit"
            disabled={pending || !title.trim()}
            className="bg-navy text-cream-paper rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            הוסף
          </button>
        </div>
      </div>
    </form>
  );
}
