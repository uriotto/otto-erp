"use client";

import { useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle2, Circle, Trash2, X } from "lucide-react";
import {
  addPaymentInstallment,
  markInstallmentPaid,
  markInstallmentPending,
  deleteInstallment,
  type InstallmentFormState,
} from "./payment-schedule-actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { Tables } from "@/lib/supabase/types";

type Installment = Tables<"project_payment_schedule">;

function formatAmount(n: number) {
  return `₪${Number(n).toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString("he-IL");
}

function TogglePaidButton({
  installment,
  projectId,
}: {
  installment: Installment;
  projectId: string;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const isPaid = installment.status === "paid";

  function handle() {
    startTransition(async () => {
      const res = isPaid
        ? await markInstallmentPending(projectId, installment.id)
        : await markInstallmentPaid(projectId, installment.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      title={isPaid ? "סמן כממתין" : "סמן כשולם"}
      className={`shrink-0 transition-colors disabled:opacity-50 ${
        isPaid ? "text-green-500 hover:text-gray-400" : "text-gray-300 hover:text-green-500"
      }`}
    >
      {pending ? <Spinner size={16} /> : isPaid ? <CheckCircle2 size={16} /> : <Circle size={16} />}
    </button>
  );
}

function DeleteInstallmentButton({ id, projectId }: { id: string; projectId: string }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function handle() {
    if (!confirm("למחוק פעימה זו?")) return;
    startTransition(async () => {
      const res = await deleteInstallment(projectId, id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      className="text-ink-faded rounded p-0.5 opacity-0 transition-colors group-hover:opacity-100 hover:text-red-500 disabled:opacity-50"
      title="מחק"
    >
      {pending ? <Spinner size={12} /> : <Trash2 size={12} />}
    </button>
  );
}

function AddInstallmentForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const boundAction = addPaymentInstallment.bind(null, projectId);
  const [state, action, pending] = useActionState<InstallmentFormState, FormData>(boundAction, {});

  if (state.success) {
    router.refresh();
    onClose();
  }
  if (state.error) toast.error(state.error);

  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="border-ink-line mt-3 space-y-2 rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-navy text-xs font-semibold">פעימה חדשה</span>
        <button type="button" onClick={onClose} className="text-ink-faded hover:text-navy">
          <X size={14} />
        </button>
      </div>
      <div>
        <input
          name="description"
          type="text"
          required
          placeholder="תיאור, לדוגמה: מקדמה — 30%"
          className="border-ink-line focus:border-navy w-full rounded-lg border px-2.5 py-2 text-xs outline-none"
        />
        {fe.description && <p className="mt-0.5 text-xs text-red-500">{fe.description[0]}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            name="amount"
            type="number"
            required
            min="0"
            step="0.01"
            placeholder="סכום ₪"
            dir="ltr"
            className="border-ink-line focus:border-navy w-full rounded-lg border px-2.5 py-2 text-xs outline-none"
          />
          {fe.amount && <p className="mt-0.5 text-xs text-red-500">{fe.amount[0]}</p>}
        </div>
        <div>
          <input
            name="due_date"
            type="date"
            dir="ltr"
            className="border-ink-line focus:border-navy w-full rounded-lg border px-2.5 py-2 text-xs outline-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-ink-soft hover:text-navy rounded-lg px-3 py-1.5 text-xs"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        >
          {pending && <Spinner size={12} />}
          הוסף
        </button>
      </div>
    </form>
  );
}

export function PaymentScheduleSection({
  projectId,
  installments,
}: {
  projectId: string;
  installments: Installment[];
}) {
  const [showAdd, setShowAdd] = useState(false);

  const paidTotal = installments
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const grandTotal = installments.reduce((s, i) => s + Number(i.amount), 0);
  const remaining = grandTotal - paidTotal;

  return (
    <section className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-navy text-sm font-semibold">
          לוח תשלומים
          {installments.length > 0 && (
            <span className="text-ink-faded ms-1.5 font-normal">({installments.length})</span>
          )}
        </h2>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-ink-soft hover:text-navy flex items-center gap-1 text-xs transition-colors"
          >
            <Plus size={13} />
            הוסף פעימה
          </button>
        )}
      </div>

      {installments.length === 0 && !showAdd ? (
        <div className="text-ink-faded py-4 text-center text-xs">אין פעימות תשלום עדיין</div>
      ) : (
        <ul className="space-y-1">
          {installments.map((item) => (
            <li
              key={item.id}
              className={`group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors ${
                item.status === "paid" ? "opacity-60" : ""
              }`}
            >
              <TogglePaidButton installment={item} projectId={projectId} />
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm ${item.status === "paid" ? "text-ink-soft line-through" : "text-navy"}`}
                >
                  {item.description}
                </p>
                {item.due_date && (
                  <p className="text-ink-faded text-xs">{formatDate(item.due_date)}</p>
                )}
              </div>
              <span className="text-navy shrink-0 text-sm font-medium" dir="ltr">
                {formatAmount(Number(item.amount))}
              </span>
              <DeleteInstallmentButton id={item.id} projectId={projectId} />
            </li>
          ))}
        </ul>
      )}

      {showAdd && <AddInstallmentForm projectId={projectId} onClose={() => setShowAdd(false)} />}

      {installments.length > 0 && (
        <div className="border-ink-line/60 mt-3 flex justify-between border-t pt-3 text-xs">
          <div className="space-x-4 space-x-reverse">
            <span className="text-green-600">
              שולם:{" "}
              <span className="font-semibold" dir="ltr">
                {formatAmount(paidTotal)}
              </span>
            </span>
            {remaining > 0 && (
              <span className="text-ink-soft">
                נותר:{" "}
                <span className="font-semibold" dir="ltr">
                  {formatAmount(remaining)}
                </span>
              </span>
            )}
          </div>
          <span className="text-navy font-semibold" dir="ltr">
            סה&quot;כ: {formatAmount(grandTotal)}
          </span>
        </div>
      )}
    </section>
  );
}
