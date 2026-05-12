"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TimerContext {
  customerId: string | null;
  projectId: string | null;
  taskId: string | null;
  notes: string;
}

export interface RecentRun {
  id: string;
  customerId: string | null;
  projectId: string | null;
  taskId: string | null;
  notes: string;
  customerName: string | null;
  projectName: string | null;
  taskName: string | null;
  stoppedAt: string;
}

export interface TimerState extends TimerContext {
  isRunning: boolean;
  startTime: string | null; // ISO
  recentRuns: RecentRun[];
  start: (ctx: TimerContext) => void;
  stop: () => { startTime: string; endTime: string; ctx: TimerContext } | null;
  updateContext: (patch: Partial<TimerContext>) => void;
  saveRecentRun: (run: Omit<RecentRun, "id" | "stoppedAt">) => void;
  loadRecentRun: (run: RecentRun) => void;
  reset: () => void;
  hydrateFromDB: (input: { ctx: TimerContext; startTime: string }) => void;
}

const initialCtx: TimerContext = {
  customerId: null,
  projectId: null,
  taskId: null,
  notes: "",
};

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      ...initialCtx,
      isRunning: false,
      startTime: null,
      recentRuns: [],
      start: (ctx) =>
        set({
          ...ctx,
          isRunning: true,
          startTime: new Date().toISOString(),
        }),
      stop: () => {
        const s = get();
        if (!s.isRunning || !s.startTime) {
          set({ isRunning: false, startTime: null, ...initialCtx });
          return null;
        }
        const endTime = new Date().toISOString();
        const snapshot = {
          startTime: s.startTime,
          endTime,
          ctx: {
            customerId: s.customerId,
            projectId: s.projectId,
            taskId: s.taskId,
            notes: s.notes,
          },
        };
        set({ isRunning: false, startTime: null, ...initialCtx });
        return snapshot;
      },
      updateContext: (patch) => set((s) => ({ ...s, ...patch })),
      saveRecentRun: (run) => {
        const newRun: RecentRun = {
          ...run,
          id: new Date().toISOString(),
          stoppedAt: new Date().toISOString(),
        };
        set((s) => ({
          recentRuns: [newRun, ...s.recentRuns].slice(0, 10),
        }));
      },
      loadRecentRun: (run) =>
        set({
          customerId: run.customerId,
          projectId: run.projectId,
          taskId: run.taskId,
          notes: run.notes,
        }),
      reset: () => set({ isRunning: false, startTime: null, ...initialCtx }),
      hydrateFromDB: ({ ctx, startTime }) =>
        set({
          ...ctx,
          isRunning: true,
          startTime,
        }),
    }),
    {
      name: "otto:timer",
      version: 2,
    },
  ),
);
