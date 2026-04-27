"use client";

import { useActionState, useEffect } from "react";
import { X } from "lucide-react";
import { createContent, type ContentFormState } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

const init: ContentFormState = {};

const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "Twitter / X" },
  { value: "blog", label: "בלוג" },
  { value: "email", label: "אימייל" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "other", label: "אחר" },
];

const STATUSES = [
  { value: "idea", label: "רעיון" },
  { value: "planned", label: "מתוכנן" },
  { value: "in_progress", label: "בעבודה" },
  { value: "published", label: "פורסם" },
];

export function NewContentDialog({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(createContent, init);
  const toast = useToast();

  useEffect(() => {
    if (state.success) {
      toast.success("פריט תוכן נוצר");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">תוכן חדש</h2>
          <button onClick={onClose} className="text-ink-faded hover:text-navy rounded-lg p-1">
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <Field label="כותרת *" name="title" error={state.fieldErrors?.title?.[0]} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-micro text-ink-soft mb-1 block uppercase">פלטפורמה</label>
              <select
                name="platform"
                defaultValue="linkedin"
                className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-micro text-ink-soft mb-1 block uppercase">סטטוס</label>
              <select
                name="status"
                defaultValue="idea"
                className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Field label="תאריך מתוכנן" name="scheduled_date" type="date" />

          <Field label="תוכן / טקסט" name="body" as="textarea" />

          <Field label="תגיות (מופרדות בפסיק)" name="tags" placeholder="marketing, tips, AI" />

          <Field label="הערות פנימיות" name="notes" as="textarea" />

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border-ink-line text-navy hover:border-navy rounded-lg border px-4 py-2 text-sm font-semibold"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-navy text-cream-paper hover:bg-navy-deep rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <Spinner size={14} />
                  שומר
                </span>
              ) : (
                "צור תוכן"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  error,
  as,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  as?: "textarea";
  placeholder?: string;
}) {
  const base =
    "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors border-ink-line focus:border-navy placeholder:text-ink-faded";

  return (
    <div>
      <label className="text-micro text-ink-soft mb-1 block uppercase">{label}</label>
      {as === "textarea" ? (
        <textarea name={name} rows={3} className={base} placeholder={placeholder} />
      ) : (
        <input name={name} type={type} className={base} placeholder={placeholder} />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
