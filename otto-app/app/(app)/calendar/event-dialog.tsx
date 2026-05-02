"use client";

import { useActionState, useEffect, useState } from "react";
import { X, Trash2, Loader2 } from "lucide-react";
import { createEvent, updateEvent, deleteEvent, type EventFormState } from "./actions";
import type { Tables } from "@/lib/supabase/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type EventItem = Pick<
  Tables<"events">,
  "id" | "title" | "start_at" | "end_at" | "all_day" | "type" | "customer_id" | "project_id" | "description" | "location"
>;

type CustomerOption = { id: string; name: string };
type ProjectOption = { id: string; name: string; customer_id: string | null };

type Props = {
  mode: "create" | "edit";
  initialDate?: string; // YYYY-MM-DD
  event?: EventItem;
  customers: CustomerOption[];
  projects: ProjectOption[];
  onClose: () => void;
  onSaved: () => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  meeting: "פגישה",
  call: "שיחה",
  deadline: "דדליין",
  other: "אחר",
};

function toLocalDatetime(isoStr: string): string {
  // Convert "2026-05-02T14:00:00+00:00" → "2026-05-02T17:00" (local input format)
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDate(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultStart(date?: string): string {
  if (date) return `${date}T09:00`;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T09:00`;
}

function defaultEnd(date?: string): string {
  if (date) return `${date}T10:00`;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T10:00`;
}

// ─── Component ───────────────────────────────────────────────────────────────

const INITIAL_STATE: EventFormState = {};

export function EventDialog({ mode, initialDate, event, customers, projects, onClose, onSaved }: Props) {
  const isEdit = mode === "edit" && !!event;

  const boundAction = isEdit
    ? updateEvent.bind(null, event.id)
    : createEvent;

  const [state, formAction, isPending] = useActionState(boundAction, INITIAL_STATE);

  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [selectedCustomer, setSelectedCustomer] = useState(event?.customer_id ?? "");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (state.success) {
      onSaved();
    }
  }, [state.success, onSaved]);

  const filteredProjects = selectedCustomer
    ? projects.filter((p) => p.customer_id === selectedCustomer)
    : projects;

  async function handleDelete() {
    if (!event) return;
    if (!confirm("למחוק את האירוע?")) return;
    setIsDeleting(true);
    const result = await deleteEvent(event.id);
    setIsDeleting(false);
    if (!result.error) onSaved();
  }

  const startVal = isEdit
    ? (allDay ? toLocalDate(event.start_at) : toLocalDatetime(event.start_at))
    : defaultStart(initialDate);

  const endVal = isEdit
    ? (allDay ? toLocalDate(event.end_at) : toLocalDatetime(event.end_at))
    : defaultEnd(initialDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-cream-paper shadow-xl border border-ink-line">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-line px-5 py-4">
          <h2 className="text-[15px] font-semibold text-navy">
            {isEdit ? "עריכת אירוע" : "אירוע חדש"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-soft hover:bg-cream-deep transition-colors"
            aria-label="סגור"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form action={formAction} className="px-5 py-4 space-y-4">
          {/* Hidden all_day for form submission */}
          <input type="hidden" name="all_day" value={String(allDay)} />

          {/* Title */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-soft">
              כותרת <span className="text-rose-500">*</span>
            </label>
            <input
              name="title"
              defaultValue={event?.title ?? ""}
              required
              className="w-full rounded-lg border border-ink-line bg-cream-deep px-3 py-2 text-[13px] text-navy placeholder:text-ink-faded focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30"
              placeholder="שם האירוע"
            />
            {state.fieldErrors?.title && (
              <p className="mt-1 text-[11px] text-rose-500">{state.fieldErrors.title[0]}</p>
            )}
          </div>

          {/* All day toggle */}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-ink-line accent-navy"
            />
            <span className="text-[13px] text-ink-soft">כל היום</span>
          </label>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-soft">
                התחלה <span className="text-rose-500">*</span>
              </label>
              <input
                name="start_at"
                type={allDay ? "date" : "datetime-local"}
                defaultValue={startVal}
                required
                className="w-full rounded-lg border border-ink-line bg-cream-deep px-3 py-2 text-[13px] text-navy focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30"
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-soft">
                סיום <span className="text-rose-500">*</span>
              </label>
              <input
                name="end_at"
                type={allDay ? "date" : "datetime-local"}
                defaultValue={endVal}
                required
                className="w-full rounded-lg border border-ink-line bg-cream-deep px-3 py-2 text-[13px] text-navy focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30"
                dir="ltr"
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-soft">סוג</label>
            <select
              name="type"
              defaultValue={event?.type ?? "meeting"}
              className="w-full rounded-lg border border-ink-line bg-cream-deep px-3 py-2 text-[13px] text-navy focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30"
            >
              {Object.entries(EVENT_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Customer */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-soft">לקוח</label>
            <select
              name="customer_id"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full rounded-lg border border-ink-line bg-cream-deep px-3 py-2 text-[13px] text-navy focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30"
            >
              <option value="">— ללא לקוח —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-soft">פרויקט</label>
            <select
              name="project_id"
              defaultValue={event?.project_id ?? ""}
              className="w-full rounded-lg border border-ink-line bg-cream-deep px-3 py-2 text-[13px] text-navy focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30"
            >
              <option value="">— ללא פרויקט —</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-soft">מיקום</label>
            <input
              name="location"
              defaultValue={event?.location ?? ""}
              className="w-full rounded-lg border border-ink-line bg-cream-deep px-3 py-2 text-[13px] text-navy placeholder:text-ink-faded focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30"
              placeholder="כתובת / קישור Zoom"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-soft">תיאור</label>
            <textarea
              name="description"
              defaultValue={event?.description ?? ""}
              rows={2}
              className="w-full rounded-lg border border-ink-line bg-cream-deep px-3 py-2 text-[13px] text-navy placeholder:text-ink-faded focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30 resize-none"
              placeholder="פרטים נוספים"
            />
          </div>

          {/* Server error */}
          {state.error && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-600">{state.error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                מחק
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-ink-line px-4 py-2 text-[12px] font-medium text-ink-soft hover:bg-cream-deep transition-colors"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-[12px] font-medium text-white hover:bg-navy/90 transition-colors disabled:opacity-60"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isEdit ? "שמור שינויים" : "צור אירוע"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
