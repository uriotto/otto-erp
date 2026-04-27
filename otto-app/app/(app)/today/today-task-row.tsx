"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Check,
  CheckSquare,
  Square,
  AlertTriangle,
  Building2,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { deleteTask, toggleTaskComplete, updateTask } from "@/app/(app)/tasks/actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

const STATUS_LABELS: Record<string, string> = {
  todo: "לעשות",
  in_progress: "בעבודה",
  review: "ביקורת",
  done: "הושלם",
  cancelled: "בוטל",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "דחוף",
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך",
};

export type TodayTaskItem = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  customer_id: string | null;
  lead_id: string | null;
  customers: { id: string; name: string } | null;
  leads: { id: string; name: string } | null;
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-blue-600",
  high: "text-amber-600",
  urgent: "text-rose-600",
};

export function TodayTaskRow({
  task,
  variant,
}: {
  task: TodayTaskItem;
  variant: "task" | "overdue" | "upcoming";
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const isDone = !!task.completed_at;

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleTaskComplete(task.id, !isDone);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (!isDone) toast.success("✓ הושלם");
      router.refresh();
    });
  }

  const parent = task.customers
    ? { href: `/customers/${task.customers.id}`, label: task.customers.name, icon: Building2 }
    : task.leads
      ? { href: `/leads/${task.leads.id}`, label: task.leads.name, icon: TrendingUp }
      : null;

  const due = task.due_date ? new Date(task.due_date) : null;

  if (editing) {
    return <TodayEditForm task={task} onDone={() => setEditing(false)} />;
  }

  return (
    <div
      className={`border-ink-line hover:border-navy/30 flex cursor-pointer items-start gap-3 rounded-lg border bg-white px-3 py-2.5 transition-all duration-200 ease-out ${
        isDone ? "opacity-60" : ""
      }`}
      onClick={() => setEditing(true)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        disabled={pending}
        aria-pressed={isDone}
        aria-label={isDone ? "סמן כלא הושלם" : "סמן כהושלם"}
        className="mt-0.5 shrink-0 transition-transform motion-reduce:transition-none"
      >
        {pending ? (
          <Spinner size={18} />
        ) : isDone ? (
          <CheckSquare size={18} className="text-emerald-600" />
        ) : (
          <Square size={18} className="text-ink-faded hover:text-navy transition-colors" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={`text-sm transition-all duration-200 ${
            isDone ? "text-ink-faded line-through" : "text-navy font-medium"
          }`}
        >
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {parent && (
            <Link
              href={parent.href}
              onClick={(e) => e.stopPropagation()}
              className="text-ink-soft hover:text-navy inline-flex items-center gap-1 transition-colors"
            >
              <parent.icon size={11} />
              {parent.label}
            </Link>
          )}
          {due && (
            <span
              className={`inline-flex items-center gap-1 ${
                variant === "overdue" ? "text-rose-600" : "text-ink-faded"
              }`}
            >
              {variant === "overdue" ? <AlertTriangle size={11} /> : <Calendar size={11} />}
              {due.toLocaleDateString("he-IL")}
            </span>
          )}
          {task.priority && task.priority !== "medium" && (
            <span className={PRIORITY_STYLES[task.priority] ?? ""}>
              {priorityLabel(task.priority)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TodayEditForm({ task, onDone }: { task: TodayTaskItem; onDone: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.due_date?.slice(0, 10) ?? "");
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
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
    <div className="border-navy/30 rounded-lg border bg-white px-3 py-3">
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
    </div>
  );
}

function priorityLabel(p: string): string {
  switch (p) {
    case "low":
      return "נמוכה";
    case "high":
      return "גבוהה";
    case "urgent":
      return "דחוף";
    default:
      return "";
  }
}
