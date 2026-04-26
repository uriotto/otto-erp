"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ProjectSchema = z.object({
  name: z.string().min(1, "שם חובה"),
  description: z.string().optional(),
  customer_id: z.string().uuid().optional().or(z.literal("")),
  parent_project_id: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).default("planning"),
  phase: z
    .enum(["discovery", "specification", "development", "qa", "launch", "maintenance"])
    .optional()
    .or(z.literal("")),
  billing_model: z.enum(["hourly", "hour_bank", "fixed_price", "retainer"]).default("hourly"),
  budget: z.string().optional(),
  estimated_hours: z.string().optional(),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  health: z.enum(["on_track", "at_risk", "off_track"]).default("on_track"),
  template_id: z.string().uuid().optional().or(z.literal("")),
});

export type ProjectFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  projectId?: string;
};

function num(value: string | undefined): number | null {
  if (!value || value.trim().length === 0) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dateOrNull(value: string | undefined): string | null {
  if (!value || value.trim().length === 0) return null;
  return value;
}

async function getTenant() {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id, id").single();
  return { supabase, profile };
}

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = ProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const data = parsed.data;

  // Validate parent-child same customer
  if (data.parent_project_id) {
    const { data: parent } = await supabase
      .from("projects")
      .select("customer_id")
      .eq("id", data.parent_project_id)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (parent?.customer_id) {
      if (data.customer_id && data.customer_id !== parent.customer_id) {
        return { error: "פרויקט אב שייך ללקוח אחר. אי אפשר לערבב לקוחות." };
      }
      // Inherit customer from parent if not set
      if (!data.customer_id) data.customer_id = parent.customer_id;
    }
  }

  // If template chosen, copy defaults that weren't overridden
  let billingModel = data.billing_model;
  let estimatedHours = num(data.estimated_hours);
  let templateMilestones: { name: string; order_index: number }[] = [];

  if (data.template_id) {
    const { data: tpl } = await supabase
      .from("project_templates")
      .select("default_billing_model, default_estimated_hours, phases_template")
      .eq("id", data.template_id)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (tpl) {
      if (tpl.default_billing_model && !data.billing_model)
        billingModel = tpl.default_billing_model;
      if (tpl.default_estimated_hours && !estimatedHours)
        estimatedHours = Number(tpl.default_estimated_hours);
      if (Array.isArray(tpl.phases_template)) {
        templateMilestones = (tpl.phases_template as Array<{ name?: unknown }>)
          .map((m, i) => ({
            name: typeof m?.name === "string" ? m.name : `שלב ${i + 1}`,
            order_index: i,
          }))
          .filter((m) => m.name.length > 0);
      }
    }
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      name: data.name,
      description: data.description || null,
      customer_id: data.customer_id || null,
      parent_project_id: data.parent_project_id || null,
      status: data.status,
      phase: (data.phase as never) || null,
      billing_model: billingModel,
      budget: num(data.budget),
      estimated_hours: estimatedHours,
      start_date: dateOrNull(data.start_date),
      due_date: dateOrNull(data.due_date),
      health: data.health,
      template_id: data.template_id || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (templateMilestones.length > 0) {
    await supabase.from("milestones").insert(
      templateMilestones.map((m) => ({
        tenant_id: profile.tenant_id,
        project_id: project.id,
        name: m.name,
        order_index: m.order_index,
      })),
    );
  }

  revalidatePath("/projects");
  return { success: true, projectId: project.id };
}

export async function updateProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const id = formData.get("id") as string;
  if (!id) return { error: "חסר מזהה" };

  const raw = Object.fromEntries(formData.entries());
  delete (raw as Record<string, unknown>).id;
  const parsed = ProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const data = parsed.data;

  // Validate parent-child same customer (also on update)
  if (data.parent_project_id) {
    const { data: parent } = await supabase
      .from("projects")
      .select("customer_id")
      .eq("id", data.parent_project_id)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (parent?.customer_id) {
      if (data.customer_id && data.customer_id !== parent.customer_id) {
        return { error: "פרויקט אב שייך ללקוח אחר. אי אפשר לערבב לקוחות." };
      }
      if (!data.customer_id) data.customer_id = parent.customer_id;
    }
  }

  const { error } = await supabase
    .from("projects")
    .update({
      name: data.name,
      description: data.description || null,
      customer_id: data.customer_id || null,
      parent_project_id: data.parent_project_id || null,
      status: data.status,
      phase: (data.phase as never) || null,
      billing_model: data.billing_model,
      budget: num(data.budget),
      estimated_hours: num(data.estimated_hours),
      start_date: dateOrNull(data.start_date),
      due_date: dateOrNull(data.due_date),
      health: data.health,
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, projectId: id };
}

export async function deleteProject(id: string): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };
  revalidatePath("/projects");
  return {};
}

const MilestoneSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1, "שם חובה"),
  description: z.string().optional(),
  due_date: z.string().optional(),
  order_index: z.coerce.number().int().nonnegative().default(0),
});

export type MilestoneFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function createMilestone(
  _prev: MilestoneFormState,
  formData: FormData,
): Promise<MilestoneFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = MilestoneSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase.from("milestones").insert({
    tenant_id: profile.tenant_id,
    project_id: parsed.data.project_id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    due_date: dateOrNull(parsed.data.due_date),
    order_index: parsed.data.order_index,
  });

  if (error) return { error: error.message };

  revalidatePath(`/projects/${parsed.data.project_id}`);
  return { success: true };
}

export async function toggleMilestoneComplete(
  id: string,
  completed: boolean,
  projectId: string,
): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("milestones")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function deleteMilestone(id: string, projectId: string): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("milestones")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return {};
}
