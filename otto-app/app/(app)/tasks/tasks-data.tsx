import { createClient } from "@/lib/supabase/server";
import { TasksList, type TaskListItem, type ProjectOption, type UserOption } from "./tasks-list";

export async function TasksData() {
  const supabase = await createClient();

  const [
    { data: tasks },
    { data: projects },
    { data: users },
    { data: customers },
    { data: leads },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, due_date, completed_at, project_id, customer_id, lead_id, assigned_to, tags, order_index, created_at",
      )
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("users").select("id, full_name, email").order("full_name"),
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("leads").select("id, name").order("name"),
  ]);

  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const userMap = new Map((users ?? []).map((u) => [u.id, u.full_name || u.email]));
  const customerMap = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const leadMap = new Map((leads ?? []).map((l) => [l.id, l.name]));

  const items: TaskListItem[] = (tasks ?? []).map((t) => ({
    ...t,
    project_name: t.project_id ? (projectMap.get(t.project_id) ?? null) : null,
    customer_name: t.customer_id ? (customerMap.get(t.customer_id) ?? null) : null,
    lead_name: t.lead_id ? (leadMap.get(t.lead_id) ?? null) : null,
    assignee_name: t.assigned_to ? (userMap.get(t.assigned_to) ?? null) : null,
  }));

  const projectOptions: ProjectOption[] = (projects ?? []).map((p) => ({ id: p.id, name: p.name }));
  const userOptions: UserOption[] = (users ?? []).map((u) => ({
    id: u.id,
    name: u.full_name || u.email,
  }));
  const customerOptions = (customers ?? []).map((c) => ({ id: c.id, name: c.name }));
  const leadOptions = (leads ?? []).map((l) => ({ id: l.id, name: l.name }));

  return (
    <TasksList
      tasks={items}
      projects={projectOptions}
      users={userOptions}
      customers={customerOptions}
      leads={leadOptions}
    />
  );
}
