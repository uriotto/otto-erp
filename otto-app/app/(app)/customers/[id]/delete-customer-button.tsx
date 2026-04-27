"use client";

import { useTransition } from "react";
import { UserX, UserCheck } from "lucide-react";
import { deactivateCustomer, reactivateCustomer } from "../actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

export function DeactivateCustomerButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function handleToggle() {
    const msg = active ? "להשבית את הלקוח?" : "להפעיל מחדש את הלקוח?";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const result = active ? await deactivateCustomer(id) : await reactivateCustomer(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(active ? "הלקוח הושבת" : "הלקוח הופעל מחדש");
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      aria-busy={pending}
      className={`flex items-center gap-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? "text-ink-faded hover:text-amber-600" : "text-amber-600 hover:text-green-600"
      }`}
    >
      {pending ? <Spinner size={13} /> : active ? <UserX size={13} /> : <UserCheck size={13} />}
      {pending ? "מעדכן" : active ? "השבת לקוח" : "הפעל מחדש"}
    </button>
  );
}
