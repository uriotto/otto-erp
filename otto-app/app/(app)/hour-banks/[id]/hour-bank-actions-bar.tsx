"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Ban, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { cancelHourBank, backfillPendingEntries } from "../actions";
import { EditHourBankDialog } from "./edit-hour-bank-dialog";

export type EditableBank = {
  id: string;
  status: "draft" | "active" | "depleted" | "expired" | "cancelled";
  purchased_hours: number;
  hourly_rate: number;
  expiry_date: string | null;
  alert_threshold_pct: number;
  alert_threshold_hours: number;
  notes: string | null;
};

export function HourBankActionsBar({ bank }: { bank: EditableBank }) {
  const [showEdit, setShowEdit] = useState(false);
  const [pending, startTransition] = useTransition();
  const [backfilling, startBackfill] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleBackfill() {
    startBackfill(async () => {
      const result = await backfillPendingEntries(bank.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const count = result.allocated ?? 0;
      toast.success(count > 0 ? `שוייכו ${count} רשומות שעות לבנק` : "אין שעות ממתינות לשיוך");
      router.refresh();
    });
  }

  function handleCancel() {
    if (!confirm("לבטל את בנק השעות הזה? לא ניתן לשחזר.")) return;
    startTransition(async () => {
      const result = await cancelHourBank(bank.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("הבנק בוטל");
      router.refresh();
    });
  }

  const canCancel = bank.status === "active";

  return (
    <>
      <div className="border-ink-line mt-4 flex items-center gap-2 border-t pt-4">
        <button
          type="button"
          onClick={() => setShowEdit(true)}
          className="border-ink-line text-navy hover:border-navy flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          <Edit2 size={13} />
          ערוך
        </button>
        {bank.status === "active" && (
          <button
            type="button"
            onClick={handleBackfill}
            disabled={backfilling}
            className="border-ink-line text-ink-soft hover:border-navy hover:text-navy flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {backfilling ? <Spinner size={13} /> : <RefreshCw size={13} />}
            שייך שעות ממתינות
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            aria-busy={pending}
            className="text-ink-faded ms-auto flex items-center gap-1.5 text-xs transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Spinner size={13} /> : <Ban size={13} />}
            {pending ? "מבטל" : "בטל בנק"}
          </button>
        )}
      </div>

      {showEdit && <EditHourBankDialog bank={bank} onClose={() => setShowEdit(false)} />}
    </>
  );
}
