"use client";

import { useState } from "react";
import type { SavedTimeEntry, TimerResult } from "@/lib/desktop-timer";
import { deleteDesktopEntry, updateDesktopEntry } from "./actions";
import {
  TimerFields,
  isClosedEntry,
  localDateTime,
  inputClass,
  primaryClass,
  secondaryClass,
} from "./timer-fields";

function durationParts(start: string, end: string) {
  const elapsed = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(elapsed) || elapsed <= 0) return { hours: "", minutes: "" };
  const minutes = Math.ceil(elapsed / 60_000);
  return { hours: String(Math.floor(minutes / 60)), minutes: String(minutes % 60) };
}

export function EntryEditor({
  entry,
  customers,
  onSaved,
  onClose,
  onBusyChange,
}: {
  entry: SavedTimeEntry;
  customers: { id: string; name: string }[];
  onSaved: (result: TimerResult, deleted?: boolean) => void;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState({
    customer_id: entry.customer_id ?? "",
    notes: entry.notes ?? "",
    started_at: localDateTime(entry.start_time),
  });
  const [end, setEnd] = useState(localDateTime(entry.end_time));
  const [duration, setDuration] = useState(() => durationParts(entry.start_time, entry.end_time));
  const [durationError, setDurationError] = useState("");
  const [durationEnd, setDurationEnd] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const readonly = isClosedEntry(entry);
  function startValue(value = draft.started_at) {
    return value === localDateTime(entry.start_time) ? entry.start_time : value;
  }
  function endValue(value = end) {
    return durationEnd ?? (value === localDateTime(entry.end_time) ? entry.end_time : value);
  }
  function changeDuration(next: typeof duration) {
    setDuration(next);
    const hours = Number(next.hours);
    const minutes = Number(next.minutes);
    if (
      next.hours.trim() === "" ||
      next.minutes.trim() === "" ||
      !Number.isSafeInteger(hours) ||
      !Number.isSafeInteger(minutes) ||
      hours < 0 ||
      minutes < 0 ||
      minutes > 59 ||
      hours * 60 + minutes <= 0
    ) {
      setDurationError("יש להזין משך חיובי בשעות ובדקות, עם דקות בין 0 ל-59");
      return;
    }
    const nextEnd = new Date(new Date(startValue()).getTime() + (hours * 60 + minutes) * 60_000);
    if (!Number.isFinite(nextEnd.getTime())) {
      setDurationError("יש להזין שעת התחלה ומשך תקינים");
      return;
    }
    setDurationError("");
    setDurationEnd(nextEnd.toISOString());
    setEnd(localDateTime(nextEnd.toISOString()));
  }
  async function removeEntry() {
    if (busy || readonly) return;
    if (
      !window.confirm(
        "למחוק את הדיווח? הפעולה אינה ניתנת לביטול. שעות שנוכו מבנק שעות יוחזרו אליו.",
      )
    )
      return;
    setError("");
    setBusy(true);
    onBusyChange(true);
    try {
      const result = await deleteDesktopEntry({ id: entry.id, edit_version: entry.edit_version });
      if (result.error) setError(result.error);
      else if (!result.snapshot)
        setError("לא התקבל אישור מחיקה. יש לרענן ולבדוק לפני ניסיון נוסף.");
      else onSaved(result, true);
    } catch {
      setError("לא התקבל אישור מהמערכת. יש לרענן ולבדוק אם הדיווח נמחק.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <form
      className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || readonly) return;
        setError("");
        if (durationError) {
          setError(durationError);
          return;
        }
        const startTime = new Date(startValue());
        const endTime = new Date(endValue());
        if (
          !Number.isFinite(startTime.getTime()) ||
          !Number.isFinite(endTime.getTime()) ||
          endTime <= startTime
        ) {
          setError("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
          return;
        }
        if (startTime.getTime() > Date.now() || endTime.getTime() > Date.now()) {
          setError("שעות ההתחלה והסיום לא יכולות להיות בעתיד");
          return;
        }
        setBusy(true);
        onBusyChange(true);
        try {
          const result = await updateDesktopEntry({
            id: entry.id,
            edit_version: entry.edit_version,
            customer_id: draft.customer_id || null,
            notes: draft.notes,
            start_time:
              draft.started_at === localDateTime(entry.start_time)
                ? entry.start_time
                : startTime.toISOString(),
            end_time:
              durationEnd ??
              (end === localDateTime(entry.end_time) ? entry.end_time : endTime.toISOString()),
          });
          if (result.error) setError(result.error);
          else if (!result.snapshot)
            setError("לא התקבל אישור עדכון. יש לרענן ולבדוק לפני ניסיון נוסף.");
          else onSaved(result);
        } catch {
          setError("לא התקבל אישור מהמערכת. השינויים שלך נשארו כאן. יש לבדוק לפני ניסיון נוסף.");
        } finally {
          setBusy(false);
          onBusyChange(false);
        }
      }}
    >
      <h3 className="mb-3 text-sm font-bold">עריכת דיווח</h3>
      {readonly && <p className="mb-3 text-sm">הדיווח כבר חויב או נסגר ולכן זמין לצפייה בלבד.</p>}
      <fieldset disabled={busy || readonly}>
        <TimerFields
          prefix={`entry-${entry.id}`}
          customers={customers}
          draft={draft}
          onChange={(next) => {
            if (next.started_at !== draft.started_at) {
              setDuration(durationParts(startValue(next.started_at), endValue()));
              setDurationError("");
            }
            setDraft(next);
          }}
        />
        <label className="mt-3 mb-1 block text-sm font-semibold" htmlFor={`end-${entry.id}`}>
          שעת סיום
        </label>
        <input
          id={`end-${entry.id}`}
          type="datetime-local"
          step="1"
          dir="ltr"
          required
          className={inputClass}
          value={end}
          onChange={(event) => {
            const next = event.target.value;
            setEnd(next);
            setDurationEnd(null);
            setDuration(
              durationParts(
                startValue(),
                next === localDateTime(entry.end_time) ? entry.end_time : next,
              ),
            );
            setDurationError("");
          }}
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor={`hours-${entry.id}`}>
              שעות
            </label>
            <input
              id={`hours-${entry.id}`}
              type="number"
              min="0"
              step="1"
              dir="ltr"
              className={inputClass}
              value={duration.hours}
              onChange={(event) => changeDuration({ ...duration, hours: event.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor={`minutes-${entry.id}`}>
              דקות
            </label>
            <input
              id={`minutes-${entry.id}`}
              type="number"
              min="0"
              max="59"
              step="1"
              dir="ltr"
              className={inputClass}
              value={duration.minutes}
              onChange={(event) => changeDuration({ ...duration, minutes: event.target.value })}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          המשך מוצג בדקות מעוגלות כלפי מעלה, כמו בחישוב הדיווח. שינוי המשך מעדכן את שעת הסיום ושומר
          על שעת ההתחלה.
        </p>
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!readonly && (
          <button className={primaryClass} disabled={busy} type="submit">
            {busy ? "שומר..." : "שמירת שינויים"}
          </button>
        )}
        {!readonly && (
          <button
            className={`${secondaryClass} text-red-700`}
            disabled={busy}
            type="button"
            onClick={removeEntry}
          >
            מחיקת דיווח
          </button>
        )}
        <button className={secondaryClass} disabled={busy} type="button" onClick={onClose}>
          סגירה
        </button>
      </div>
    </form>
  );
}
