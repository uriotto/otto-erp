"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, UserPlus } from "lucide-react";
import { createLeadFromRecording } from "../actions";
import { useToast } from "@/components/ui/toast";

interface Props {
  recordingId: string;
  leadId: string | null;
  leadName: string | null;
  canCreate: boolean;
}

export function LeadLink({ recordingId, leadId, leadName, canCreate }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  if (leadId) {
    return (
      <Link
        href={`/leads/${leadId}`}
        className="text-ink-soft hover:text-navy flex items-center gap-1.5 text-sm"
      >
        <User size={14} className="text-ink-faded" />
        {leadName ?? "ליד"}
      </Link>
    );
  }

  if (!canCreate) return null;

  const submit = () => {
    startTransition(async () => {
      const res = await createLeadFromRecording(recordingId, name);
      if (!res.ok) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("ליד נוצר וקושר להקלטה", "success");
      router.push(`/leads/${res.leadId}`);
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-navy hover:text-navy/80 flex items-center gap-1.5 text-sm font-medium"
      >
        <UserPlus size={14} />
        צור ליד מההקלטה
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="שם הליד"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) submit();
        }}
        className="border-ink-line bg-cream-paper text-navy focus:border-navy rounded-lg border px-3 py-1.5 text-sm outline-none"
      />
      <button
        onClick={submit}
        disabled={isPending || !name.trim()}
        className="bg-navy text-cream-paper hover:bg-navy/90 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
      >
        {isPending ? "יוצר..." : "צור"}
      </button>
      <button onClick={() => setOpen(false)} className="text-ink-faded hover:text-navy text-sm">
        ביטול
      </button>
    </div>
  );
}
