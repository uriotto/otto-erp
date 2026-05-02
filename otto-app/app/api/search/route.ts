import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type SearchResultItem = {
  id: string;
  type: "customer" | "lead" | "project" | "task" | "document";
  title: string;
  subtitle?: string | null;
  href: string;
};

export type SearchResults = {
  customers: SearchResultItem[];
  leads: SearchResultItem[];
  projects: SearchResultItem[];
  tasks: SearchResultItem[];
  documents: SearchResultItem[];
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  const empty: SearchResults = {
    customers: [],
    leads: [],
    projects: [],
    tasks: [],
    documents: [],
  };

  if (q.length < 2) {
    return NextResponse.json(empty satisfies SearchResults);
  }

  const supabase = await createClient();

  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) {
    return NextResponse.json(empty satisfies SearchResults);
  }

  // Sanitize: PostgREST .or() parser שובר על תווים מיוחדים
  const safeQ = q.replace(/[,()"\\]/g, " ").trim();
  if (safeQ.length < 2) {
    return NextResponse.json(empty satisfies SearchResults);
  }
  const like = `%${safeQ}%`;

  const [customersRes, leadsRes, projectsRes, tasksRes, documentsRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, company, email, phone")
      .eq("tenant_id", profile.tenant_id)
      .or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(5),

    supabase
      .from("leads")
      .select("id, name, company, email, phone")
      .eq("tenant_id", profile.tenant_id)
      .or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(5),

    supabase
      .from("projects")
      .select("id, name, description")
      .eq("tenant_id", profile.tenant_id)
      .is("deleted_at", null)
      .or(`name.ilike.${like},description.ilike.${like}`)
      .limit(5),

    supabase
      .from("tasks")
      .select("id, title, description, project_id")
      .eq("tenant_id", profile.tenant_id)
      .or(`title.ilike.${like},description.ilike.${like}`)
      .limit(5),

    supabase
      .from("documents")
      .select("id, title, notes")
      .eq("tenant_id", profile.tenant_id)
      .or(`title.ilike.${like},notes.ilike.${like}`)
      .limit(5),
  ]);

  const customers: SearchResultItem[] = (customersRes.data ?? []).map((c) => ({
    id: c.id,
    type: "customer" as const,
    title: c.name,
    subtitle: c.company ?? c.email ?? c.phone ?? null,
    href: `/customers/${c.id}`,
  }));

  const leads: SearchResultItem[] = (leadsRes.data ?? []).map((l) => ({
    id: l.id,
    type: "lead" as const,
    title: l.name,
    subtitle: l.company ?? l.email ?? l.phone ?? null,
    href: `/leads/${l.id}`,
  }));

  const projects: SearchResultItem[] = (projectsRes.data ?? []).map((p) => ({
    id: p.id,
    type: "project" as const,
    title: p.name,
    subtitle: p.description ?? null,
    href: `/projects/${p.id}`,
  }));

  const tasks: SearchResultItem[] = (tasksRes.data ?? []).map((t) => ({
    id: t.id,
    type: "task" as const,
    title: t.title,
    subtitle: t.description ?? null,
    href: t.project_id ? `/projects/${t.project_id}` : `/tasks`,
  }));

  const documents: SearchResultItem[] = (documentsRes.data ?? []).map((d) => ({
    id: d.id,
    type: "document" as const,
    title: d.title,
    subtitle: d.notes ?? null,
    href: `/documents/${d.id}`,
  }));

  return NextResponse.json({
    customers,
    leads,
    projects,
    tasks,
    documents,
  } satisfies SearchResults);
}
