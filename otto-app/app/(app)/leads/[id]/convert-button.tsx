"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, CheckCircle2 } from "lucide-react";
import { convertLeadToCustomer } from "../actions";
import { useToast } from "@/components/ui/toast";

export function ConvertButton({
  leadId,
  alreadyConverted,
  customerId,
}: {
  leadId: string;
  alreadyConverted: boolean;
  customerId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  if (alreadyConverted && customerId) {
    return (
      <button
        onClick={() => router.push(`/customers/${customerId}`)}
        className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100"
      >
        <CheckCircle2 size={14} />
        הומר ללקוח — צפה
      </button>
    );
  }

  function handleConvert() {
    if (!confirm("להמיר את הליד הזה ללקוח?\n(הסטטוס ישתנה ל'נסגר' וכל הפעילויות יעברו ללקוח החדש)"))
      return;
    startTransition(async () => {
      const result = await convertLeadToCustomer(leadId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.customerId) {
        toast.success("הליד הומר ללקוח");
        router.push(`/customers/${result.customerId}`);
      }
    });
  }

  return (
    <button
      onClick={handleConvert}
      disabled={pending}
      className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
    >
      <ArrowRightLeft size={14} />
      {pending ? "ממיר..." : "המר ללקוח"}
    </button>
  );
}
