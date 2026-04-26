"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TimerContext {
  customerId: string | null;
  projectId: string | null;
  taskId: string | null;
  notes: string;
}

export interface TimerState extends TimerContext {
  isRunning: boolean;
  startTime: string | null; // ISO
  start: (ctx: TimerContext) => void;
  stop: () => { startTime: string; endTime: string; ctx: TimerContext } | null;
  updateContext: (patch: Partial<TimerContext>) => void;
  reset: () => void;
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
      reset: () => set({ isRunning: false, startTime: null, ...initialCtx }),
    }),
    {
      name: "otto:timer",
      version: 1,
    },
  ),
);
