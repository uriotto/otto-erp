"use client";

import { useState, useTransition } from "react";
import { Clock, Link2, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { createBookingType, updateBookingType, deleteBookingType } from "./actions";
import type { Database } from "@/lib/supabase/types";

type BookingType = Database["public"]["Tables"]["booking_types"]["Row"];

const COLOR_OPTIONS = [
  { value: "navy", label: "כחול כהה" },
  { value: "teal", label: "טורקיז" },
  { value: "amber", label: "ענבר" },
  { value: "rose", label: "ורוד" },
  { value: "slate", label: "אפור" },
];

function colorDot(color: string) {
  const map: Record<string, string> = {
    navy: "bg-navy",
    teal: "bg-teal-600",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    slate: "bg-slate-500",
  };
  return map[color] ?? "bg-navy";
}

type BookingTypeFormProps = {
  initial?: BookingType;
  onSave: (formData: FormData) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
};

function BookingTypeForm({ initial, onSave, onCancel, isPending }: BookingTypeFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [duration, setDuration] = useState(String(initial?.duration_minutes ?? 60));
  const [color, setColor] = useState(initial?.color ?? "navy");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [autoSlug, setAutoSlug] = useState(!initial);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (autoSlug) {
      setSlug(
        val
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .slice(0, 60),
      );
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("title", title);
    fd.set("slug", slug);
    fd.set("description", description);
    fd.set("duration_minutes", duration);
    fd.set("color", color);
    fd.set("is_active", String(isActive));
    await onSave(fd);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-ink-line space-y-4 rounded-2xl border bg-white p-5"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-navy mb-1 block text-sm font-medium">שם הפגישה</label>
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
            placeholder="למשל: ייעוץ ראשוני"
            className="border-ink-line text-navy focus:ring-navy/20 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
          />
        </div>
        <div>
          <label className="text-navy mb-1 block text-sm font-medium">מזהה URL</label>
          <input
            value={slug}
            onChange={(e) => {
              setAutoSlug(false);
              setSlug(e.target.value);
            }}
            required
            dir="ltr"
            placeholder="initial-consultation"
            className="border-ink-line text-navy focus:ring-navy/20 w-full rounded-lg border bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2"
          />
          <p className="text-ink-faded mt-0.5 text-xs">/book/{slug || "..."}</p>
        </div>
      </div>

      <div>
        <label className="text-navy mb-1 block text-sm font-medium">תיאור (אופציונלי)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="מה ייעשה בפגישה זו?"
          className="border-ink-line text-navy focus:ring-navy/20 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="text-navy mb-1 block text-sm font-medium">משך (דקות)</label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="border-ink-line text-navy focus:ring-navy/20 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
          >
            {[15, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} דקות
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-navy mb-1 block text-sm font-medium">צבע</label>
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="border-ink-line text-navy focus:ring-navy/20 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
          >
            {COLOR_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end pb-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-navy text-sm font-medium">פעיל</span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="border-ink-line text-ink-soft hover:text-navy inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm transition-colors"
        >
          <X size={14} />
          ביטול
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="bg-navy text-cream-paper inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-60"
        >
          {isPending ? (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Check size={14} />
          )}
          {initial ? "שמור" : "צור"}
        </button>
      </div>
    </form>
  );
}

type Props = {
  initialTypes: BookingType[];
};

export function BookingTypesList({ initialTypes }: Props) {
  const [types, setTypes] = useState(initialTypes);
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate(fd: FormData) {
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const res = await createBookingType(fd);
        if (!res.ok) {
          setError(res.error);
        } else {
          setShowNew(false);
          setError(null);
          // refresh via server revalidation — reload
          window.location.reload();
        }
        resolve();
      });
    });
  }

  function handleUpdate(id: string, fd: FormData) {
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const res = await updateBookingType(id, fd);
        if (!res.ok) {
          setError(res.error);
        } else {
          setEditingId(null);
          setError(null);
          window.location.reload();
        }
        resolve();
      });
    });
  }

  function handleDelete(id: string) {
    if (!confirm("למחוק סוג פגישה זה?")) return;
    startTransition(async () => {
      const res = await deleteBookingType(id);
      if (!res.ok) {
        setError(res.error);
      } else {
        setTypes((prev) => prev.filter((t) => t.id !== id));
        setError(null);
      }
    });
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {types.length === 0 && !showNew && (
        <div className="border-ink-line rounded-2xl border border-dashed p-8 text-center">
          <p className="text-ink-soft text-sm">עוד אין סוגי פגישות. צור את הראשון!</p>
        </div>
      )}

      {types.map((bt) =>
        editingId === bt.id ? (
          <BookingTypeForm
            key={bt.id}
            initial={bt}
            onSave={(fd) => handleUpdate(bt.id, fd)}
            onCancel={() => setEditingId(null)}
            isPending={isPending}
          />
        ) : (
          <div
            key={bt.id}
            className="border-ink-line flex items-center justify-between rounded-2xl border bg-white p-5"
          >
            <div className="flex items-center gap-4">
              <span className={`h-3 w-3 shrink-0 rounded-full ${colorDot(bt.color)}`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-navy font-semibold">{bt.title}</span>
                  {!bt.is_active && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      לא פעיל
                    </span>
                  )}
                </div>
                <div className="text-ink-faded mt-0.5 flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} />
                    {bt.duration_minutes} דקות
                  </span>
                  <a
                    href={`${origin}/book/${bt.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-navy inline-flex items-center gap-1 font-mono underline-offset-2 hover:underline"
                    dir="ltr"
                  >
                    <Link2 size={11} />
                    /book/{bt.slug}
                  </a>
                </div>
                {bt.description && <p className="text-ink-soft mt-1 text-xs">{bt.description}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingId(bt.id)}
                className="border-ink-line hover:border-navy text-ink-soft hover:text-navy rounded-lg border p-2 transition-colors"
                title="עריכה"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(bt.id)}
                className="border-ink-line text-ink-soft rounded-lg border p-2 transition-colors hover:border-rose-300 hover:text-rose-600"
                title="מחיקה"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ),
      )}

      {showNew ? (
        <BookingTypeForm
          onSave={handleCreate}
          onCancel={() => setShowNew(false)}
          isPending={isPending}
        />
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className="border-ink-line hover:border-navy text-ink-soft hover:text-navy flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-4 text-sm transition-colors"
        >
          <Plus size={16} />
          הוסף סוג פגישה
        </button>
      )}
    </div>
  );
}
