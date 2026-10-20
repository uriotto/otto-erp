"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ActiveTimer,
  SavedTimeEntry,
  TimerResult,
  TimerSnapshot,
  TimerHistoryPage,
} from "@/lib/desktop-timer";
import {
  cancelDesktopTimer,
  getTimerSnapshot,
  getDesktopTimerHistory,
  startDesktopTimer,
  stopDesktopTimer,
  updateDesktopTimer,
} from "./actions";
import { EntryEditor } from "./entry-editor";
import {
  TimerFields,
  isClosedEntry,
  localDateTime,
  primaryClass,
  secondaryClass,
  type TimerDraft,
} from "./timer-fields";

type NativeWindow = Window & {
  webkit?: { messageHandlers?: { ottoTimer?: { postMessage: (message: unknown) => void } } };
};
const emptyDraft = (): TimerDraft => ({ customer_id: "", notes: "", started_at: "" });
const draftFrom = (active: ActiveTimer | null): TimerDraft =>
  active
    ? {
        customer_id: active.customer_id ?? "",
        notes: active.notes ?? "",
        started_at: localDateTime(active.started_at),
      }
    : emptyDraft();

function acknowledgeReminder() {
  try {
    (window as NativeWindow).webkit?.messageHandlers?.ottoTimer?.postMessage({
      type: "reminder-ack",
    });
  } catch {
    /* Browser use does not need a native bridge. */
  }
}

function elapsedLabel(start: string | undefined, now: number) {
  const seconds = start ? Math.max(0, Math.floor((now - new Date(start).getTime()) / 1000)) : 0;
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}

