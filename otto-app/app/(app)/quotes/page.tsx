import { createClient } from "@/lib/supabase/server";
import { QuotesList } from "./quotes-list";

export const metadata = { title: "הצעות מחיר — OTTO" };

export default async function QuotesPage() {
  const supabase = await createClient();

  const [{ data: quotesRaw }, { data: customers }, { data: projects }] = await Promise.all([
    supabase
      .from("quotes")
      .select("*, customers(name), projects(name)")
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name, company").eq("active", true).order("name"),
    supabase
      .from("projects")
      .select("id, name")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const quotes = (quotesRaw ?? []).map((q) => ({
    ...q,
    customer_name: (q.customers as { name: string } | null)?.name,
    project_name: (q.projects as { name: string } | null)?.name,
    customers: undefined,
    projects: undefined,
  }));

  return <QuotesList quotes={quotes} customers={customers ?? []} projects={projects ?? []} />;
}
