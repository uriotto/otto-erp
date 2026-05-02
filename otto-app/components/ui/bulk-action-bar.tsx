"use client";

import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { Spinner } from "./spinner";

export type BulkAction = {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "danger" | "default";
  isPending?: boolean;
};

type Props = {
  selectedCount: number;
  actions: BulkAction[];
  onClear: () => void;
};

export function BulkActionBar({ selectedCount, actions, onClear }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-navy text-cream-paper fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-5 py-3 shadow-lg">
      <span className="text-sm font-semibold">{selectedCount} נבחרו</span>
      <div className="bg-cream-paper/20 h-5 w-px" />
      <div className="flex items-center gap-2">
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <button
              key={i}
              type="button"
              onClick={action.onClick}
              disabled={action.isPending}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                action.variant === "danger"
                  ? "bg-red-500/90 text-white hover:bg-red-500"
                  : "bg-cream-paper/15 hover:bg-cream-paper/25 text-cream-paper"
              }`}
            >
              {action.isPending ? <Spinner size={12} /> : Icon ? <Icon size={13} /> : null}
              {action.label}
            </button>
          );
        })}
      </div>
      <div className="bg-cream-paper/20 h-5 w-px" />
      <button
        type="button"
        onClick={onClear}
        className="text-cream-paper/70 hover:text-cream-paper rounded p-0.5 transition-colors"
        title="בטל בחירה"
      >
        <X size={14} />
      </button>
    </div>
  );
}
