"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, RotateCcw, X } from "lucide-react";
import { useTimerStore } from "@/lib/stores/timer";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { createTimeEntryFromTimer } from "@/app/(app)/time/actions";

interface CustomerOpt {
  id: string;
  name: string;
}
interface ProjectOpt {
  id: string;
  name: string;
  customer_id: string | null;
}

function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TodayTimerSection() {
  const isRunning = useTimerStore((s) => s.isRunning);
  const startTime = useTimerStore((s) => s.startTime);
  const customerId = useTimerStore((s) => s.customerId);
  const projectId = useTimerStore((s) => s.projectId);
  const notes = useTimerStore((s) => s.notes);
  const recentRuns = useTimerStore((s) => s.recentRuns);
  const start = useTimerStore((s) => s.start);
  const stop = useTimerStore((s) => s.stop);
  const updateContext = useTimerStore((s) => s.updateContext);
  const saveRecentRun = useTimerStore((s) => s.saveRecentRun);
  const loadRecentRun = useTimerStore((s) => s.loadRecentRun);
  const reset = useTimerStore((s) => s.reset);

  const [mounted, setMounted] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [localCustomerId, setLocalCustomerId] = useState(customerId ?? "");
  const [localProjectId, setLocalProjectId] = useState(projectId ?? "");
  const [localNotes, setLocalNotes] = useState(notes ?? "");

  const toast = useToast();
  const fetchedRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void (async () => {
      const supabase = createClient();
      const [c, p] = await Promise.all([
        supabase.from("customers").select("id, name").order("name"),
        supabase
          .from("projects")
          .select("id, name, customer_id")
          .is("deleted_at", null)
          .order("name"),
      ]);
      setCustomers(c.data ?? []);
      setProjects(p.data ?? []);
    })();
  }, []);

  const elapsed = useMemo(() => {
    if (!startTime) return 0;
    return now - new Date(startTime).getTime();
  }, [now, startTime]);

  const filteredProjects = useMemo(
    () => (localCustomerId ? projects.filter((p) => p.customer_id === localCustomerId) : projects),
    [projects, localCustomerId],
  );

  const customerName = customerId ? customers.find((c) => c.id === customerId)?.name : null;
  const projectName = projectId ? projects.find((p) => p.id === projectId)?.name : null;

  const handleStart = () => {
    start({
      customerId: localCustomerId || null,
      projectId: localProjectId || null,
      taskId: null,
      notes: localNotes,
    });
  };

  const handleStop = async () => {
    setStopping(true);
    const snapshot = stop();
    if (!snapshot) {
      setStopping(false);
      return;
    }
    // שמור הרצה אחרונה
    if (snapshot.ctx.customerId) {
      saveRecentRun({
        customerId: snapshot.ctx.customerId,
        projectId: snapshot.ctx.projectId,
        taskId: snapshot.ctx.taskId,
        notes: snapshot.ctx.notes,
        customerName: customers.find((c) => c.id === snapshot.ctx.customerId)?.name ?? null,
        projectName: projects.find((p) => p.id === snapshot.ctx.projectId)?.name ?? null,
        taskName: null,
      });
    }
    const res = await createTimeEntryFromTimer({
      customer_id: snapshot.ctx.customerId,
      project_id: snapshot.ctx.projectId,
      task_id: snapshot.ctx.taskId,
      start_time: snapshot.startTime,
      end_time: snapshot.endTime,
      notes: snapshot.ctx.notes || null,
      billable: true,
    });
    setStopping(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`נשמרו ${res.durationMinutes ?? 0} דקות`);
    // איפוס שדות
    setLocalCustomerId("");
    setLocalProjectId("");
    setLocalNotes("");
  };

  const handleLoadRecent = (run: (typeof recentRuns)[0]) => {
    loadRecentRun(run);
    setLocalCustomerId(run.customerId ?? "");
    setLocalProjectId(run.projectId ?? "");
    setLocalNotes(run.notes ?? "");
  };

  if (!mounted) return null;

  return (
    <div className="bg-cream-paper shadow-card space-y-4 rounded-2xl p-5">
      {/* טיימר ראשי */}
      <div className="flex flex-col items-center gap-3">
        <div
          className={`font-mono text-5xl font-bold tracking-tight tabular-nums ${isRunning ? "text-navy" : "text-ink-faded"}`}
          dir="ltr"
        >
          {formatHMS(elapsed)}
        </div>
        {isRunning && (
          <div className="text-ink-soft text-center text-sm">
            {customerName ?? "ללא לקוח"}
            {projectName ? ` · ${projectName}` : ""}
            {notes ? ` · ${notes}` : ""}
          </div>
        )}
      </div>

      {/* שדות בחירה (מוסתרים כשרץ) */}
      {!isRunning && (
        <div className="space-y-2">
          <select
            value={localCustomerId}
            onChange={(e) => {
              setLocalCustomerId(e.target.value);
              setLocalProjectId("");
              updateContext({ customerId: e.target.value || null, projectId: null });
            }}
            className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
          >
            <option value="">בחר לקוח</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={localProjectId}
            onChange={(e) => {
              setLocalProjectId(e.target.value);
              updateContext({ projectId: e.target.value || null });
            }}
            disabled={!localCustomerId}
            className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none disabled:opacity-40"
          >
            <option value="">בחר פרויקט</option>
            {filteredProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={localNotes}
            onChange={(e) => {
              setLocalNotes(e.target.value);
              updateContext({ notes: e.target.value });
            }}
            placeholder="הערות (אופציונלי)"
            className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
          />
        </div>
      )}

      {/* כפתורי הפעלה/עצירה/ביטול */}
      <div className={`flex gap-2 ${isRunning ? "" : ""}`}>
        <button
          type="button"
          onClick={isRunning ? handleStop : handleStart}
          disabled={stopping}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold transition-colors disabled:opacity-60 ${
            isRunning
              ? "bg-rose-600 text-white hover:bg-rose-700"
              : "bg-navy text-cream-paper hover:bg-navy/90"
          }`}
        >
          {stopping ? (
            <Spinner size={18} />
          ) : isRunning ? (
            <>
              <Square size={16} fill="currentColor" />
              עצור וסגור
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" />
              התחל טיימר
            </>
          )}
        </button>

        {isRunning && (
          <button
            type="button"
            onClick={() => {
              if (confirm("לבטל את הטיימר ללא שמירה?")) {
                reset();
                setLocalCustomerId("");
                setLocalProjectId("");
                setLocalNotes("");
              }
            }}
            disabled={stopping}
            aria-label="בטל ללא שמירה"
            title="בטל ללא שמירה"
            className="border-ink-line text-ink-soft flex items-center justify-center rounded-xl border px-4 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* הרצות אחרונות */}
      {!isRunning && recentRuns.length > 0 && (
        <div>
          <p className="text-ink-faded mb-2 text-xs font-medium">המשך מהפעם האחרונה</p>
          <div className="space-y-1.5">
            {recentRuns.slice(0, 5).map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => handleLoadRecent(run)}
                className="border-ink-line hover:border-navy/30 flex w-full items-center gap-2 rounded-xl border bg-white/60 px-3 py-2.5 text-start text-sm transition-colors hover:bg-white"
              >
                <RotateCcw size={13} className="text-ink-faded shrink-0" />
                <span className="text-navy truncate font-medium">
                  {run.customerName ?? "ללא לקוח"}
                  {run.projectName ? ` · ${run.projectName}` : ""}
                </span>
                {run.notes && (
                  <span className="text-ink-faded ms-auto max-w-[80px] shrink-0 truncate text-xs">
                    {run.notes}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
