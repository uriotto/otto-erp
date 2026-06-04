import Link from "next/link";
import { Mic, Clock, ExternalLink } from "lucide-react";

export interface RecordingSummaryRow {
  id: string;
  title: string;
  status: string;
  duration_seconds: number | null;
  recorded_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  uploaded: "הועלה",
  transcribing: "בתמלול",
  transcribed: "תומלל",
  completed: "תומלל",
  failed: "נכשל",
};

const STATUS_STYLES: Record<string, string> = {
  uploaded: "border-blue-200 bg-blue-50 text-blue-700",
  transcribing: "border-amber-200 bg-amber-50 text-amber-700",
  transcribed: "border-green-200 bg-green-50 text-green-700",
  completed: "border-green-200 bg-green-50 text-green-700",
  failed: "border-red-200 bg-red-50 text-red-700",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function RecordingsSection({ recordings }: { recordings: RecordingSummaryRow[] }) {
  return (
    <section className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center gap-2">
        <Mic size={16} className="text-ink-soft" />
        <h2 className="text-navy text-sm font-semibold">
          שיחות מוקלטות
          {recordings.length > 0 && (
            <span className="text-ink-faded ms-1.5 font-normal">({recordings.length})</span>
          )}
        </h2>
      </div>

      {recordings.length === 0 ? (
        <p className="text-ink-faded py-4 text-center text-xs">אין שיחות מוקלטות עדיין</p>
      ) : (
        <ul className="divide-ink-line/60 divide-y">
          {recordings.map((rec) => {
            const statusLabel = STATUS_LABELS[rec.status] ?? rec.status;
            const statusStyle =
              STATUS_STYLES[rec.status] ?? "border-gray-200 bg-gray-50 text-gray-700";
            return (
              <li key={rec.id}>
                <Link
                  href={`/recordings/${rec.id}`}
                  className="hover:bg-cream-deep/30 flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Mic size={13} className="text-ink-faded shrink-0" />
                    <span className="text-navy truncate text-sm font-medium">{rec.title}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-ink-faded flex items-center gap-1 text-xs" dir="ltr">
                      <Clock size={11} />
                      {formatDuration(rec.duration_seconds)}
                    </span>
                    <span className="text-ink-faded text-xs">{formatDate(rec.recorded_at)}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyle}`}
                    >
                      {statusLabel}
                    </span>
                    <ExternalLink size={11} className="text-ink-faded" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
