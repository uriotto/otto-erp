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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "no_profile" }, { status: 500 });
  }
  if (!profile.tenant_id) {
    return NextResponse.json({ error: "no_tenant" }, { status: 500 });
  }

  // Sanitize: PostgREST .or() parser שובר על תווים מיוחדים
  const safeQ = q.replace(/[,()"\\]/g, " ").trim();
  if (safeQ.length < 2) {
    return NextResponse.json(empty satisfies SearchResults);
  }

  // Split into words for multi-word AND matching — each word must appear somewhere in the record
  const words = safeQ
    .split(/\s+/)
    .filter((w) => w.length >= 1)
    .map((w) => `%${w}%`);

  const tenantId = profile.tenant_id;

  // Apply per-word OR filters (chained .or() = AND between words)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyWords(q: any, cols: string[]): any {
    for (const word of words) {
      q = q.or(cols.map((c: string) => `${c}.ilike.${word}`).join(","));
    }
    return q;
  }

  const [customersRes, leadsRes, projectsRes, tasksRes, documentsRes] = await Promise.all([
    applyWords(
      supabase
        .from("customers")
        .select("id, name, company, email, phone")
        .eq("tenant_id", tenantId)
        .limit(5),
      ["name", "company", "email", "phone"],
    ),
    applyWords(
      supabase
        .from("leads")
        .select("id, name, company, email, phone")
        .eq("tenant_id", tenantId)
        .limit(5),
      ["name", "company", "email", "phone"],
    ),
    applyWords(
      supabase
        .from("projects")
        .select("id, name, description")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .limit(5),
      ["name", "description"],
    ),
    applyWords(
      supabase
        .from("tasks")
        .select("id, title, description, project_id")
        .eq("tenant_id", tenantId)
        .limit(5),
      ["title", "description"],
    ),
    applyWords(
      supabase.from("documents").select("id, title, notes").eq("tenant_id", tenantId).limit(5),
      ["title", "notes"],
    ),
  ]);

  type CRow = {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
  };
  type PRow = { id: string; name: string; description: string | null };
  type TRow = { id: string; title: string; description: string | null; project_id: string | null };
  type DRow = { id: string; title: string; notes: string | null };

  const customers: SearchResultItem[] = ((customersRes.data ?? []) as CRow[]).map((c) => ({
    id: c.id,
    type: "customer" as const,
    title: c.name,
    subtitle: c.company ?? c.email ?? c.phone ?? null,
    href: `/customers/${c.id}`,
  }));

  const leads: SearchResultItem[] = ((leadsRes.data ?? []) as CRow[]).map((l) => ({
    id: l.id,
    type: "lead" as const,
    title: l.name,
    subtitle: l.company ?? l.email ?? l.phone ?? null,
    href: `/leads/${l.id}`,
  }));

  const projects: SearchResultItem[] = ((projectsRes.data ?? []) as PRow[]).map((p) => ({
    id: p.id,
    type: "project" as const,
    title: p.name,
    subtitle: p.description ?? null,
    href: `/projects/${p.id}`,
  }));

  const tasks: SearchResultItem[] = ((tasksRes.data ?? []) as TRow[]).map((t) => ({
    id: t.id,
    type: "task" as const,
    title: t.title,
    subtitle: t.description ?? null,
    href: t.project_id ? `/projects/${t.project_id}` : `/tasks`,
  }));

  const documents: SearchResultItem[] = ((documentsRes.data ?? []) as DRow[]).map((d) => ({
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
