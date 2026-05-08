"use client";

import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { Check, CircleDashed, Plus, Trash2, X, Calendar, Pencil } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import {
  createMilestone,
  updateMilestone,
  deleteMilestone,
  toggleMilestoneComplete,
  type MilestoneFormState,
} from "../actions";

const init: MilestoneFormState = {};

export function MilestonesSection({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: Tables<"milestones">[];
}) {
  const [showAdd, setShowAdd] = useState(false);

  const completed = milestones.filter((m) => m.completed_at).length;
  const total = milestones.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="bg-cream-paper border-ink-line rounded-2xl border p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-display-sm text-navy">אבני דרך</h2>
          {total > 0 && (
            <p className="text-ink-soft mt-1 text-xs">
              {completed} מתוך {total} הושלמו · {pct}%
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="border-ink-line text-navy hover:border-navy flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          <Plus size={13} />
          אבן דרך
        </button>
      </div>

      {total > 0 && (
        <div className="bg-cream-deep mb-4 h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-navy h-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {milestones.length === 0 ? (
        <p className="text-ink-soft text-sm">עדיין אין אבני דרך. הוסף אחת כדי להתחיל.</p>
      ) : (
        <ul className="space-y-2">
          {milestones.map((m) => (
            <MilestoneRow key={m.id} milestone={m} projectId={projectId} />
          ))}
        </ul>
      )}

      {showAdd && (
        <AddMilestoneDialog
          projectId={projectId}
          orderIndex={milestones.length}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function EditMilestoneForm({
  milestone,
  projectId,
  onClose,
}: {
  milestone: Tables<"milestones">;
  projectId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const boundAction = updateMilestone.bind(null, milestone.id, projectId);
  const [state, action, pending] = useActionState<MilestoneFormState, FormData>(boundAction, {});

  useEffect(() => {
    if (state.success) onClose();
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      action={action}
      className="border-ink-line space-y-2 rounded-lg border bg-white px-3 py-2.5"
    >
      <div>
        <input
          name="name"
          required
          defaultValue={milestone.name}
          placeholder="שם"
          className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-2.5 py-1.5 text-sm outline-none"
        />
        {state.fieldErrors?.name?.[0] && (
          <p className="mt-0.5 text-xs text-red-600">{state.fieldErrors.name[0]}</p>
        )}
      </div>
      <input
        name="description"
        defaultValue={milestone.description ?? ""}
        placeholder="תיאור (אופציונלי)"
        className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none"
      />
      <input
        name="due_date"
        type="date"
        defaultValue={milestone.due_date ?? ""}
        dir="ltr"
        className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-ink-soft hover:text-navy rounded-lg px-3 py-1.5 text-xs"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        >
          {pending && <Spinner size={12} />}
          שמור
        </button>
      </div>
    </form>
  );
}

function MilestoneRow({
  milestone,
  projectId,
}: {
  milestone: Tables<"milestones">;
  projectId: string;
}) {
  const [toggling, startToggle] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [editing, setEditing] = useState(false);
  const toast = useToast();

  const serverDone = !!milestone.completed_at;
  const [optimisticDone, setOptimisticDone] = useOptimistic(
    serverDone,
    (_: boolean, next: boolean) => next,
  );
  const isDone = optimisticDone;

  function handleToggle() {
    const next = !optimisticDone;
    startToggle(async () => {
      setOptimisticDone(next);
      const res = await toggleMilestoneComplete(milestone.id, next, projectId);
      if (res.error) toast.error(res.error);
    });
  }

  function handleDelete() {
    if (!confirm("למחוק את אבן הדרך?")) return;
    startDelete(async () => {
      const res = await deleteMilestone(milestone.id, projectId);
      if (res.error) toast.error(res.error);
      else toast.success("נמחקה");
    });
  }

  const due = milestone.due_date ? new Date(milestone.due_date) : null;
  // eslint-disable-next-line react-hooks/purity
  const isOverdue = !isDone && due && due.getTime() < Date.now();

  if (editing) {
    return (
      <li>
        <EditMilestoneForm
          milestone={milestone}
          projectId={projectId}
          onClose={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="border-ink-line group flex items-start gap-3 rounded-lg border bg-white px-3 py-2.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={toggling}
        aria-pressed={isDone}
        className="mt-0.5 shrink-0 transition-transform motion-reduce:transition-none"
      >
        {isDone ? (
          <Check size={18} className="text-emerald-600" />
        ) : (
          <CircleDashed size={18} className="text-ink-faded hover:text-navy transition-colors" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm transition-all duration-200 ${
            isDone ? "text-ink-faded line-through" : "text-navy font-medium"
          }`}
        >
          {milestone.name}
        </div>
        {milestone.description && (
          <div className="text-ink-soft mt-0.5 text-xs">{milestone.description}</div>
        )}
        {due && (
          <div
            className={`mt-1 inline-flex items-center gap-1 text-xs ${
              isOverdue ? "text-rose-600" : "text-ink-faded"
            }`}
          >
            <Calendar size={11} />
            {due.toLocaleDateString("he-IL")}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-ink-faded hover:text-navy rounded p-0.5"
          aria-label="ערוך"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-ink-faded rounded p-0.5 hover:text-rose-600 disabled:cursor-not-allowed"
          aria-label="מחק"
        >
          {deleting ? <Spinner size={13} /> : <Trash2 size={13} />}
        </button>
      </div>
    </li>
  );
}

function AddMilestoneDialog({
  projectId,
  orderIndex,
  onClose,
}: {
  projectId: string;
  orderIndex: number;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(createMilestone, init);
  const toast = useToast();

  useEffect(() => {
    if (state.success) {
      toast.success("אבן דרך נוצרה");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="bg-cream w-full max-w-md rounded-t-2xl p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">אבן דרך חדשה</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="order_index" value={orderIndex} />
          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">שם *</label>
            <input
              name="name"
              required
              className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            />
            {state.fieldErrors?.name?.[0] && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name[0]}</p>
            )}
          </div>
          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">תיאור</label>
            <textarea
              name="description"
              rows={2}
              className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">תאריך יעד</label>
            <input
              name="due_date"
              type="date"
              className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <div className="flex justify-end gap-3">
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
                  <span>יוצר</span>
                </span>
              ) : (
                "צור"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