export function DesktopTimer() {
  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(null);
  const [draft, setDraft] = useState<TimerDraft>(emptyDraft);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reminder, setReminder] = useState(false);
  const [now, setNow] = useState(0);
  const [editing, setEditing] = useState<SavedTimeEntry | null>(null);
  const [history, setHistory] = useState<TimerHistoryPage | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const historyRequestRef = useRef(0);
  const historyBusyRef = useRef(false);
  const dirtyRef = useRef(false);
  const busyRef = useRef(false);
  const [base, setBase] = useState<ActiveTimer | null>(null);
  const requestRef = useRef(0);
  const stopAttemptRef = useRef<{ sessionId: string; endTime: string } | null>(null);
  const mountedRef = useRef(true);

  const acceptSnapshot = useCallback((next: TimerSnapshot, resetDraft: boolean) => {
    setSnapshot(next);
    setNow(Date.now());
    if (resetDraft || !dirtyRef.current) {
      setDraft(draftFrom(next.active));
      setBase(next.active);
      dirtyRef.current = false;
      setDirty(false);
      if (resetDraft || stopAttemptRef.current?.sessionId !== next.active?.session_id) {
        stopAttemptRef.current = null;
      }
    }
    const customerName =
      next.customers.find((customer) => customer.id === next.active?.customer_id)?.name ?? null;
    try {
      (window as NativeWindow).webkit?.messageHandlers?.ottoTimer?.postMessage({
        active: !!next.active,
        sessionId: next.active?.session_id ?? null,
        startedAt: next.active?.started_at ?? null,
        customerName,
        syncedAt: Date.now(),
      });
    } catch {
      /* The page also works in a regular browser. */
    }
  }, []);

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    const request = ++requestRef.current;
    try {
      const result = await getTimerSnapshot();
      if (!mountedRef.current || request !== requestRef.current) return;
      if (result.error || !result.snapshot) setError(result.error ?? "לא ניתן לטעון את הדיווחים");
      else {
        acceptSnapshot(result.snapshot, false);
        setError("");
      }
    } catch {
      if (mountedRef.current && request === requestRef.current)
        setError("אין חיבור למערכת. השינויים שלך נשארו כאן.");
    }
  }, [acceptSnapshot]);

  useEffect(() => {
    mountedRef.current = true;
    const initialLoad = setTimeout(() => {
      void refresh();
    }, 0);
    const poll = setInterval(() => {
      void refresh();
    }, 15000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const handleReminder = () => setReminder(true);
    window.addEventListener("otto:reminder", handleReminder);
    return () => {
      mountedRef.current = false;
      clearTimeout(initialLoad);
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener("otto:reminder", handleReminder);
    };
  }, [refresh]);

  async function mutate(action: () => Promise<TimerResult>, message: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    requestRef.current++;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (!mountedRef.current) return;
      if (result.error) setError(result.error);
      else if (!result.snapshot)
        setError("לא התקבל אישור שמירה. יש לרענן ולבדוק לפני ניסיון נוסף.");
      else {
        acceptSnapshot(result.snapshot, true);
        const recent = result.snapshot.entries;
        setHistory((previous) =>
          previous
            ? {
                ...previous,
                entries: [
                  ...recent,
                  ...previous.entries.filter(
                    (entry) => !recent.some((next) => next.id === entry.id),
                  ),
                ],
              }
            : null,
        );
        setNotice(message);
        setReminder(false);
        acknowledgeReminder();
      }
    } catch {
      if (mountedRef.current)
        setError("לא התקבל אישור מהמערכת. השינויים שלך נשארו כאן. אפשר לרענן ולבדוק או לנסות שוב.");
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  const active = snapshot?.active;
  const changedElsewhere =
    dirty && (base?.session_id !== active?.session_id || base?.revision !== active?.revision);
  function changeDraft(value: TimerDraft) {
    dirtyRef.current = true;
    setDirty(true);
    setDraft(value);
    setNotice("");
  }
  async function loadHistory(more = false) {
    if (historyBusyRef.current || busyRef.current) return;
    if (editing) {
      if (!window.confirm("לעבור בהיסטוריה ולוותר על שינויים שטרם נשמרו בדיווח?")) return;
      setEditing(null);
    }
    historyBusyRef.current = true;
    busyRef.current = true;
    requestRef.current++;
    setBusy(true);
    setHistoryBusy(true);
    setHistoryError("");
    const request = ++historyRequestRef.current;
    try {
      const result = await getDesktopTimerHistory(
        more ? (history?.cursor ?? undefined) : undefined,
      );
      if (!mountedRef.current || request !== historyRequestRef.current) return;
      if (result.error || !result.page) {
        setHistoryError(result.error ?? "לא ניתן לטעון דיווחים קודמים");
      } else {
        const page = result.page;
        setHistory((previous) => ({
          ...page,
          entries:
            more && previous
              ? [
                  ...previous.entries,
                  ...page.entries.filter(
                    (entry) => !previous.entries.some((old) => old.id === entry.id),
                  ),
                ]
              : page.entries,
        }));
      }
    } catch {
      if (mountedRef.current && request === historyRequestRef.current)
        setHistoryError("אין חיבור למערכת. אפשר לנסות לטעון שוב.");
    } finally {
      historyBusyRef.current = false;
      busyRef.current = false;
      if (mountedRef.current) {
        setHistoryBusy(false);
        setBusy(false);
      }
    }
  }
  function repeatEntry(entry: SavedTimeEntry) {
    if (busyRef.current || active || changedElsewhere) return;
    if (dirty && !window.confirm("להתחיל עם פרטי הדיווח הקודם במקום הטיוטה שבטיימר?")) return;
    void mutate(
      () =>
        startDesktopTimer({
          customer_id: entry.customer_id,
          notes: entry.notes ?? "",
          project_id: entry.project_id,
          task_id: entry.task_id,
        }),
      "התחיל דיווח חדש עם פרטי הדיווח הקודם",
    );
  }
  function activeInput() {
    if (!base || !active || base.session_id !== active.session_id) {
      setError("הטיימר השתנה ממכשיר אחר. יש לטעון את הפרטים העדכניים.");
      return null;
    }
    const started = new Date(draft.started_at);
    // Called only by click handlers; validate against the time of the action.
    // eslint-disable-next-line react-hooks/purity
    if (!Number.isFinite(started.getTime()) || started.getTime() > Date.now()) {
      setError("יש להזין שעת התחלה תקינה שאינה בעתיד");
      return null;
    }
    return {
      session_id: base.session_id,
      revision: base.revision,
      customer_id: draft.customer_id || null,
      notes: draft.notes,
      started_at:
        draft.started_at === localDateTime(base.started_at)
          ? base.started_at
          : started.toISOString(),
    };
  }
  function stop() {
    const input = activeInput();
    if (input) {
      if (stopAttemptRef.current?.sessionId !== input.session_id)
        stopAttemptRef.current = { sessionId: input.session_id, endTime: new Date().toISOString() };
      const end_time = stopAttemptRef.current.endTime;
      void mutate(() => stopDesktopTimer({ ...input, end_time }), "הדיווח נשמר והטיימר נעצר");
    }
  }

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-screen w-full max-w-[420px] bg-[#f7f8fa] p-4 text-slate-900"
    >
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-[#003f7c]">
          OTTO <span className="font-medium text-slate-600">| דיווח שעות</span>
        </h1>
        <button
          type="button"
          className="text-sm font-semibold text-[#003f7c] disabled:opacity-50"
          disabled={busy}
          onClick={() => void refresh()}
        >
          רענון
        </button>
      </header>
      {error && (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {!snapshot ? (
        <p role="status" className="py-12 text-center text-sm text-slate-500">
          {error ? "אפשר לנסות שוב באמצעות רענון" : "טוען את הטיימר..."}
        </p>
      ) : (
        <>
          {reminder && active && (
            <aside
              aria-label="תזכורת טיימר"
              className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3"
            >
              <p className="text-sm font-bold">הטיימר עדיין רץ. עדיין עובדים?</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className={primaryClass} disabled={busy} onClick={stop}>
                  עצירה ושמירה
                </button>
                <button
                  type="button"
                  className={secondaryClass}
                  onClick={() => {
                    setReminder(false);
                    acknowledgeReminder();
                  }}
                >
                  כן, ממשיכים
                </button>
              </div>
            </aside>
          )}
          <section
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            aria-label="טיימר"
          >
            <div className="mb-4 text-center">
              <p className="mb-1 text-xs font-semibold text-slate-500">
                {active ? "הטיימר פועל" : "מוכנים להתחיל"}
              </p>
              <p
                dir="ltr"
                aria-label="זמן שחלף"
                className="font-mono text-4xl font-semibold text-[#003f7c] tabular-nums"
              >
                {elapsedLabel(active?.started_at, now)}
              </p>
              {active && (
                <p className="mt-1 text-sm text-slate-600">
                  {snapshot.customers.find((customer) => customer.id === active.customer_id)
                    ?.name ?? "ללא שיוך ללקוח"}
                </p>
              )}
            </div>
            {changedElsewhere && (
              <p role="alert" className="mb-3 text-sm text-amber-800">
                הטיימר עודכן ממקום אחר. הטיוטה שלך נשמרה כאן. יש לטעון את הפרטים העדכניים לפני
                שמירה.
              </p>
            )}
            <fieldset disabled={busy}>
              <TimerFields
                prefix="active"
                customers={snapshot.customers}
                draft={draft}
                onChange={changeDraft}
                showStart={!!active}
              />
            </fieldset>
            <div className="mt-4 flex flex-wrap gap-2">
              {active ? (
                <>
                  <button
                    type="button"
                    className={primaryClass}
                    disabled={busy || changedElsewhere}
                    onClick={stop}
                  >
                    {busy ? "מעדכן..." : "עצירה ושמירה"}
                  </button>
                  {dirty && (
                    <button
                      type="button"
                      className={secondaryClass}
                      disabled={busy || changedElsewhere}
                      onClick={() => {
                        const input = activeInput();
                        if (input)
                          void mutate(
                            () => updateDesktopTimer(input),
                            "השינויים נשמרו. הטיימר ממשיך לרוץ",
                          );
                      }}
                    >
                      שמירת שינויים
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-xl px-2 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                    disabled={busy || changedElsewhere}
                    onClick={() => {
                      if (
                        !window.confirm("לבטל את הטיימר ללא שמירה? הזמן שנמדד לא יתווסף לדיווחים.")
                      )
                        return;
                      if (base)
                        void mutate(
                          () =>
                            cancelDesktopTimer({
                              session_id: base.session_id,
                              revision: base.revision,
                            }),
                          "הטיימר בוטל ללא שמירה",
                        );
                    }}
                  >
                    ביטול ללא שמירה
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={`${primaryClass} w-full`}
                  disabled={busy || changedElsewhere}
                  onClick={() =>
                    void mutate(
                      () =>
                        startDesktopTimer({
                          customer_id: draft.customer_id || null,
                          notes: draft.notes,
                        }),
                      "הטיימר התחיל",
                    )
                  }
                >
                  {busy ? "מתחיל..." : "התחלת דיווח"}
                </button>
              )}
              {dirty && (
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs text-slate-600 underline"
                  onClick={() => {
                    if (window.confirm("לטעון את הפרטים מהמערכת ולוותר על השינויים שטרם נשמרו?")) {
                      acceptSnapshot(snapshot, true);
                      setError("");
                    }
                  }}
                >
                  טעינת הפרטים מהמערכת
                </button>
              )}
            </div>
          </section>
          <section aria-label="דיווחים אחרונים" className="mt-5">
            <h2 className="mb-2 text-sm font-bold">
              {history ? "היסטוריית דיווחים" : "דיווחים אחרונים"}
            </h2>
            {active && (
              <p className="mb-2 text-xs text-slate-500">
                כדי להתחיל שוב מדיווח קודם, יש לעצור קודם את הטיימר הפעיל.
              </p>
            )}
            {historyError && (
              <p role="alert" className="mb-2 text-sm text-red-700">
                {historyError}
              </p>
            )}
            {!(history?.entries ?? snapshot.entries).length && (
              <p className="py-3 text-sm text-slate-500">דיווחים שתשמרו יופיעו כאן.</p>
            )}
            <div className="space-y-2">
              {(history?.entries ?? snapshot.entries).map((entry) => (
                <article key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <button
                    type="button"
                    className="w-full text-start disabled:opacity-50"
                    disabled={busy || historyBusy}
                    onClick={() => {
                      if (editing?.id === entry.id) return;
                      if (
                        editing &&
                        editing.id !== entry.id &&
                        !window.confirm("לעבור לדיווח אחר ולוותר על שינויים שטרם נשמרו?")
                      )
                        return;
                      setEditing(entry);
                    }}
                    aria-label={`עריכת דיווח ${snapshot.customers.find((customer) => customer.id === entry.customer_id)?.name ?? "ללא לקוח"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold">
                        {snapshot.customers.find((customer) => customer.id === entry.customer_id)
                          ?.name ?? "ללא לקוח"}
                      </span>
                      <span className="shrink-0 text-sm font-semibold">
                        {entry.duration_minutes} דקות
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(entry.start_time).toLocaleString("he-IL", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                      {isClosedEntry(entry) ? " · חויב או נסגר, לצפייה בלבד" : " · עריכה"}
                    </p>
                    {entry.notes && (
                      <p className="mt-1 line-clamp-2 text-sm whitespace-pre-wrap text-slate-600">
                        {entry.notes}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`${secondaryClass} mt-2 text-sm`}
                    disabled={busy || !!active || changedElsewhere}
                    onClick={() => repeatEntry(entry)}
                  >
                    התחל שוב
                  </button>
                  {editing?.id === entry.id && (
                    <EntryEditor
                      key={entry.id}
                      entry={editing}
                      customers={snapshot.customers}
                      onClose={() => setEditing(null)}
                      onBusyChange={(value) => {
                        busyRef.current = value;
                        setBusy(value);
                        if (value) requestRef.current++;
                      }}
                      onSaved={(result, deleted) => {
                        if (result.snapshot) {
                          requestRef.current++;
                          acceptSnapshot(result.snapshot, false);
                          historyRequestRef.current++;
                          setHistory(null);
                          setHistoryError("");
                          setEditing(null);
                          setNotice(deleted ? "הדיווח נמחק" : "הדיווח עודכן");
                        }
                      }}
                    />
                  )}
                </article>
              ))}
            </div>
            {history && (
              <button
                type="button"
                className={`${secondaryClass} mt-3 w-full`}
                disabled={busy || historyBusy}
                onClick={() => void loadHistory()}
              >
                רענון היסטוריה
              </button>
            )}
            {(!history || history.hasMore) && (
              <button
                type="button"
                className={`${secondaryClass} mt-3 w-full`}
                disabled={busy || historyBusy}
                onClick={() => void loadHistory(!!history)}
              >
                {historyBusy ? "טוען דיווחים..." : history ? "טעינת דיווחים קודמים" : "כל הדיווחים"}
              </button>
            )}
          </section>
        </>
      )}
    </main>
  );
}
