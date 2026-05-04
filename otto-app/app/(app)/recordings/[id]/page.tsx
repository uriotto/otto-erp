import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, User, FolderKanban, Clock, FileText, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AudioPlayer } from "./audio-player";

export const metadata = { title: "פרטי הקלטה — OTTO" };

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
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RecordingDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recording } = await supabase
    .from("recordings")
    .select(
      `
      *,
      customers(name),
      projects(name)
    `,
    )
    .eq("id", id)
    .single();

  if (!recording) notFound();

  const customerName = Array.isArray(recording.customers)
    ? ((recording.customers[0] as { name: string } | null)?.name ?? null)
    : ((recording.customers as { name: string } | null)?.name ?? null);

  const projectName = Array.isArray(recording.projects)
    ? ((recording.projects[0] as { name: string } | null)?.name ?? null)
    : ((recording.projects as { name: string } | null)?.name ?? null);

  const statusLabel = STATUS_LABELS[recording.status] ?? recording.status;
  const statusStyle = STATUS_STYLES[recording.status] ?? "bg-gray-50 text-gray-700 border-gray-200";

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/recordings"
          className="text-ink-faded hover:text-navy flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronRight size={16} />
          הקלטות
        </Link>
        <span className="text-ink-faded text-sm">/</span>
        <span className="text-navy truncate text-sm font-medium">{recording.title}</span>
      </div>

      <div className="mx-auto max-w-2xl space-y-4">
        {/* Header card */}
        <div className="border-ink-line bg-cream-paper rounded-xl border p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-navy text-lg font-bold">{recording.title}</h1>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-4">
            {customerName && (
              <span className="text-ink-soft flex items-center gap-1.5 text-sm">
                <User size={14} className="text-ink-faded" />
                {customerName}
              </span>
            )}
            {projectName && (
              <span className="text-ink-soft flex items-center gap-1.5 text-sm">
                <FolderKanban size={14} className="text-ink-faded" />
                {projectName}
              </span>
            )}
            <span className="text-ink-soft flex items-center gap-1.5 text-sm" dir="ltr">
              <Clock size={14} className="text-ink-faded" />
              {formatDuration(recording.duration_seconds)}
            </span>
            {recording.file_size && (
              <span className="text-ink-faded text-sm">{formatFileSize(recording.file_size)}</span>
            )}
          </div>

          <p className="text-ink-faded mt-2 text-xs">{formatDate(recording.recorded_at)}</p>

          {recording.storage_path && (
            <div className="mt-4">
              <AudioPlayer storagePath={recording.storage_path} title={recording.title} />
            </div>
          )}
        </div>

        {/* Transcript */}
        {recording.transcript && (
          <div className="border-ink-line bg-cream-paper rounded-xl border p-5">
            <div className="mb-3 flex items-center gap-2">
              <FileText size={16} className="text-navy" />
              <h2 className="text-navy text-sm font-semibold">תמליל</h2>
            </div>
            <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-wrap">
              {recording.transcript}
            </p>
          </div>
        )}

        {/* Summary */}
        {recording.summary && (
          <div className="border-ink-line bg-cream-paper rounded-xl border p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-navy" />
              <h2 className="text-navy text-sm font-semibold">סיכום AI</h2>
            </div>
            <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-wrap">
              {recording.summary}
            </p>
          </div>
        )}

        {/* No transcript yet */}
        {!recording.transcript && !recording.summary && (
          <div className="border-ink-line bg-cream-paper rounded-xl border p-5 text-center">
            <p className="text-ink-faded text-sm">
              {recording.status === "transcribing"
                ? "תמלול בתהליך..."
                : "תמלול וסיכום יהיו זמינים לאחר עיבוד ההקלטה"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
