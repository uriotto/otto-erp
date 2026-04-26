import { createClient } from "@/lib/supabase/server";
import { ProjectsList, type ProjectListItem } from "./projects-list";

export const metadata = { title: "פרויקטים — OTTO" };

export default async function ProjectsPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: customers }, { data: templates }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, status, phase, billing_model, health, budget, estimated_hours, start_date, due_date, customer_id, tags, created_at, parent_project_id",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("project_templates").select("id, name, description, default_billing_model"),
  ]);

  const customerMap = new Map((customers ?? []).map((c) => [c.id, c.name]));

  const items: ProjectListItem[] = (projects ?? []).map((p) => ({
    ...p,
    customer_name: p.customer_id ? (customerMap.get(p.customer_id) ?? null) : null,
  }));

  return <ProjectsList projects={items} customers={customers ?? []} templates={templates ?? []} />;
}
