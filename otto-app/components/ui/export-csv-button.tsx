"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { useToast } from "./toast";

interface ExportCsvButtonProps {
  label: string;
  action: () => Promise<{ csv?: string; filename?: string; error?: string }>;
}

export function ExportCsvButton({ label, action }: ExportCsvButtonProps) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error || !result.csv || !result.filename) {
          toast.error(result.error ?? "שגיאה בייצוא");
          return;
        }

        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success("הקובץ הורד בהצלחה");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "שגיאה לא צפויה";
        toast.error(message);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="border-ink-line text-navy hover:border-navy flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
    >
      <Download size={16} />
      {isPending ? "מייצא..." : label}
    </button>
  );
}
