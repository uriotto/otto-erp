"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { renameTag, deleteTagEverywhere, type TagUsage } from "./actions";

type Props = {
  initialTags: TagUsage[];
};

export function TagsCard({ initialTags }: Props) {
  const [tags, setTags] = useState<TagUsage[]>(initialTags);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  const startEdit = (name: string) => {
    setEditing(name);
    setDraft(name);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft("");
  };

  const submitRename = (oldName: string) => {
    const newName = draft.trim();
    if (!newName || newName === oldName) {
      cancelEdit();
      return;
    }
    setBusy(oldName);
    startTransition(async () => {
      const res = await renameTag(oldName, newName);
      setBusy(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setTags((prev) => {
        const merged = new Map<string, TagUsage>();
        for (const t of prev) {
          const key = t.name === oldName ? newName : t.name;
          const existing = merged.get(key);
          if (existing) {
            merged.set(key, {
              name: key,
              customers: existing.customers + t.customers,
              leads: existing.leads + t.leads,
            });
          } else {
            merged.set(key, { ...t, name: key });
          }
        }
        return Array.from(merged.values()).sort(
          (a, b) =>
            b.customers + b.leads - (a.customers + a.leads) || a.name.localeCompare(b.name, "he"),
        );
      });
      toast.success("התג שונה");
      cancelEdit();
    });
  };

  const submitDelete = (name: string) => {
    if (!confirm(`למחוק את התג "${name}" מכל הלקוחות והלידים?`)) return;
    setBusy(name);
    startTransition(async () => {
      const res = await deleteTagEverywhere(name);
      setBusy(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setTags((prev) => prev.filter((t) => t.name !== name));
      toast.success("התג נמחק");
    });
  };

  return (
    <section className="bg-cream-paper border-ink-line rounded-2xl border p-6">
      <h2 className="text-display-sm text-navy mb-2">תגיות</h2>
      <p className="text-ink-soft mb-4 text-sm">נהל/י תגיות בשימוש בלקוחות ובלידים</p>

      {tags.length === 0 ? (
        <p className="text-ink-faded text-sm">אין תגיות בשימוש כרגע.</p>
      ) : (
        <ul className="divide-ink-line border-ink-line divide-y rounded-xl border bg-white">
          {tags.map((tag) => {
            const isEditing = editing === tag.name;
            const isBusy = busy === tag.name;
            return (
              <li key={tag.name} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename(tag.name);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-2 py-1 text-sm outline-none"
                      dir="auto"
                    />
                  ) : (
                    <span className="text-navy text-sm font-medium" dir="auto">
                      {tag.name}
                    </span>
                  )}
                </div>

                <div className="text-ink-soft flex shrink-0 items-center gap-3 text-xs">
                  <span>לקוחות: {tag.customers}</span>
                  <span className="text-ink-faded">·</span>
                  <span>לידים: {tag.leads}</span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {isBusy ? (
                    <span className="text-ink-faded inline-flex h-8 w-8 items-center justify-center">
                      <Spinner size={14} />
                    </span>
                  ) : isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => submitRename(tag.name)}
                        className="text-navy hover:bg-cream rounded-lg p-1.5 transition-colors"
                        aria-label="אישור"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-ink-faded hover:text-navy hover:bg-cream rounded-lg p-1.5 transition-colors"
                        aria-label="ביטול"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(tag.name)}
                        className="text-ink-soft hover:text-navy hover:bg-cream rounded-lg p-1.5 transition-colors"
                        aria-label="ערוך תג"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => submitDelete(tag.name)}
                        className="text-ink-soft hover:bg-cream rounded-lg p-1.5 transition-colors hover:text-red-600"
                        aria-label="מחק תג"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
