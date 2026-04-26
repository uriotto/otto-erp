"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CheckSquare, Square, AlertTriangle, Building2, TrendingUp } from "lucide-react";
import { toggleTaskComplete } from "@/app/(app)/tasks/actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

export type TodayTaskItem = {
  id: string;
  title: string;
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

  return (
    <div
      className={`border-ink-line group flex items-start gap-3 rounded-lg border bg-white px-3 py-2.5 transition-all duration-200 ease-out ${
        isDone ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        onClick={handleToggle}
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
