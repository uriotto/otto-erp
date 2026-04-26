"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ACTIVITY_META, type ActivityType } from "@/components/activities/activity-types";
import { toggleActivityComplete } from "@/app/(app)/activities/actions";
import { useToast } from "@/components/ui/toast";

type ActivityWithParent = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  occurred_at: string;
  due_at: string | null;
  end_at: string | null;
  completed_at: string | null;
  customer_id: string | null;
  lead_id: string | null;
  customers: { id: string; name: string } | null;
  leads: { id: string; name: string } | null;
};

export function TodayActivityRow({
  activity,
  variant,
}: {
  activity: ActivityWithParent;
  variant: "overdue" | "meeting" | "task" | "upcoming";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const meta = ACTIVITY_META[activity.type as ActivityType] ?? ACTIVITY_META.note;
  const Icon = meta.icon;
  const isTask = activity.type === "task";
  const serverIsDone = !!activity.completed_at;
  const [optimisticDone, setOptimisticDone] = useOptimistic(
    serverIsDone,
    (_state, next: boolean) => next,
  );
  const isDone = optimisticDone;

  const parentName = activity.customers?.name ?? activity.leads?.name ?? "אישי";
  const parentHref = activity.customer_id
    ? `/customers/${activity.customer_id}`
    : activity.lead_id
      ? `/leads/${activity.lead_id}`
      : null;

  const tone =
    variant === "overdue"
      ? "border-red-200 bg-red-50/40"
      : variant === "meeting"
        ? "border-orange-100 bg-orange-50/30"
        : "border-ink-line bg-cream-paper";

  function handleToggle() {
    const next = !isDone;
    startTransition(async () => {
      setOptimisticDone(next);
      const res = await toggleActivityComplete(activity.id, next, "/today");
      if (res?.error) {
        toast.error(res.error || "שגיאה בעדכון המשימה");
        return;
      }
      if (next) toast.success("✓ הושלם");
      router.refresh();
    });
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-300 ease-out motion-reduce:transition-none ${tone} ${
        isDone ? "opacity-60" : "opacity-100"
      }`}
    >
      {isTask ? (
        <button
          onClick={handleToggle}
          disabled={pending}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ease-out motion-reduce:transition-none ${
            isDone
              ? "border-green-200 bg-green-50 text-green-600"
              : variant === "overdue"
                ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                : `${meta.color} hover:brightness-95`
          }`}
          aria-label={isDone ? "ביטול סימון כבוצעה" : "סמן כבוצעה"}
          aria-pressed={isDone}
        >
          <span className="relative flex h-4 w-4 items-center justify-center">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className={`absolute transition-all duration-200 ease-out motion-reduce:transition-none ${
                isDone ? "scale-100 opacity-100" : "scale-50 opacity-0"
              }`}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <Icon
              size={14}
              className={`absolute transition-all duration-200 ease-out motion-reduce:transition-none ${
                isDone ? "scale-50 opacity-0" : "scale-100 opacity-100"
              }`}
            />
          </span>
        </button>
      ) : (
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.color}`}
        >
          <Icon size={14} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div
          className={`text-navy truncate text-sm font-semibold transition-all duration-300 ease-out motion-reduce:transition-none ${
            isDone ? "line-through decoration-1" : ""
          }`}
        >
          {activity.title}
        </div>
        <div className="text-ink-faded mt-0.5 flex items-center gap-2 text-xs">
          {parentHref ? (
            <Link href={parentHref} className="hover:text-navy hover:underline">
              {parentName}
            </Link>
          ) : (
            <span className="italic">{parentName}</span>
          )}
          <span>·</span>
          <span className={variant === "overdue" ? "font-semibold text-red-600" : ""}>
            {whenLabel(activity, variant)}
          </span>
        </div>
      </div>
    </div>
  );
}

function whenLabel(a: ActivityWithParent, variant: string): string {
  if (a.type === "meeting") {
    const start = formatTime(a.occurred_at);
    const end = a.end_at ? formatTime(a.end_at) : null;
    return end ? `${start} – ${end}` : start;
  }
  if (a.type === "task" && a.due_at) {
    return formatRelative(a.due_at);
  }
  return formatRelative(a.occurred_at);
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(d);
  startOfTarget.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);
  const time = formatTime(iso);

  if (dayDiff === 0) return `היום ב-${time}`;
  if (dayDiff === 1) return `מחר ב-${time}`;
  if (dayDiff === -1) return `אתמול ב-${time}`;
  if (dayDiff > 1 && dayDiff <= 7) return `בעוד ${dayDiff} ימים`;
  if (dayDiff < -1 && dayDiff >= -7) return `לפני ${Math.abs(dayDiff)} ימים`;
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}
