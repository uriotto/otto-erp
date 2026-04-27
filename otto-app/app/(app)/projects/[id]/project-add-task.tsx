"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { quickCreateTask } from "@/app/(app)/tasks/actions";
import { useToast } from "@/components/ui/toast";

export function ProjectAddTask({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  function handleOpen() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleCancel() {
    setOpen(false);
    setTitle("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await quickCreateTask({ title: title.trim(), project_id: projectId });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("משימה נוצרה");
      setTitle("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="text-ink-soft hover:text-navy flex items-center gap-1 text-xs transition-colors"
      >
        <Plus size={13} />
        משימה
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && handleCancel()}
        placeholder="כותרת המשימה..."
        disabled={pending}
        className="border-ink-line focus:border-navy min-w-0 flex-1 rounded-lg border bg-white px-3 py-1.5 text-sm outline-none placeholder:text-gray-400 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={pending || !title.trim()}
        className="bg-navy text-cream-paper rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
      >
        הוסף
      </button>
      <button
        type="button"
        onClick={handleCancel}
        className="text-ink-faded hover:text-navy rounded p-1"
      >
        <X size={14} />
      </button>
    </form>
  );
}
