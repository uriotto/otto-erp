"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { quickCreateTask } from "@/app/(app)/tasks/actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

type DueOption = "today" | "tomorrow" | "this_week" | "none";

const DUE_LABELS: Record<DueOption, string> = {
  today: "היום",
  tomorrow: "מחר",
  this_week: "השבוע",
  none: "ללא תאריך",
};

function dateFor(option: DueOption): string | null {
  if (option === "none") return null;
  const d = new Date();
  if (option === "tomorrow") d.setDate(d.getDate() + 1);
  if (option === "this_week") {
    // End of current week (Friday in IL)
    const dow = d.getDay();
    const offset = (5 - dow + 7) % 7;
    d.setDate(d.getDate() + offset);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function QuickAddTask({
  customerId,
  leadId,
  projectId,
  defaultDue = "none",
  placeholder = "הוסף משימה במהירות... (Enter לשמירה)",
}: {
  customerId?: string;
  leadId?: string;
  projectId?: string;
  defaultDue?: DueOption;
  placeholder?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [due, setDue] = useState<DueOption>(defaultDue);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = value.trim();
    if (!title || isPending) return;
    startTransition(async () => {
      const res = await quickCreateTask({
        title,
        customer_id: customerId ?? null,
        lead_id: leadId ?? null,
        project_id: projectId ?? null,
        due_date: dateFor(due),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setValue("");
      toast.success("המשימה נוצרה");
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-cream-paper border-ink-line rounded-xl border p-2.5"
    >
      <div className="flex items-center gap-2">
        <div className="bg-navy text-cream-paper flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          <Plus size={14} />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="placeholder:text-ink-faded flex-1 bg-transparent text-sm outline-none"
          disabled={isPending}
        />
        {isPending && <Spinner size={14} className="text-navy" />}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 ps-9">
        {(Object.keys(DUE_LABELS) as DueOption[]).map((opt) => {
          const isActive = due === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setDue(opt)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                isActive
                  ? "border-navy bg-navy text-cream-paper"
                  : "border-ink-line text-ink-soft hover:border-navy bg-white"
              }`}
            >
              {DUE_LABELS[opt]}
            </button>
          );
        })}
      </div>
    </form>
  );
}
