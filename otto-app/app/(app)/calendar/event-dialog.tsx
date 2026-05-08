"use client";

import { useActionState, useEffect, useState } from "react";
import { X, Trash2, Loader2, Video } from "lucide-react";
import { createEvent, updateEvent, deleteEvent, type EventFormState } from "./actions";
import type { Tables } from "@/lib/supabase/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type EventItem = Pick<
  Tables<"events">,
  | "id"
  | "title"
  | "start_at"
  | "end_at"
  | "all_day"
  | "type"
  | "customer_id"
  | "project_id"
  | "description"
  | "location"
  | "meeting_url"
> & {
  guests?: { email: string; name: string | null }[];
};

type CustomerOption = { id: string; name: string; email: string | null };
type ProjectOption = { id: string; name: string; customer_id: string | null };

type Props = {
  mode: "create" | "edit";
  initialDate?: string; // YYYY-MM-DD
  initialHour?: number;
  initialEndHour?: number;
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

function defaultStart(date?: string, hour?: number): string {
  const h = hour ?? 9;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (date) return `${date}T${pad(h)}:00`;
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(h)}:00`;
}

function defaultEnd(date?: string, hour?: number, endHour?: number): string {
  const h = endHour ?? (hour ?? 9) + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (date) return `${date}T${pad(h)}:00`;
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(h)}:00`;
}

// ─── Component ───────────────────────────────────────────────────────────────

const INITIAL_STATE: EventFormState = {};

