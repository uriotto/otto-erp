"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ACTIVITY_META, type ActivityType } from "@/components/activities/activity-types";
import { toggleActivityComplete } from "@/app/(app)/activities/actions";

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
  const meta = ACTIVITY_META[activity.type as ActivityType] ?? ACTIVITY_META.note;
  const Icon = meta.icon;
  const isTask = activity.type === "task";
  const isDone = !!activity.completed_at;

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
    startTransition(async () => {
      await toggleActivityComplete(activity.id, !isDone, "/today");
      router.refresh();
    });
  }

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${tone}`}>
      {isTask ? (
        <button
          onClick={handleToggle}
          disabled={pending}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            isDone
              ? "border-green-200 bg-green-50 text-green-600"
              : variant === "overdue"
                ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                : `${meta.color} hover:brightness-95`
          }`}
          aria-label="סמן כבוצעה"
        >
          {isDone ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <Icon size={14} />
          )}
        </button>
      ) : (
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.color}`}
        >
          <Icon size={14} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="text-navy truncate text-sm font-semibold">{activity.title}</div>
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
