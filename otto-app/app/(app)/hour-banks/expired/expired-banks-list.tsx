"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Calendar, RefreshCw, RotateCcw, Undo2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { extendBankExpiry, partialRefundExpiredBank, runExpiryCheckNow } from "../actions";

export type ExpiredBankItem = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  purchased_hours: number;
  available_hours: number;
  expiry_date: string | null;
  days_since_expired: number;
};

type DialogState =
  | { kind: "extend"; item: ExpiredBankItem }
  | { kind: "refund"; item: ExpiredBankItem }
  | null;

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("he-IL");
  } catch {
    return value;
  }
}

export function ExpiredBanksList({
  items,
  canRunCheck,
}: {
  items: ExpiredBankItem[];
  canRunCheck: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [runningCheck, startCheckTransition] = useTransition();

  const handleRunCheck = () => {
    startCheckTransition(async () => {
      const res = await runExpiryCheckNow();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("בדיקת תפוגות הסתיימה");
      router.refresh();
    });
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {canRunCheck && (
          <button
            type="button"
            onClick={handleRunCheck}
            disabled={runningCheck}
            aria-busy={runningCheck}
            className="border-ink-line bg-cream-paper text-navy hover:border-navy inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runningCheck ? <Spinner size={14} /> : <RefreshCw size={14} />}
            הרץ בדיקת תפוגות עכשיו
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-cream-paper border-ink-line rounded-2xl border p-10 text-center">
          <p className="text-ink-soft text-sm">אין בנקים שפגו תוקף</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ExpiredRow
              key={item.id}
              item={item}
              onExtend={() => setDialog({ kind: "extend", item })}
              onRefund={() => setDialog({ kind: "refund", item })}
            />
          ))}
        </div>
      )}

      {dialog?.kind === "extend" && (
        <ExtendExpiryDialog item={dialog.item} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "refund" && (
        <PartialRefundDialog item={dialog.item} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

function ExpiredRow({
  item,
  onExtend,
  onRefund,
}: {
  item: ExpiredBankItem;
  onExtend: () => void;
  onRefund: () => void;
}) {
  return (
    <div className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/hour-banks/${item.id}`}
            className="text-navy inline-flex items-center gap-2 text-base font-semibold hover:underline"
          >
            <Building2 size={16} className="text-ink-faded" />
            <span dir="auto">{item.customer_name ?? "—"}</span>
          </Link>

          <div className="text-ink-soft mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={13} className="text-ink-faded" />
              פג: {formatDate(item.expiry_date)}
            </span>
            <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
              {item.days_since_expired} ימים מאז התפוגה
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Stat label="נרכשו" value={`${item.purchased_hours.toFixed(1)} שעות`} />
            <Stat
              label="זמינות שלא נוצלו"
              value={`${item.available_hours.toFixed(1)} שעות`}
              highlight={item.available_hours > 0}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={onExtend}
            className="border-ink-line text-navy hover:border-navy inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-semibold transition-colors"
          >
            <RotateCcw size={14} />
            הארך תפוגה
          </button>
          <button
            type="button"
            onClick={onRefund}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:border-rose-400"
          >
            <Undo2 size={14} />
            החזר חלקית
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-cream border-ink-line rounded-lg border p-2">
      <p className="text-micro text-ink-faded uppercase">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold ${highlight ? "text-rose-700" : "text-navy"}`}
        dir="auto"
      >
        {value}
      </p>
    </div>
  );
}

function ExtendExpiryDialog({ item, onClose }: { item: ExpiredBankItem; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  const defaultDate = new Date();
  defaultDate.setMonth(defaultDate.getMonth() + 12);
  const [date, setDate] = useState(defaultDate.toISOString().slice(0, 10));

  const submit = () => {
    startTransition(async () => {
      const res = await extendBankExpiry({ id: item.id, expiry_date: date });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("תאריך התפוגה עודכן והבנק חזר להיות פעיל");
      onClose();
      router.refresh();
    });
  };

  return (
    <DialogShell title="הארכת תפוגה" onClose={onClose} pending={pending}>
      <p className="text-ink-soft mb-4 text-sm">
        בחר/י תאריך תפוגה חדש עבור בנק של{" "}
        <span className="text-navy font-semibold" dir="auto">
          {item.customer_name ?? "—"}
        </span>
        . הבנק יחזור לסטטוס פעיל.
      </p>

      <label className="text-navy mb-1 block text-sm font-semibold">תאריך תפוגה חדש</label>
      <input
        type="date"
        value={date}
        min={minDate}
        onChange={(e) => setDate(e.target.value)}
        dir="ltr"
        className="border-ink-line focus:border-navy text-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
      />

      <DialogActions
        onCancel={onClose}
        onSubmit={submit}
        pending={pending}
        confirmLabel="הארך תפוגה"
      />
    </DialogShell>
  );
}

function PartialRefundDialog({ item, onClose }: { item: ExpiredBankItem; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (notes.trim().length === 0) {
      toast.error("יש לכתוב הערה");
      return;
    }
    startTransition(async () => {
      const res = await partialRefundExpiredBank({ id: item.id, notes: notes.trim() });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("ההחזר תועד והבנק סומן כמבוטל");
      onClose();
      router.refresh();
    });
  };

  return (
    <DialogShell title="החזר חלקי" onClose={onClose} pending={pending}>
      <p className="text-ink-soft mb-4 text-sm">
        תיעוד החזר חלקי עבור בנק של{" "}
        <span className="text-navy font-semibold" dir="auto">
          {item.customer_name ?? "—"}
        </span>
        . הבנק יסומן כמבוטל וההערה תישמר. ההחזר עצמו מתבצע ידנית.
      </p>

      <label className="text-navy mb-1 block text-sm font-semibold">פירוט ההחזר</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        dir="auto"
        placeholder="לדוגמה: הוחזרו 3 שעות בסך 1,350 ₪ בהעברה בנקאית"
        className="border-ink-line focus:border-navy text-navy w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
      />

      <DialogActions
        onCancel={onClose}
        onSubmit={submit}
        pending={pending}
        confirmLabel="שמור החזר"
        confirmStyle="danger"
      />
    </DialogShell>
  );
}

function DialogShell({
  title,
  onClose,
  pending,
  children,
}: {
  title: string;
  onClose: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-cream w-full max-w-md rounded-2xl p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-display-sm text-navy">{title}</h2>
          <button
            onClick={onClose}
            disabled={pending}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors disabled:opacity-50"
            aria-label="סגור"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogActions({
  onCancel,
  onSubmit,
  pending,
  confirmLabel,
  confirmStyle = "primary",
}: {
  onCancel: () => void;
  onSubmit: () => void;
  pending: boolean;
  confirmLabel: string;
  confirmStyle?: "primary" | "danger";
}) {
  const styles =
    confirmStyle === "danger"
      ? "bg-rose-600 text-white hover:bg-rose-700"
      : "bg-navy text-cream hover:bg-navy/90";

  return (
    <div className="mt-5 flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="border-ink-line text-navy hover:border-navy rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        ביטול
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending}
        aria-busy={pending}
        className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
      >
        {pending ? (
          <>
            <Spinner size={14} />
            <span>שומר</span>
          </>
        ) : (
          confirmLabel
        )}
      </button>
    </div>
  );
}
