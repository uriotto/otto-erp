"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, Trash2, Plus, Clock, User, FolderKanban, Download } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { useToast } from "@/components/ui/toast";
import { deleteRecording, getRecordingDownloadUrl } from "./actions";

type Recording = Tables<"recordings"> & {
  customer_name?: string | null;
  project_name?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: "הועלה",
  transcribing: "בתמלול",
  transcribed: "תומלל",
  failed: "נכשל",
};

const STATUS_STYLES: Record<string, string> = {
  uploaded: "bg-blue-50 text-blue-700 border-blue-200",
  transcribing: "bg-amber-50 text-amber-700 border-amber-200",
  transcribed: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  recordings: Recording[];
}

export function RecordingsList({ recordings }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!confirm("למחוק הקלטה זו לצמיתות?")) return;
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteRecording(id);
      setDeletingId(null);
      if (result.ok) {
        toast.success("ההקלטה נמחקה");
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleDownload(id: string, storagePath: string | null, title: string) {
    if (!storagePath) {
      toast.error("אין קובץ להורדה");
      return;
    }
    setDownloadingId(id);
    const url = await getRecordingDownloadUrl(storagePath);
    setDownloadingId(null);
    if (!url) {
      toast.error("שגיאה ביצירת קישור הורדה");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.webm`;
    a.click();
  }

  if (recordings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="border-ink-line bg-cream-paper mb-6 rounded-2xl border p-8">
          <Mic size={40} className="text-navy mx-auto mb-4 opacity-30" />
          <p className="text-ink-soft mb-4 text-sm">אין הקלטות עדיין</p>
          <Link
            href="/recordings/new"
            className="bg-navy text-cream-paper hover:bg-navy/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            הקלט עכשיו
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recordings.map((rec) => {
        const statusLabel = STATUS_LABELS[rec.status] ?? rec.status;
        const statusStyle = STATUS_STYLES[rec.status] ?? "bg-gray-50 text-gray-700 border-gray-200";

        return (
          <div
            key={rec.id}
            className="border-ink-line bg-cream-paper hover:border-navy/30 group flex items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-150"
          >
            <div className="bg-navy/8 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Mic size={18} className="text-navy opacity-60" />
            </div>

            <div className="min-w-0 flex-1">
              <Link
                href={`/recordings/${rec.id}`}
                className="text-navy hover:text-navy/80 block truncate text-sm font-semibold transition-colors"
              >
                {rec.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {rec.customer_name && (
                  <span className="text-ink-faded flex items-center gap-1 text-xs">
                    <User size={11} />
                    {rec.customer_name}
                  </span>
                )}
                {rec.project_name && (
                  <span className="text-ink-faded flex items-center gap-1 text-xs">
                    <FolderKanban size={11} />
                    {rec.project_name}
                  </span>
                )}
                <span className="text-ink-faded flex items-center gap-1 text-xs" dir="ltr">
                  <Clock size={11} />
                  {formatDuration(rec.duration_seconds)}
                </span>
                {rec.file_size && (
                  <span className="text-ink-faded text-xs">{formatFileSize(rec.file_size)}</span>
                )}
                <span className="text-ink-faded text-xs">{formatDate(rec.recorded_at)}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyle}`}
              >
                {statusLabel}
              </span>

              <button
                onClick={() => handleDownload(rec.id, rec.storage_path, rec.title)}
                disabled={downloadingId === rec.id || !rec.storage_path}
                className="text-ink-faded hover:text-navy rounded p-1.5 transition-colors disabled:opacity-30"
                title="הורד"
              >
                <Download size={15} />
              </button>

              <button
                onClick={() => handleDelete(rec.id)}
                disabled={deletingId === rec.id || isPending}
                className="text-ink-faded hover:text-red-500 rounded p-1.5 transition-colors disabled:opacity-30"
                title="מחק"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