export function EventDialog({
  mode,
  initialDate,
  initialHour,
  initialEndHour,
  event,
  customers,
  projects,
  onClose,
  onSaved,
}: Props) {
  const isEdit = mode === "edit" && !!event;

  const boundAction = isEdit ? updateEvent.bind(null, event.id) : createEvent;

  const [state, formAction, isPending] = useActionState(boundAction, INITIAL_STATE);

  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [selectedCustomer, setSelectedCustomer] = useState(event?.customer_id ?? "");
  const [isDeleting, setIsDeleting] = useState(false);
  const [createMeet, setCreateMeet] = useState(false);
  const [guestInput, setGuestInput] = useState("");
  const [guests, setGuests] = useState<string[]>(event?.guests?.map((g) => g.email) ?? []);

  const startVal = isEdit
    ? event.all_day
      ? toLocalDate(event.start_at)
      : toLocalDatetime(event.start_at)
    : defaultStart(initialDate, initialHour);

  const endVal = isEdit
    ? event.all_day
      ? toLocalDate(event.end_at)
      : toLocalDatetime(event.end_at)
    : defaultEnd(initialDate, initialHour, initialEndHour);

  const [startLocal, setStartLocal] = useState(startVal);
  const [endLocal, setEndLocal] = useState(endVal);

  // When toggling all-day, adjust the local value format
   
  useEffect(() => {
    if (allDay) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStartLocal((p) => p.slice(0, 10));
       
      setEndLocal((p) => p.slice(0, 10));
    } else {
       
      setStartLocal((p) => (p.length === 10 ? `${p}T09:00` : p));
       
      setEndLocal((p) => (p.length === 10 ? `${p}T10:00` : p));
    }
  }, [allDay]);

  useEffect(() => {
    if (state.success) {
      onSaved();
    }
  }, [state.success, onSaved]);

  const filteredProjects = selectedCustomer
    ? projects.filter((p) => p.customer_id === selectedCustomer)
    : projects;

  // Convert local datetime string to UTC ISO (for timed events)
  function toUtcIso(local: string): string {
    if (!local) return "";
    const d = new Date(local);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  }

  async function handleDelete() {
    if (!event) return;
    if (!confirm("למחוק את האירוע?")) return;
    setIsDeleting(true);
    const result = await deleteEvent(event.id);
    setIsDeleting(false);
    if (!result.error) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="bg-cream-paper border-ink-line w-full max-w-lg rounded-xl border shadow-xl">
        {/* Header */}
        <div className="border-ink-line flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-navy text-[15px] font-semibold">
            {isEdit ? "עריכת אירוע" : "אירוע חדש"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-soft hover:bg-cream-deep flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            aria-label="סגור"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-4 px-5 py-4">
          {/* Hidden inputs for form submission */}
          <input type="hidden" name="all_day" value={String(allDay)} />
          <input type="hidden" name="create_meet" value={String(createMeet)} />
          <input type="hidden" name="start_at" value={allDay ? startLocal : toUtcIso(startLocal)} />
          <input type="hidden" name="end_at" value={allDay ? endLocal : toUtcIso(endLocal)} />
          {guests.map((email, i) => (
            <input key={i} type="hidden" name="guests" value={email} />
          ))}

          {/* Title */}
          <div>
            <label className="text-ink-soft mb-1 block text-[12px] font-medium">
              כותרת <span className="text-rose-500">*</span>
            </label>
            <input
              name="title"
              defaultValue={event?.title ?? ""}
              required
              className="border-ink-line bg-cream-deep text-navy placeholder:text-ink-faded focus:border-navy focus:ring-navy/30 w-full rounded-lg border px-3 py-2 text-[13px] focus:ring-1 focus:outline-none"
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
              className="border-ink-line accent-navy h-4 w-4 rounded"
            />
            <span className="text-ink-soft text-[13px]">כל היום</span>
          </label>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-ink-soft mb-1 block text-[12px] font-medium">
                התחלה <span className="text-rose-500">*</span>
              </label>
              <input
                key={allDay ? "start-date" : "start-datetime"}
                type={allDay ? "date" : "datetime-local"}
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                required
                className="border-ink-line bg-cream-deep text-navy focus:border-navy focus:ring-navy/30 w-full rounded-lg border px-3 py-2 text-[13px] focus:ring-1 focus:outline-none"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-ink-soft mb-1 block text-[12px] font-medium">
                סיום <span className="text-rose-500">*</span>
              </label>
              <input
                key={allDay ? "end-date" : "end-datetime"}
                type={allDay ? "date" : "datetime-local"}
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                required
                className="border-ink-line bg-cream-deep text-navy focus:border-navy focus:ring-navy/30 w-full rounded-lg border px-3 py-2 text-[13px] focus:ring-1 focus:outline-none"
                dir="ltr"
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="text-ink-soft mb-1 block text-[12px] font-medium">סוג</label>
            <select
              name="type"
              defaultValue={event?.type ?? "meeting"}
              className="border-ink-line bg-cream-deep text-navy focus:border-navy focus:ring-navy/30 w-full rounded-lg border px-3 py-2 text-[13px] focus:ring-1 focus:outline-none"
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
            <label className="text-ink-soft mb-1 block text-[12px] font-medium">לקוח</label>
            <select
              name="customer_id"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="border-ink-line bg-cream-deep text-navy focus:border-navy focus:ring-navy/30 w-full rounded-lg border px-3 py-2 text-[13px] focus:ring-1 focus:outline-none"
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
            <label className="text-ink-soft mb-1 block text-[12px] font-medium">פרויקט</label>
            <select
              name="project_id"
              defaultValue={event?.project_id ?? ""}
              className="border-ink-line bg-cream-deep text-navy focus:border-navy focus:ring-navy/30 w-full rounded-lg border px-3 py-2 text-[13px] focus:ring-1 focus:outline-none"
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
            <label className="text-ink-soft mb-1 block text-[12px] font-medium">מיקום</label>
            <input
              name="location"
              defaultValue={event?.location ?? ""}
              className="border-ink-line bg-cream-deep text-navy placeholder:text-ink-faded focus:border-navy focus:ring-navy/30 w-full rounded-lg border px-3 py-2 text-[13px] focus:ring-1 focus:outline-none"
              placeholder="כתובת / קישור Zoom"
            />
          </div>

          {/* Google Meet */}
          {event?.meeting_url ? (
            <div>
              <label className="text-ink-soft mb-1 block text-[12px] font-medium">
                קישור Google Meet
              </label>
              <a
                href={event.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-navy flex items-center gap-1.5 text-[13px] underline"
                dir="ltr"
              >
                <Video className="h-3.5 w-3.5 shrink-0" />
                {event.meeting_url}
              </a>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={createMeet}
                onChange={(e) => setCreateMeet(e.target.checked)}
                className="border-ink-line accent-navy h-4 w-4 rounded"
              />
              <span className="text-ink-soft text-[13px]">הוסף קישור Google Meet</span>
            </label>
          )}

          {/* Guests */}
          <div>
            <label className="text-ink-soft mb-1 block text-[12px] font-medium">אורחים</label>

            {/* Customer email shortcut */}
            {(() => {
              const customer = customers.find((c) => c.id === selectedCustomer);
              if (!customer?.email || guests.includes(customer.email)) return null;
              return (
                <button
                  type="button"
                  onClick={() => setGuests((prev) => [...prev, customer.email!])}
                  className="text-navy mb-2 text-[12px] underline hover:opacity-70"
                >
                  + הוסף {customer.name}
                </button>
              );
            })()}

            {/* Guest list */}
            {guests.length > 0 && (
              <div className="mb-2 space-y-1">
                {guests.map((email) => (
                  <div
                    key={email}
                    className="border-ink-line bg-cream-deep flex items-center justify-between rounded-md border px-2 py-1"
                  >
                    <span className="text-navy text-[12px]" dir="ltr">
                      {email}
                    </span>
                    <button
                      type="button"
                      onClick={() => setGuests((prev) => prev.filter((e) => e !== email))}
                      className="text-ink-soft ms-2 hover:text-rose-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add input */}
            <div className="flex gap-2">
              <input
                type="email"
                value={guestInput}
                onChange={(e) => setGuestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (guestInput && !guests.includes(guestInput)) {
                      setGuests((prev) => [...prev, guestInput]);
                      setGuestInput("");
                    }
                  }
                }}
                placeholder="אימייל אורח"
                className="border-ink-line bg-cream-deep text-navy placeholder:text-ink-faded focus:border-navy focus:ring-navy/30 w-full rounded-lg border px-3 py-2 text-[13px] focus:ring-1 focus:outline-none"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => {
                  if (guestInput && !guests.includes(guestInput)) {
                    setGuests((prev) => [...prev, guestInput]);
                    setGuestInput("");
                  }
                }}
                className="border-ink-line text-ink-soft hover:bg-cream-deep rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-ink-soft mb-1 block text-[12px] font-medium">תיאור</label>
            <textarea
              name="description"
              defaultValue={event?.description ?? ""}
              rows={2}
              className="border-ink-line bg-cream-deep text-navy placeholder:text-ink-faded focus:border-navy focus:ring-navy/30 w-full resize-none rounded-lg border px-3 py-2 text-[13px] focus:ring-1 focus:outline-none"
              placeholder="פרטים נוספים"
            />
          </div>

          {/* Server error */}
          {state.error && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
              {state.error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-50"
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
                className="border-ink-line text-ink-soft hover:bg-cream-deep rounded-lg border px-4 py-2 text-[12px] font-medium transition-colors"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-navy hover:bg-navy/90 flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium text-white transition-colors disabled:opacity-60"
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
