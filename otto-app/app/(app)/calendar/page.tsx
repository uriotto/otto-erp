import { createClient } from "@/lib/supabase/server";
import { CalendarClient } from "./calendar-client";
import type { Tables } from "@/lib/supabase/types";

export const metadata = {
  title: "לוח שנה — OTTO",
};

export type CalendarTask = Pick<
  Tables<"tasks">,
  "id" | "title" | "due_date" | "status" | "priority" | "customer_id" | "project_id"
>;

export default async function CalendarPage() {
  const supabase = await createClient();

  const now = new Date();
  // Fetch a 3-month window (prev + current + next) so navigation is instant
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, due_date, status, priority, customer_id, project_id")
    .not("due_date", "is", null)
    .gte("due_date", rangeStart.toISOString().slice(0, 10))
    .lte("due_date", rangeEnd.toISOString().slice(0, 10))
    .neq("status", "cancelled")
    .order("due_date", { ascending: true });

  return (
    <CalendarClient
      tasks={(tasks ?? []) as CalendarTask[]}
      initialYear={now.getFullYear()}
      initialMonth={now.getMonth()}
    />
  );
}
