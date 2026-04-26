"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertCircle, Clock, Pencil, MessageSquarePlus } from "lucide-react";
import { ACTIVITY_META, LOGGED_ACTIVITY_TYPES, type ActivityType } from "./activity-types";
import { NewActivityDialog } from "./new-activity-dialog";
import { EditActivityDialog } from "./edit-activity-dialog";
import { deleteActivity, toggleActivityComplete } from "@/app/(app)/activities/actions";
import { useToast } from "@/components/ui/toast";
import {
  formatActivityAbsolute,
  formatActivityRelative,
  formatActivityTime,
  formatMeetingRange,
} from "@/lib/format-activity-time";

export type Activity = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  occurred_at: string;
  due_at: string | null;
  end_at: string | null;
  completed_at: string | null;
};

export function ActivityFeed({
  activities,
  customerId,
  leadId,
  parentPath,
}: {
  activities: Activity[];
  customerId?: string;
  leadId?: string;
  parentPath: string;
}) {
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-navy text-lg font-semibold">פעילויות</h2>
        <button
          onClick={() => setShowNew(true)}
          className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
        >
          <Plus size={14} />
          הוסף פעילות
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="border-ink-line bg-cream-paper/40 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
          <div className="bg-cream-deep mb-5 flex h-20 w-20 items-center justify-center rounded-full">
            <MessageSquarePlus size={48} className="text-navy/60" />
          </div>
          <h3 className="text-display-sm text-navy mb-2">אין עדיין פעילות</h3>
          <p className="text-ink-soft mx-auto mb-6 max-w-md text-sm leading-relaxed">
            הוסיפו משימה, פגישה או הערה כדי להתחיל לתעד את ההיסטוריה.
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            הוסף פעילות
          </button>
        </div>
      ) : (
        <ol className="relative space-y-3">
          {activities.map((a) => (
            <ActivityItem key={a.id} activity={a} parentPath={parentPath} />
          ))}
        </ol>
      )}

      {showNew && (
        <NewActivityDialog
          customerId={customerId}
          leadId={leadId}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function ActivityItem({ activity, parentPath }: { activity: Activity; parentPath: string }) {
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const meta = ACTIVITY_META[activity.type as ActivityType] ?? ACTIVITY_META.note;
  const Icon = meta.icon;
  const isTask = activity.type === "task";
  const isMeeting = activity.type === "meeting";
  const isLogged = LOGGED_ACTIVITY_TYPES.includes(activity.type as ActivityType);
  const serverIsDone = !!activity.completed_at;
  const [optimisticDone, setOptimisticDone] = useOptimistic(
    serverIsDone,
    (_state, next: boolean) => next,
  );
  const isDone = optimisticDone;
  const isOverdue = isTask && !isDone && activity.due_at && new Date(activity.due_at) < new Date();

  function handleDelete() {
    if (!confirm("למחוק את הפעילות?")) return;
    startTransition(async () => {
      await deleteActivity(activity.id, parentPath);
      router.refresh();
    });
  }

  function handleToggle() {
    const next = !isDone;
    startTransition(async () => {
      setOptimisticDone(next);
      const res = await toggleActivityComplete(activity.id, next, parentPath);
      if (res?.error) {
        toast.error(res.error || "שגיאה בעדכון המשימה");
        return;
      }
      if (next) toast.success("✓ הושלם");
      router.refresh();
    });
  }

  return (
    <li
      className={`group relative flex gap-3 rounded-xl border p-3.5 transition-all duration-300 ease-out motion-reduce:transition-none ${
        isOverdue
          ? "border-red-200 bg-red-50/40"
          : isDone
            ? "border-ink-line bg-cream-paper/50 opacity-60"
            : "border-ink-line bg-cream-paper opacity-100"
      }`}
    >
      {isTask ? (
        <button
          onClick={handleToggle}
          disabled={pending}
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ease-out motion-reduce:transition-none ${
            isDone
              ? "border-green-200 bg-green-50 text-green-600"
              : isOverdue
                ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                : `${meta.color} hover:brightness-95`
          }`}
          aria-label={isDone ? "ביטול סימון כבוצעה" : "סמן כבוצעה"}
          aria-pressed={isDone}
        >
          <span className="relative flex h-4 w-4 items-center justify-center">
            <svg
              width="14"
              height="14"
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
              size={16}
              className={`absolute transition-all duration-200 ease-out motion-reduce:transition-none ${
                isDone ? "scale-50 opacity-0" : "scale-100 opacity-100"
              }`}
            />
          </span>
        </button>
      ) : (
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${meta.color}`}
          aria-label={meta.label}
        >
          <Icon size={16} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div
              className={`text-navy truncate text-sm font-semibold transition-all duration-300 ease-out motion-reduce:transition-none ${
                isDone ? "line-through decoration-1" : ""
              }`}
            >
              {activity.title}
            </div>
            <div className="text-ink-faded mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="font-medium">{meta.label}</span>
              {isTask && activity.due_at && (
                <>
                  <span>·</span>
                  <span
                    className={`flex items-center gap-1 ${
                      isOverdue ? "font-semibold text-red-600" : ""
                    }`}
                  >
                    {isOverdue ? <AlertCircle size={11} /> : <Clock size={11} />}
                    {isOverdue ? "באיחור: " : "יעד: "}
                    {formatActivityRelative(activity.due_at)}
                  </span>
                </>
              )}
              {isMeeting && activity.end_at ? (
                <>
                  <span>·</span>
                  <span>{formatMeetingRange(activity.occurred_at, activity.end_at)}</span>
                </>
              ) : isLogged ? (
                <>
                  <span>·</span>
                  <time>בוצע ב-{formatActivityRelative(activity.occurred_at)}</time>
                </>
              ) : (
                !isTask && (
                  <>
                    <span>·</span>
                    <time>{formatActivityRelative(activity.occurred_at)}</time>
                  </>
                )
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <time
              className="text-ink-faded mt-0.5 text-[11px] whitespace-nowrap tabular-nums transition-opacity group-hover:opacity-0"
              dateTime={activity.occurred_at}
              title={formatActivityAbsolute(activity.occurred_at)}
            >
              {formatActivityTime(activity.occurred_at)}
            </time>
            <div className="absolute end-3 flex items-center gap-0.5 opacity-0 transition-all group-hover:opacity-100">
              <button
                onClick={() => setShowEdit(true)}
                disabled={pending}
                className="text-ink-faded hover:text-navy rounded p-1 transition-colors disabled:opacity-50"
                aria-label="ערוך"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={handleDelete}
                disabled={pending}
                className="text-ink-faded rounded p-1 transition-colors hover:text-red-600 disabled:opacity-50"
                aria-label="מחק"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
        {activity.body && (
          <p
            className={`text-ink-soft mt-2 text-sm leading-relaxed whitespace-pre-wrap transition-all duration-300 ease-out motion-reduce:transition-none ${isDone ? "line-through decoration-1" : ""}`}
          >
            {activity.body}
          </p>
        )}
      </div>
      {showEdit && (
        <EditActivityDialog
          activity={activity}
          parentPath={parentPath}
          onClose={() => setShowEdit(false)}
        />
      )}
    </li>
  );
}
