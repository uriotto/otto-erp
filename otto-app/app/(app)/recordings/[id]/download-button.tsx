"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { getRecordingDownloadUrl } from "../actions";
import { useToast } from "@/components/ui/toast";

interface Props {
  storagePath: string;
  title: string;
}

export function DownloadButton({ storagePath, title }: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    const url = await getRecordingDownloadUrl(storagePath);
    setLoading(false);
    if (!url) {
      toast.error("שגיאה ביצירת קישור הורדה");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.webm`;
    a.click();
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="border-ink-line text-ink-soft hover:text-navy hover:border-navy flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
    >
      <Download size={15} />
      {loading ? "מכין הורדה..." : "הורד הקלטה"}
    </button>
  );
}
