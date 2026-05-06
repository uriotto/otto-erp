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

export type CalendarEvent = Pick<
  Tables<"events">,
  | "id"
  | "title"
  | "start_at"
  | "end_at"
  | "all_day"
  | "type"
  | "customer_id"
  | "project_id"
  | "description"
  | "location"
>;

export default async function CalendarPage() {
  const supabase = await createClient();

  const now = new Date();
  // Fetch a 3-month window (prev + current + next) so navigation is instant
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const [tasksRes, eventsRes, customersRes, projectsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date, status, priority, customer_id, project_id")
      .not("due_date", "is", null)
      .gte("due_date", rangeStart.toISOString().slice(0, 10))
      .lte("due_date", rangeEnd.toISOString().slice(0, 10))
      .neq("status", "cancelled")
      .order("due_date", { ascending: true }),

    supabase
      .from("events")
      .select(
        "id, title, start_at, end_at, all_day, type, customer_id, project_id, description, location",
      )
      .gte("start_at", rangeStart.toISOString())
      .lte("start_at", rangeEnd.toISOString())
      .order("start_at", { ascending: true }),

    supabase
      .from("customers")
      .select("id, name")
      .eq("active", true)
      .order("name", { ascending: true }),

    supabase
      .from("projects")
      .select("id, name, customer_id")
      .not("status", "eq", "cancelled")
      .order("name", { ascending: true }),
  ]);

  return (
    <CalendarClient
      tasks={(tasksRes.data ?? []) as CalendarTask[]}
      events={(eventsRes.data ?? []) as CalendarEvent[]}
      customers={customersRes.data ?? []}
      projects={
        (projectsRes.data ?? []) as { id: string; name: string; customer_id: string | null }[]
      }
      initialYear={now.getFullYear()}
      initialMonth={now.getMonth()}
    />
  );
}
