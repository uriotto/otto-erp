"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "lucide-react";
import { ACTIVITY_META, ACTIVITY_TYPES, type ActivityType } from "./activity-types";
import { DateTimePicker } from "./datetime-picker";
import { updateActivity, type ActivityFormState } from "@/app/(app)/activities/actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

const init: ActivityFormState = {};

export type EditableActivity = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  occurred_at: string;
  due_at: string | null;
  end_at: string | null;
};

export function EditActivityDialog({
  activity,
  parentPath,
  onClose,
}: {
  activity: EditableActivity;
  parentPath: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(updateActivity, init);
  const [type, setType] = useState<ActivityType>(activity.type as ActivityType);
  const toast = useToast();

  useEffect(() => {
    if (state.success) {
      toast.success("הפעילות עודכנה");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose]);

  const showDue = type === "task";
  const showStartEnd = type === "meeting";
  const showSimpleWhen = !showDue && !showStartEnd;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">עריכת פעילות</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={activity.id} />
          <input type="hidden" name="parent_path" value={parentPath} />

          <div>
            <label className="text-micro text-ink-soft mb-2 block uppercase">סוג</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ACTIVITY_TYPES.map((t) => {
                const meta = ACTIVITY_META[t];
                const Icon = meta.icon;
                return (
                  <label key={t} className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      checked={type === t}
                      onChange={() => setType(t)}
                      className="peer sr-only"
                    />
                    <div className="border-ink-line peer-checked:border-navy peer-checked:bg-navy peer-checked:text-cream-paper flex flex-col items-center gap-1 rounded-xl border bg-white p-2.5 text-xs transition-all">
                      <Icon size={16} />
                      {meta.label}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">כותרת *</label>
            <input
              name="title"
              defaultValue={activity.title}
              className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            />
            {state.fieldErrors?.title?.[0] && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.title[0]}</p>
            )}
          </div>

          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">פרטים</label>
            <textarea
              name="body"
              rows={3}
              defaultValue={activity.body ?? ""}
              className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          {showDue && (
            <div>
              <label className="text-micro text-ink-soft mb-2 block uppercase">תאריך יעד</label>
              <DateTimePicker
                name="due_at"
                defaultValue={activity.due_at ? toLocalIso(activity.due_at) : undefined}
                defaultDaysFromNow={1}
                defaultTime="09:00"
              />
            </div>
          )}

          {showStartEnd && (
            <>
              <div>
                <label className="text-micro text-ink-soft mb-2 block uppercase">התחלה</label>
                <DateTimePicker
                  name="occurred_at"
                  defaultValue={toLocalIso(activity.occurred_at)}
                  defaultDaysFromNow={0}
                  defaultTime="14:00"
                />
              </div>
              <div>
                <label className="text-micro text-ink-soft mb-2 block uppercase">סיום</label>
                <DateTimePicker
                  name="end_at"
                  defaultValue={activity.end_at ? toLocalIso(activity.end_at) : undefined}
                  defaultDaysFromNow={0}
                  defaultTime="15:00"
                />
              </div>
            </>
          )}

          {showSimpleWhen && (
            <div>
              <label className="text-micro text-ink-soft mb-2 block uppercase">תאריך ושעה</label>
              <DateTimePicker
                name="occurred_at"
                defaultValue={toLocalIso(activity.occurred_at)}
                defaultDaysFromNow={0}
              />
            </div>
          )}

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border-ink-line text-navy hover:border-navy rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="bg-navy text-cream-paper hover:bg-navy-deep rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <Spinner size={14} />
                  <span>שומר</span>
                </span>
              ) : (
                "שמור"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toLocalIso(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
