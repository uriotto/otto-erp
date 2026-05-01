import { createClient } from "@/lib/supabase/server";
import { DocumentsList, type DocumentItem } from "./documents-list";

export const metadata = { title: "מסמכים — OTTO" };

export default async function DocumentsPage() {
  const supabase = await createClient();

  const [{ data: docsRaw }, { data: customers }, { data: projects }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, title, type, mime_type, file_url, file_size_bytes, signature_required, signed_at, signed_by_name, visible_to_client, tags, notes, created_at, customer_id, project_id, customers(name), projects(name)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name, company").eq("active", true).order("name"),
    supabase.from("projects").select("id, name, customer_id").is("deleted_at", null).order("name"),
  ]);

  const documents: DocumentItem[] = (docsRaw ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    mime_type: d.mime_type,
    file_url: d.file_url,
    file_size_bytes: d.file_size_bytes,
    signature_required: d.signature_required,
    signed_at: d.signed_at,
    signed_by_name: d.signed_by_name ?? null,
    visible_to_client: d.visible_to_client,
    tags: d.tags ?? [],
    notes: d.notes,
    created_at: d.created_at,
    customer_id: d.customer_id,
    customer_name: (d.customers as { name: string } | null)?.name ?? null,
    project_id: d.project_id,
    project_name: (d.projects as { name: string } | null)?.name ?? null,
  }));

  return (
    <DocumentsList
      documents={documents}
      customers={customers ?? []}
      projects={(projects ?? []).map((p) => ({ ...p, customer_id: p.customer_id ?? null }))}
    />
  );
}
