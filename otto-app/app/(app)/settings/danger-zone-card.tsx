"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { deleteAllCustomers, deleteAllLeads } from "./actions";

type Action = "customers" | "leads";

const ACTION_META: Record<Action, { title: string; subject: string; entity: string }> = {
  customers: {
    title: "מחק את כל הלקוחות",
    subject: "כל הלקוחות במותג שלך יימחקו לצמיתות.",
    entity: "לקוחות",
  },
  leads: {
    title: "מחק את כל הלידים",
    subject: "כל הלידים במותג שלך יימחקו לצמיתות.",
    entity: "לידים",
  },
};

type Props = {
  tenantName: string;
};

export function DangerZoneCard({ tenantName }: Props) {
  const [open, setOpen] = useState<Action | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const close = () => {
    if (pending) return;
    setOpen(null);
    setConfirmation("");
  };

  const submit = () => {
    if (!open) return;
    if (confirmation.trim() !== tenantName.trim()) {
      toast.error("שם המותג לא תואם");
      return;
    }
    const action = open;
    startTransition(async () => {
      const res = action === "customers" ? await deleteAllCustomers() : await deleteAllLeads();
      if (res.error || !res.data) {
        toast.error(res.error ?? "שגיאה במחיקה");
        return;
      }
      const meta = ACTION_META[action];
      toast.success(`נמחקו ${res.data.count} ${meta.entity}`);
      setOpen(null);
      setConfirmation("");
    });
  };

  return (
    <>
      <section className="rounded-2xl border-2 border-red-300 bg-red-50/40 p-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-600" />
          <h2 className="text-display-sm text-red-700">אזור מסוכן</h2>
        </div>
        <p className="mb-4 text-sm text-red-700/80">
          פעולות בלתי הפיכות. מומלץ לייצא את הנתונים שלך לפני שתמשיכ/י.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setOpen("customers")}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-500 hover:bg-red-50"
          >
            מחק את כל הלקוחות
          </button>
          <button
            type="button"
            onClick={() => setOpen("leads")}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-500 hover:bg-red-50"
          >
            מחק את כל הלידים
          </button>
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="bg-cream w-full max-w-md rounded-t-2xl p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-600" />
                <h2 className="text-display-sm text-navy">{ACTION_META[open].title}</h2>
              </div>
              <button
                onClick={close}
                disabled={pending}
                className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors disabled:opacity-50"
                aria-label="סגור"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-ink-soft mb-4 text-sm">
              {ACTION_META[open].subject} כדי לאשר, הקלד/י את שם המותג:
            </p>
            <p className="text-navy mb-3 text-sm font-semibold" dir="auto">
              {tenantName}
            </p>

            <input
              autoFocus
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") close();
              }}
              dir="auto"
              placeholder="הקלד/י כאן את שם המותג"
              className="border-ink-line focus:border-navy placeholder:text-ink-faded mb-4 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="border-ink-line text-navy hover:border-navy rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || confirmation.trim() !== tenantName.trim()}
                aria-busy={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? (
                  <>
                    <Spinner size={14} />
                    <span>מוחק</span>
                  </>
                ) : (
                  "מחק לצמיתות"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
