import { createClient } from "@/lib/supabase/server";
import { TasksList, type TaskListItem, type ProjectOption, type UserOption } from "./tasks-list";

export const metadata = { title: "משימות — OTTO" };

export default async function TasksPage() {
  const supabase = await createClient();

  const [{ data: tasks }, { data: projects }, { data: users }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, due_date, completed_at, project_id, assigned_to, tags, order_index, created_at",
      )
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("users").select("id, full_name, email").order("full_name"),
  ]);

  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const userMap = new Map((users ?? []).map((u) => [u.id, u.full_name || u.email]));

  const items: TaskListItem[] = (tasks ?? []).map((t) => ({
    ...t,
    project_name: t.project_id ? (projectMap.get(t.project_id) ?? null) : null,
    assignee_name: t.assigned_to ? (userMap.get(t.assigned_to) ?? null) : null,
  }));

  const projectOptions: ProjectOption[] = (projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  const userOptions: UserOption[] = (users ?? []).map((u) => ({
    id: u.id,
    name: u.full_name || u.email,
  }));

  return <TasksList tasks={items} projects={projectOptions} users={userOptions} />;
}
