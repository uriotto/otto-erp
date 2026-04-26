"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, X } from "lucide-react";
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
  const reset = useTimerStore((s) => s.reset);

  const [mounted, setMounted] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [tasks, setTasks] = useState<TaskOpt[]>([]);

  const toast = useToast();

  // Hydration guard
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

  // Fetch lookups once
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void (async () => {
      const supabase = createClient();
      const [c, p, t] = await Promise.all([
        supabase.from("customers").select("id, name").order("name"),
        supabase
          .from("projects")
          .select("id, name, customer_id")
          .is("deleted_at", null)
          .order("name"),
        supabase.from("tasks").select("id, title, project_id").order("title"),
      ]);
      setCustomers(c.data ?? []);
      setProjects(p.data ?? []);
      setTasks(t.data ?? []);
    })();
  }, []);

  const elapsed = useMemo(() => {
    if (!startTime) return 0;
    return now - new Date(startTime).getTime();
  }, [now, startTime]);

  const overWarning = isRunning && elapsed > FOUR_HOURS_MS;

  const customerName = customerId ? customers.find((c) => c.id === customerId)?.name : null;

  const handleStop = async () => {
    setStopping(true);
    const snapshot = stop();
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
    if (!snapshot.ctx.customerId) {
      toast.show(
        `נשמרו ${res.durationMinutes ?? 0} דקות ללא שיוך ללקוח. שייך מתוך מסך השעות.`,
        "info",
      );
    } else {
      toast.success(`נשמרו ${res.durationMinutes ?? 0} דקות`);
    }
  };

  // Avoid hydration mismatch — render placeholder until mounted
  if (!mounted) {
    return (
      <div className="bg-cream-paper border-ink-line text-ink-faded hidden items-center gap-3 rounded-full border px-4 py-2.5 text-sm font-semibold lg:flex">
        <span dir="ltr">00:00:00</span>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div
        className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
          overWarning
            ? "border-rose-300 bg-rose-50 text-rose-700"
            : "bg-cream-paper border-ink-line text-navy"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            overWarning ? "animate-pulse bg-rose-500" : "bg-emerald-500"
          }`}
          aria-hidden
        />
        <span dir="ltr" className="font-mono tabular-nums">
          {formatHMS(elapsed)}
        </span>
        <span className="text-ink-faded hidden max-w-[120px] truncate text-xs font-medium md:inline">
          {customerName ?? "ללא לקוח"}
        </span>
        <button
          type="button"
          onClick={handleStop}
          disabled={stopping}
          aria-label="עצור טיימר"
          className="text-cream-paper ms-1 flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 transition-colors hover:bg-rose-700 disabled:opacity-60"
        >
          {stopping ? <Spinner size={12} /> : <Square size={12} fill="currentColor" />}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="bg-cream-paper border-ink-line text-ink-soft hover:border-navy hover:text-navy flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors"
        aria-label="התחל טיימר"
      >
        <Play size={14} className="text-emerald-600" />
        <span className="hidden md:inline">התחל טיימר</span>
      </button>

      {showPicker && (
        <TimerPicker
          customers={customers}
          projects={projects}
          tasks={tasks}
          onClose={() => setShowPicker(false)}
          onStart={(ctx) => {
            start(ctx);
            setShowPicker(false);
          }}
          initial={{ customerId, projectId, taskId, notes }}
        />
      )}
    </>
  );
}

function TimerPicker({
  customers,
  projects,
  tasks,
  onClose,
  onStart,
  initial,
}: {
  customers: CustomerOpt[];
  projects: ProjectOpt[];
  tasks: TaskOpt[];
  onClose: () => void;
  onStart: (ctx: {
    customerId: string | null;
    projectId: string | null;
    taskId: string | null;
    notes: string;
  }) => void;
  initial: {
    customerId: string | null;
    projectId: string | null;
    taskId: string | null;
    notes: string;
  };
}) {
  const [customerId, setCustomerId] = useState(initial.customerId ?? "");
  const [projectId, setProjectId] = useState(initial.projectId ?? "");
  const [taskId, setTaskId] = useState(initial.taskId ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  const filteredProjects = useMemo(
    () => (customerId ? projects.filter((p) => p.customer_id === customerId) : []),
    [projects, customerId],
  );
  const filteredTasks = useMemo(
    () => (projectId ? tasks.filter((t) => t.project_id === projectId) : []),
    [tasks, projectId],
  );

  const inputCls =
    "w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none border-ink-line focus:border-navy";
  const labelCls = "text-micro text-ink-soft mb-1 block uppercase";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-cream w-full max-w-md rounded-2xl p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">התחל טיימר</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>לקוח</label>
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setProjectId("");
                setTaskId("");
              }}
              className={inputCls}
            >
              <option value="">— ללא —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>פרויקט</label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setTaskId("");
              }}
              className={inputCls}
              disabled={!customerId}
            >
              <option value="">— ללא —</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>משימה</label>
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className={inputCls}
              disabled={!projectId}
            >
              <option value="">— ללא —</option>
              {filteredTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="border-ink-line text-navy hover:border-navy rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() =>
              onStart({
                customerId: customerId || null,
                projectId: projectId || null,
                taskId: taskId || null,
                notes,
              })
            }
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
          >
            <Play size={14} />
            התחל
          </button>
        </div>
      </div>
    </div>
  );
}
