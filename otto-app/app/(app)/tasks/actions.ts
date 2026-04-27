"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const TASK_STATUSES = ["todo", "in_progress", "review", "done", "cancelled"] as const;
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const TaskSchema = z.object({
  title: z.string().min(1, "כותרת חובה"),
  description: z.string().optional(),
  project_id: z.string().uuid().optional().or(z.literal("")),
  parent_task_id: z.string().uuid().optional().or(z.literal("")),
  customer_id: z.string().uuid().optional().or(z.literal("")),
  lead_id: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  due_date: z.string().optional(),
  due_at: z.string().optional(),
  recurring_config: z.string().optional(),
});

export type TaskFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  taskId?: string;
};

function dateOrNull(value: string | undefined): string | null {
  if (!value || value.trim().length === 0) return null;
  return value;
}

async function getTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, id")
    .eq("id", user.id)
    .single();
  return { supabase, profile };
}

export async function createTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = TaskSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const data = parsed.data;
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      title: data.title,
      description: data.description || null,
      project_id: data.project_id || null,
      parent_task_id: data.parent_task_id || null,
      customer_id: data.customer_id || null,
      lead_id: data.lead_id || null,
      status: data.status,
      priority: data.priority,
      assigned_to: data.assigned_to || null,
      due_at: dateOrNull(data.due_at),
      due_date: dateOrNull(data.due_date) ?? (data.due_at ? data.due_at.slice(0, 10) : null),
      completed_at: data.status === "done" ? new Date().toISOString() : null,
      recurring_config: data.recurring_config ? JSON.parse(data.recurring_config) : null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/tasks");
  if (data.customer_id) revalidatePath(`/customers/${data.customer_id}`);
  if (data.lead_id) revalidatePath(`/leads/${data.lead_id}`);
  revalidatePath("/today");
  return { success: true, taskId: task.id };
}

export async function updateTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const id = formData.get("id") as string;
  if (!id) return { error: "חסר מזהה" };

  const raw = Object.fromEntries(formData.entries());
  delete (raw as Record<string, unknown>).id;
  const parsed = TaskSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const data = parsed.data;
  const { error } = await supabase
    .from("tasks")
    .update({
      title: data.title,
      description: data.description || null,
      project_id: data.project_id || null,
      parent_task_id: data.parent_task_id || null,
      customer_id: data.customer_id || null,
      lead_id: data.lead_id || null,
      status: data.status,
      priority: data.priority,
      assigned_to: data.assigned_to || null,
      due_at: dateOrNull(data.due_at),
      due_date: dateOrNull(data.due_date) ?? (data.due_at ? data.due_at.slice(0, 10) : null),
      completed_at: data.status === "done" ? new Date().toISOString() : null,
      recurring_config: data.recurring_config ? JSON.parse(data.recurring_config) : null,
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/tasks");
  if (data.customer_id) revalidatePath(`/customers/${data.customer_id}`);
  if (data.lead_id) revalidatePath(`/leads/${data.lead_id}`);
  revalidatePath("/today");
  return { success: true, taskId: id };
}

export async function deleteTask(id: string): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return {};
}

export async function toggleTaskComplete(
  id: string,
  completed: boolean,
): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("tasks")
    .update({
      status: completed ? "done" : "todo",
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/today");
  return {};
}

const StatusSchema = z.enum(TASK_STATUSES);

export async function updateTaskStatus(id: string, status: string): Promise<{ error?: string }> {
  const parsed = StatusSchema.safeParse(status);
  if (!parsed.success) return { error: "סטטוס לא תקין" };

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("tasks")
    .update({
      status: parsed.data,
      completed_at: parsed.data === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/today");
  return {};
}

const QuickCaptureSchema = z.object({
  title: z.string().min(1, "כותרת חובה"),
  project_id: z.string().uuid().optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  due_date: z.string().optional().nullable(),
  due_at: z.string().optional().nullable(),
});

export async function quickCreateTask(input: {
  title: string;
  project_id?: string | null;
  customer_id?: string | null;
  lead_id?: string | null;
  assigned_to?: string | null;
  priority?: (typeof TASK_PRIORITIES)[number];
  due_date?: string | null;
  due_at?: string | null;
}): Promise<{ error?: string; taskId?: string }> {
  const parsed = QuickCaptureSchema.safeParse(input);
  if (!parsed.success) return { error: "כותרת חובה" };

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      title: parsed.data.title,
      project_id: parsed.data.project_id || null,
      customer_id: parsed.data.customer_id || null,
      lead_id: parsed.data.lead_id || null,
      assigned_to: parsed.data.assigned_to || null,
      priority: parsed.data.priority ?? "medium",
      status: "todo",
      due_at: parsed.data.due_at || null,
      due_date:
        parsed.data.due_date || (parsed.data.due_at ? parsed.data.due_at.slice(0, 10) : null),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  if (parsed.data.customer_id) revalidatePath(`/customers/${parsed.data.customer_id}`);
  if (parsed.data.lead_id) revalidatePath(`/leads/${parsed.data.lead_id}`);
  revalidatePath("/today");
  return { taskId: data.id };
}
