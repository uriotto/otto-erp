import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RecordingsList } from "./recordings-list";

export async function RecordingsData() {
  const supabase = await createClient();

  const { data: recordings } = await supabase
    .from("recordings")
    .select(
      `
      id, title, status, duration_seconds, file_size, storage_path, recorded_at, created_at,
      customer_id, lead_id, project_id,
      customers(name),
      projects(name)
    `,
    )
    .order("recorded_at", { ascending: false });

  const normalized = (recordings ?? []).map((r) => ({
    ...r,
    customer_name: Array.isArray(r.customers)
      ? ((r.customers[0] as { name: string } | null)?.name ?? null)
      : ((r.customers as { name: string } | null)?.name ?? null),
    project_name: Array.isArray(r.projects)
      ? ((r.projects[0] as { name: string } | null)?.name ?? null)
      : ((r.projects as { name: string } | null)?.name ?? null),
    transcript: null,
    summary: null,
    tenant_id: "",
  }));

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-navy text-xl font-bold">הקלטות</h1>
          <p className="text-ink-faded mt-0.5 text-sm">
            {normalized.length > 0 ? `${normalized.length} הקלטות` : "הקלט פגישות ושיחות"}
          </p>
        </div>
        <Link
          href="/recordings/new"
          className="bg-navy text-cream-paper hover:bg-navy/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          הקלט עכשיו
        </Link>
      </div>

      <RecordingsList recordings={normalized} />
    </div>
  );
}
