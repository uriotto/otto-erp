"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewActivityDialog } from "@/components/activities/new-activity-dialog";
import type { ParentSearchItem } from "@/components/activities/parent-picker";

export function TodayNewButton({ parentItems }: { parentItems: ParentSearchItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
      >
        <Plus size={16} />
        פריט חדש
      </button>

      {open && (
        <NewActivityDialog
          parentItems={parentItems}
          defaultType="task"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
