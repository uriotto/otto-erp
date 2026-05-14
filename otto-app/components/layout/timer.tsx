"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, X, Check, RotateCcw, ChevronDown } from "lucide-react";
import { useTimerStore } from "@/lib/stores/timer";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { createTimeEntryFromTimer } from "@/app/(app)/time/actions";

type ActiveTimerRow = {
  user_id: string;
  tenant_id: string;
  customer_id: string | null;
  project_id: string | null;
  task_id: string | null;
  notes: string | null;
  started_at: string;
};

interface CustomerOpt {
  id: string;
  name: string;
}
interface ProjectOpt {
  id: string;
  name: string;
  customer_id: string | null;
}
interface TaskOpt {
  id: string;
  title: string;
  project_id: string | null;
}

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Timer() {
  const isRunning = useTimerStore((s) => s.isRunning);
  const startTime = useTimerStore((s) => s.startTime);
  const customerId = useTimerStore((s) => s.customerId);
  const projectId = useTimerStore((s) => s.projectId);
  const taskId = useTimerStore((s) => s.taskId);
  const notes = useTimerStore((s) => s.notes);
  const start = useTimerStore((s) => s.start);
  const stop = useTimerStore((s) => s.stop);
  const updateContext = useTimerStore((s) => s.updateContext);
  const reset = useTimerStore((s) => s.reset);
  const hydrateFromDB = useTimerStore((s) => s.hydrateFromDB);
  const saveRecentRun = useTimerStore((s) => s.saveRecentRun);
  const recentRuns = useTimerStore((s) => s.recentRuns);

  const [mounted, setMounted] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [tasks, setTasks] = useState<TaskOpt[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const recentRef = useRef<HTMLDivElement>(null);

  const toast = useToast();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Tick every second when running
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // Close popup on outside click
  useEffect(() => {
    if (!showAssign) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowAssign(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAssign]);

  // Close recent runs dropdown on outside click
  useEffect(() => {
    if (!showRecent) return;
    function handleClick(e: MouseEvent) {
      if (recentRef.current && !recentRef.current.contains(e.target as Node)) {
        setShowRecent(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showRecent]);

  // Hydrate active timer from DB + subscribe to changes.
  const userIdRef = useRef<string | null>(null);
  const tenantIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const [c, p, t, userResult] = await Promise.all([
        supabase.from("customers").select("id, name").order("name"),
        supabase
          .from("projects")
          .select("id, name, customer_id")
          .is("deleted_at", null)
          .order("name"),
        supabase.from("tasks").select("id, title, project_id").order("title"),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      setCustomers(c.data ?? []);
      setProjects(p.data ?? []);
      setTasks(t.data ?? []);

      const user = userResult.data.user;
      if (!user) return;
      userIdRef.current = user.id;

      const { data: profile } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile?.tenant_id) tenantIdRef.current = profile.tenant_id;

      const { data: row } = await supabase
        .from("active_timers")
        .select("customer_id, project_id, task_id, notes, started_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;

      if (row) {
        hydrateFromDB({
          ctx: {
            customerId: row.customer_id,
            projectId: row.project_id,
            taskId: row.task_id,
            notes: row.notes ?? "",
          },
          startTime: row.started_at,
        });
      } else if (useTimerStore.getState().isRunning) {
        // localStorage thinks a timer is running but the DB disagrees - resync.
        reset();
      }

      // Ensure no stale channel with this name exists before subscribing
      const channelName = `active_timer:${user.id}`;
      const stale = supabase.getChannels().find((ch) => ch.topic === `realtime:${channelName}`);
      if (stale) await supabase.removeChannel(stale);
      if (cancelled) return;

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "active_timers",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === "DELETE") {
              if (useTimerStore.getState().isRunning) reset();
              return;
            }
            const next = payload.new as ActiveTimerRow;
            hydrateFromDB({
              ctx: {
                customerId: next.customer_id,
                projectId: next.project_id,
                taskId: next.task_id,
                notes: next.notes ?? "",
              },
              startTime: next.started_at,
            });
          },
        )
        .subscribe();
      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [hydrateFromDB, reset]);

  const elapsed = useMemo(() => {
    if (!startTime) return 0;
    return now - new Date(startTime).getTime();
  }, [now, startTime]);

  const overWarning = isRunning && elapsed > FOUR_HOURS_MS;
  const customerName = customerId ? customers.find((c) => c.id === customerId)?.name : null;

  const upsertActiveTimer = async (
    ctx: {
      customerId: string | null;
      projectId: string | null;
      taskId: string | null;
      notes: string;
    },
    startedAt: string,
  ) => {
    const userId = userIdRef.current;
    const tenantId = tenantIdRef.current;
    if (!userId || !tenantId) return;
    const supabase = createClient();
    await supabase.from("active_timers").upsert(
      {
        user_id: userId,
        tenant_id: tenantId,
        customer_id: ctx.customerId,
        project_id: ctx.projectId,
        task_id: ctx.taskId,
        notes: ctx.notes || null,
        started_at: startedAt,
        source: "web",
      },
      { onConflict: "user_id" },
    );
  };

  const deleteActiveTimer = async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("active_timers").delete().eq("user_id", userId);
  };

  const handleStartNow = () => {
    const startedAt = new Date().toISOString();
    const ctx = { customerId: null, projectId: null, taskId: null, notes: "" };
    start(ctx);
    void upsertActiveTimer(ctx, startedAt);
    setShowAssign(true);
    setShowRecent(false);
  };

  const handleLoadRecent = (run: (typeof recentRuns)[0]) => {
    const startedAt = new Date().toISOString();
    const ctx = {
      customerId: run.customerId,
      projectId: run.projectId,
      taskId: run.taskId,
      notes: run.notes ?? "",
    };
    start(ctx);
    void upsertActiveTimer(ctx, startedAt);
    setShowRecent(false);
  };

  const handleStop = async () => {
    setShowAssign(false);
    setStopping(true);
    const snapshot = stop();
    void deleteActiveTimer();
    if (!snapshot) {
      setStopping(false);
      return;
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
    saveRecentRun({
      customerId: snapshot.ctx.customerId,
      projectId: snapshot.ctx.projectId,
      taskId: snapshot.ctx.taskId,
      notes: snapshot.ctx.notes,
      customerName: customers.find((c) => c.id === snapshot.ctx.customerId)?.name ?? null,
      projectName: projects.find((p) => p.id === snapshot.ctx.projectId)?.name ?? null,
      taskName: tasks.find((t) => t.id === snapshot.ctx.taskId)?.title ?? null,
    });

    if (!snapshot.ctx.customerId) {
      toast.show(
        `נשמרו ${res.durationMinutes ?? 0} דקות ללא שיוך ללקוח. שייך מתוך מסך השעות.`,
        "info",
      );
    } else {
      toast.success(`נשמרו ${res.durationMinutes ?? 0} דקות`);
    }
  };

  if (!mounted) {
    return (
      <div className="bg-cream-paper border-ink-line text-ink-faded hidden items-center gap-3 rounded-full border px-4 py-2.5 text-sm font-semibold lg:flex">
        <span dir="ltr">00:00:00</span>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div ref={wrapperRef} className="relative flex items-center gap-1">
        <button
          type="button"
          onClick={() => setShowAssign((v) => !v)}
          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
            overWarning
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "bg-cream-paper border-ink-line text-navy"
          }`}
          aria-label="פרטי טיימר"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              overWarning
                ? "animate-pulse bg-rose-500"
                : !customerId
                  ? "bg-amber-400"
                  : "bg-emerald-500"
            }`}
            aria-hidden
          />
          <span dir="ltr" className="font-mono tabular-nums">
            {formatHMS(elapsed)}
          </span>
          <span className="text-ink-faded hidden max-w-[120px] truncate text-xs font-medium md:inline">
            {customerName ?? "ללא לקוח"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleStop}
          disabled={stopping}
          aria-label="עצור טיימר"
          className="text-cream-paper ms-1 flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 transition-colors hover:bg-rose-700 disabled:opacity-60"
        >
          {stopping ? <Spinner size={12} /> : <Square size={12} fill="currentColor" />}
        </button>

        <button
          type="button"
          onClick={() => {
            if (confirm("לבטל את הטיימר ללא שמירה?")) {
              reset();
              void deleteActiveTimer();
            }
          }}
          disabled={stopping}
          aria-label="בטל טיימר"
          title="בטל ללא שמירה"
          className="text-ink-faded ms-0.5 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
        >
          <X size={13} />
        </button>

        {showAssign && (
          <TimerAssignPopup
            customers={customers}
            projects={projects}
            tasks={tasks}
            currentCustomerId={customerId}
            currentProjectId={projectId}
            currentTaskId={taskId}
            currentNotes={notes}
            onAssign={(ctx) => {
              updateContext(ctx);
              if (startTime) void upsertActiveTimer(ctx, startTime);
              setShowAssign(false);
            }}
            onClose={() => setShowAssign(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleStartNow}
        className="bg-cream-paper border-ink-line text-ink-soft hover:border-navy hover:text-navy flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors"
        aria-label="התחל טיימר"
      >
        <Play size={14} className="text-emerald-600" />
        <span className="hidden whitespace-nowrap md:inline">התחל טיימר</span>
      </button>

      {recentRuns.length > 0 && (
        <div ref={recentRef} className="relative">
          <button
            type="button"
            onClick={() => setShowRecent((v) => !v)}
            className="bg-cream-paper border-ink-line text-ink-soft hover:border-navy hover:text-navy relative flex items-center gap-1 rounded-full border px-2 py-2 text-sm font-medium transition-colors"
            aria-label="הרצות אחרונות"
            title="המשך מהפעם האחרונה"
          >
            <RotateCcw size={13} />
            <ChevronDown size={11} />
            <span className="bg-navy text-cream-paper absolute -end-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none font-bold">
              {recentRuns.length > 9 ? "9+" : recentRuns.length}
            </span>
          </button>

          {showRecent && (
            <div
              className="bg-cream-paper border-ink-line absolute end-0 top-full z-50 mt-2 w-64 rounded-xl border shadow-lg"
              style={{ boxShadow: "0 4px 24px rgba(0,31,60,0.14), 0 0 0 1px rgba(0,63,124,0.08)" }}
            >
              <div className="border-ink-line border-b px-3 py-2">
                <span className="text-ink-faded text-xs font-medium">המשך מהפעם האחרונה</span>
              </div>
              <div className="space-y-0.5 p-1.5">
                {recentRuns.slice(0, 5).map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => handleLoadRecent(run)}
                    className="hover:bg-cream-deep flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm transition-colors"
                  >
                    <RotateCcw size={12} className="text-ink-faded shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-navy truncate text-xs font-medium">
                        {run.customerName ?? "ללא לקוח"}
                        {run.projectName ? ` · ${run.projectName}` : ""}
                      </p>
                      {run.notes && (
                        <p className="text-ink-faded truncate text-[11px]">{run.notes}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimerAssignPopup({
  customers,
  projects,
  tasks,
  currentCustomerId,
  currentProjectId,
  currentTaskId,
  currentNotes,
  onAssign,
  onClose,
}: {
  customers: CustomerOpt[];
  projects: ProjectOpt[];
  tasks: TaskOpt[];
  currentCustomerId: string | null;
  currentProjectId: string | null;
  currentTaskId: string | null;
  currentNotes: string;
  onAssign: (ctx: {
    customerId: string | null;
    projectId: string | null;
    taskId: string | null;
    notes: string;
  }) => void;
  onClose: () => void;
}) {
  const [customerId, setCustomerId] = useState(currentCustomerId ?? "");
  const [projectId, setProjectId] = useState(currentProjectId ?? "");
  const [taskId, setTaskId] = useState(currentTaskId ?? "");
  const [notes, setNotes] = useState(currentNotes ?? "");

  const filteredProjects = useMemo(
    () => (customerId ? projects.filter((p) => p.customer_id === customerId) : []),
    [projects, customerId],
  );
  const filteredTasks = useMemo(
    () => (projectId ? tasks.filter((t) => t.project_id === projectId) : []),
    [tasks, projectId],
  );

  const selectCls =
    "w-full rounded-lg border bg-white px-3 py-1.5 text-sm transition-colors outline-none border-ink-line focus:border-navy";

  return (
    <div
      className="bg-cream-paper border-ink-line absolute end-0 top-full z-50 mt-2 w-72 rounded-xl border p-4 shadow-lg"
      style={{ boxShadow: "0 4px 24px rgba(0,31,60,0.14), 0 0 0 1px rgba(0,63,124,0.08)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-navy text-sm font-semibold">שיוך הטיימר</span>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-faded hover:text-navy rounded p-0.5 transition-colors"
          aria-label="סגור"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2">
        <select
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setProjectId("");
            setTaskId("");
          }}
          className={selectCls}
          autoFocus
        >
          <option value="">לקוח —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setTaskId("");
          }}
          className={selectCls}
          disabled={!customerId || filteredProjects.length === 0}
        >
          <option value="">פרויקט —</option>
          {filteredProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className={selectCls}
          disabled={!projectId || filteredTasks.length === 0}
        >
          <option value="">משימה —</option>
          {filteredTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הערות..."
          className={selectCls}
        />
      </div>

      <button
        type="button"
        onClick={() =>
          onAssign({
            customerId: customerId || null,
            projectId: projectId || null,
            taskId: taskId || null,
            notes,
          })
        }
        className="bg-navy text-cream-paper hover:bg-navy/90 mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors"
      >
        <Check size={13} />
        שייך
      </button>
    </div>
  );
}
