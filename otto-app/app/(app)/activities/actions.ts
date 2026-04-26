"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ActivitySchema = z.object({
  type: z.enum(["call", "email", "whatsapp", "meeting", "note", "task"]),
  title: z.string().min(1, "כותרת חובה"),
  body: z.string().optional(),
  occurred_at: z.string().optional(),
  due_at: z.string().optional(),
  end_at: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
});

export type ActivityFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

function toIsoOrNull(v: string | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function createActivity(
  _prev: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const raw = {
    type: formData.get("type") as string,
    title: formData.get("title") as string,
    body: (formData.get("body") as string) || undefined,
    occurred_at: (formData.get("occurred_at") as string) || undefined,
    due_at: (formData.get("due_at") as string) || undefined,
    end_at: (formData.get("end_at") as string) || undefined,
    customer_id: (formData.get("customer_id") as string) || undefined,
    lead_id: (formData.get("lead_id") as string) || undefined,
  };

  const parsed = ActivitySchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // משימות אישיות (ללא לקוח/ליד) מותרות
  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id, id").single();
  if (!profile) return { error: "לא מחובר" };

  const occurredAt = toIsoOrNull(parsed.data.occurred_at) ?? new Date().toISOString();

  const { error } = await supabase.from("activities").insert({
    tenant_id: profile.tenant_id,
    created_by: profile.id,
    type: parsed.data.type,
    title: parsed.data.title,
    body: parsed.data.body || null,
    occurred_at: occurredAt,
    due_at: parsed.data.type === "task" ? toIsoOrNull(parsed.data.due_at) : null,
    end_at: parsed.data.type === "meeting" ? toIsoOrNull(parsed.data.end_at) : null,
    customer_id: parsed.data.customer_id || null,
    lead_id: parsed.data.lead_id || null,
  });

  if (error) return { error: error.message };

  if (parsed.data.customer_id) revalidatePath(`/customers/${parsed.data.customer_id}`);
  if (parsed.data.lead_id) revalidatePath(`/leads/${parsed.data.lead_id}`);
  revalidatePath("/today");
  return { success: true };
}

export async function updateActivity(
  _prev: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const id = formData.get("id") as string;
  if (!id) return { error: "חסר id" };

  const raw = {
    type: formData.get("type") as string,
    title: formData.get("title") as string,
    body: (formData.get("body") as string) || undefined,
    occurred_at: (formData.get("occurred_at") as string) || undefined,
    due_at: (formData.get("due_at") as string) || undefined,
    end_at: (formData.get("end_at") as string) || undefined,
  };

  const parsed = ActivitySchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) return { error: "לא מחובר" };

  const occurredAt = toIsoOrNull(parsed.data.occurred_at) ?? new Date().toISOString();

  const { error } = await supabase
    .from("activities")
    .update({
      type: parsed.data.type,
      title: parsed.data.title,
      body: parsed.data.body || null,
      occurred_at: occurredAt,
      due_at: parsed.data.type === "task" ? toIsoOrNull(parsed.data.due_at) : null,
      end_at: parsed.data.type === "meeting" ? toIsoOrNull(parsed.data.end_at) : null,
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  const parentPath = formData.get("parent_path") as string;
  if (parentPath) revalidatePath(parentPath);
  return { success: true };
}

export async function toggleActivityComplete(
  id: string,
  isCompleted: boolean,
  parentPath: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("activities")
    .update({ completed_at: isCompleted ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath(parentPath);
  return {};
}

export async function deleteActivity(id: string, parentPath: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath(parentPath);
  return {};
}
