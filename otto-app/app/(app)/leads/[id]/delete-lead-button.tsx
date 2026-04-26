"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteLead } from "../actions";
import { useToast } from "@/components/ui/toast";

export function DeleteLeadButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleDelete() {
    if (!confirm("למחוק את הליד הזה?")) return;
    startTransition(async () => {
      const result = await deleteLead(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("הליד נמחק");
      router.push("/leads");
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-ink-faded flex items-center gap-1.5 text-xs transition-colors hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 size={13} />
      {pending ? "מוחק..." : "מחק ליד"}
    </button>
  );
}
