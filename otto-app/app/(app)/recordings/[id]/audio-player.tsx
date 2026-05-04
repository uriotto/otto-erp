"use client";

import { useEffect, useState } from "react";
import { Play, Download } from "lucide-react";
import { getRecordingDownloadUrl } from "../actions";
import { useToast } from "@/components/ui/toast";

interface Props {
  storagePath: string;
  title: string;
}

export function AudioPlayer({ storagePath, title }: Props) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecordingDownloadUrl(storagePath).then((signedUrl) => {
      setUrl(signedUrl);
      setLoading(false);
    });
  }, [storagePath]);

  async function handleDownload() {
    const downloadUrl = url ?? (await getRecordingDownloadUrl(storagePath));
    if (!downloadUrl) {
      toast.error("שגיאה ביצירת קישור הורדה");
      return;
    }
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${title}.webm`;
    a.click();
  }

  if (loading) {
    return <div className="bg-ink-line h-12 animate-pulse rounded-lg" />;
  }

  if (!url) {
    return (
      <p className="text-ink-faded text-sm">לא ניתן לטעון את ההקלטה</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Play size={14} className="text-navy shrink-0" />
        <span className="text-navy text-sm font-medium">האזנה</span>
      </div>
      <audio
        src={url}
        controls
        className="w-full rounded-lg"
        dir="ltr"
        controlsList="nodownload"
      />
      <button
        onClick={handleDownload}
        className="border-ink-line text-ink-soft hover:text-navy hover:border-navy flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
      >
        <Download size={15} />
        הורד הקלטה
      </button>
    </div>
  );
}
