"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Square, Trash2, AlertTriangle, Calendar, CheckCheck } from "lucide-react";
import { deleteTask, toggleTaskComplete } from "@/app/(app)/tasks/actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

export type TasksSectionItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
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

export function TasksSection({ tasks }: { tasks: TasksSectionItem[] }) {
  const open = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const completed = tasks.filter((t) => t.status === "done");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-navy text-lg font-semibold">משימות</h2>
        <span className="text-ink-faded text-xs">
          {open.length} פתוחות · {completed.length} הושלמו
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="border-ink-line bg-cream-paper/40 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center">
          <div className="bg-cream-deep mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <CheckCheck size={36} className="text-navy/60" />
          </div>
          <p className="text-ink-soft text-sm">אין משימות פתוחות</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
          {completed.length > 0 && (
            <li className="text-ink-faded mt-4 mb-1 text-xs font-semibold uppercase">
              הושלמו ({completed.length})
            </li>
          )}
          {completed.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: TasksSectionItem }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const serverDone = task.status === "done";
  const [optimisticDone, setOptimisticDone] = useOptimistic(serverDone, (_s, n: boolean) => n);
  const isDone = optimisticDone;
  const due = task.due_date ? new Date(task.due_date) : null;
  // eslint-disable-next-line react-hooks/purity
  const isOverdue = due && !isDone && due.getTime() < Date.now() && task.status !== "cancelled";

  const handleToggle = () => {
    const next = !isDone;
    startTransition(async () => {
      setOptimisticDone(next);
      const res = await toggleTaskComplete(task.id, next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (next) toast.success("✓ הושלם");
      router.refresh();
    });
  };

  const handleDelete = () => {
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
    <li
      className={`group flex items-center gap-3 rounded-xl border p-3 transition-all ${
        isOverdue
          ? "border-red-200 bg-red-50/40"
          : isDone
            ? "border-ink-line bg-cream-paper/50 opacity-60"
            : "border-ink-line bg-cream-paper"
      }`}
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        aria-label={isDone ? "ביטול סימון כבוצעה" : "סמן כבוצעה"}
        aria-pressed={isDone}
        className="text-ink-soft hover:text-navy shrink-0 transition-colors disabled:opacity-50"
      >
        {isDone ? <CheckSquare size={20} className="text-emerald-600" /> : <Square size={20} />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={`text-navy truncate text-sm font-medium ${
            isDone ? "text-ink-faded line-through" : ""
          }`}
        >
          {task.title}
        </div>
        {due && (
          <div
            className={`text-ink-faded mt-0.5 flex items-center gap-1 text-xs ${
              isOverdue ? "font-semibold text-red-600" : ""
            }`}
          >
            {isOverdue ? <AlertTriangle size={11} /> : <Calendar size={11} />}
            {due.toLocaleDateString("he-IL")}
          </div>
        )}
      </div>

      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
          PRIORITY_STYLES[task.priority] ?? "border-ink-line bg-cream text-ink-soft"
        }`}
      >
        {PRIORITY_LABELS[task.priority] ?? task.priority}
      </span>

      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        aria-label="מחק"
        className="text-ink-faded shrink-0 rounded-md p-1 opacity-0 transition-all group-hover:opacity-100 hover:text-rose-600 disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}
