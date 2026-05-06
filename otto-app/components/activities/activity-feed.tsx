"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil } from "lucide-react";
import { ACTIVITY_META, LOGGED_ACTIVITY_TYPES, type ActivityType } from "./activity-types";
import { NewActivityDialog } from "./new-activity-dialog";
import { EditActivityDialog } from "./edit-activity-dialog";
import { deleteActivity } from "@/app/(app)/activities/actions";
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

  // Filter out any lingering task-type activities (defensive — should not exist after migration).
  const visible = activities.filter((a) => a.type !== "task");

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

      {visible.length === 0 ? (
        <div className="border-ink-line rounded-xl border border-dashed px-6 py-10 text-center">
          <span className="font-caveat text-ink-faded mb-1 block text-[22px]">
            אין עדיין פעילות
          </span>
          <p className="text-ink-faded mb-4 text-xs">הוסיפו פגישה, שיחה או הערה</p>
          <button
            onClick={() => setShowNew(true)}
            className="text-navy hover:text-navy-deep inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
          >
            <Plus size={14} />
            הוסף פעילות
          </button>
        </div>
      ) : (
        <ol className="relative space-y-3">
          {visible.map((a) => (
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
  const meta = ACTIVITY_META[activity.type as ActivityType] ?? ACTIVITY_META.note;
  const Icon = meta.icon;
  const isMeeting = activity.type === "meeting";
  const isLogged = LOGGED_ACTIVITY_TYPES.includes(activity.type as ActivityType);

  function handleDelete() {
    if (!confirm("למחוק את הפעילות?")) return;
    startTransition(async () => {
      await deleteActivity(activity.id, parentPath);
      router.refresh();
    });
  }

  return (
    <li className="group border-ink-line bg-cream-paper relative flex gap-3 rounded-xl border p-3.5 transition-all duration-300 ease-out motion-reduce:transition-none">
      <span className={`mt-1 shrink-0 ${meta.iconColor}`} aria-label={meta.label}>
        <Icon size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-navy truncate text-sm font-semibold">{activity.title}</div>
            <div className="text-ink-faded mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="font-medium">{meta.label}</span>
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
                <>
                  <span>·</span>
                  <time>{formatActivityRelative(activity.occurred_at)}</time>
                </>
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
          <p className="text-ink-soft mt-2 text-sm leading-relaxed whitespace-pre-wrap">
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
