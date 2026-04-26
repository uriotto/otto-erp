"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { exportAllData } from "./actions";

export function ExportCard() {
  const [pending, setPending] = useState(false);
  const toast = useToast();

  const onClick = async () => {
    setPending(true);
    try {
      const res = await exportAllData();
      if (res.error || !res.data) {
        toast.error(res.error ?? "שגיאה בייצוא");
        return;
      }
      const json = JSON.stringify(res.data, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `otto-backup-${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("הקובץ הורד");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="bg-cream-paper border-ink-line rounded-2xl border p-6">
      <h2 className="text-display-sm text-navy mb-2">ייצוא נתונים</h2>
      <p className="text-ink-soft mb-4 text-sm">
        גיבוי מלא של הלקוחות, הלידים, הפעילויות והתגיות שלך כקובץ JSON.
      </p>

      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-busy={pending}
        className="bg-navy text-cream-paper hover:bg-navy-deep inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Spinner size={14} /> : <Download size={15} />}
        <span>הורד את כל הנתונים שלי כ-JSON</span>
      </button>
    </section>
  );
}
