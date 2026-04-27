"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function getTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  return profile ? { supabase, tenant_id: profile.tenant_id } : null;
}

const InstallmentSchema = z.object({
  description: z.string().min(1, "תיאור חובה"),
  amount: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().positive("סכום חייב להיות חיובי"),
  ),
  due_date: z.string().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export type InstallmentFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function addPaymentInstallment(
  projectId: string,
  _prev: InstallmentFormState,
  formData: FormData,
): Promise<InstallmentFormState> {
  const raw = {
    description: formData.get("description") as string,
    amount: formData.get("amount") as string,
    due_date: (formData.get("due_date") as string) || "",
    notes: formData.get("notes") as string,
  };

  const parsed = InstallmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const ctx = await getTenant();
  if (!ctx) return { error: "לא מחובר" };

  const { data: existing } = await ctx.supabase
    .from("project_payment_schedule")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (existing?.sort_order ?? 0) + 1;

  const { error } = await ctx.supabase.from("project_payment_schedule").insert({
    project_id: projectId,
    description: parsed.data.description,
    amount: parsed.data.amount!,
    due_date: parsed.data.due_date || null,
    notes: parsed.data.notes || null,
    sort_order: nextOrder,
    tenant_id: ctx.tenant_id,
  });

  console.log("[payment-schedule] insert result", {
    error: error?.message,
    projectId,
    tenant_id: ctx.tenant_id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function updateInstallment(
  projectId: string,
  id: string,
  _prev: InstallmentFormState,
  formData: FormData,
): Promise<InstallmentFormState> {
  const raw = {
    description: formData.get("description") as string,
    amount: formData.get("amount") as string,
    due_date: (formData.get("due_date") as string) || "",
    notes: formData.get("notes") as string,
  };

  const parsed = InstallmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const ctx = await getTenant();
  if (!ctx) return { error: "לא מחובר" };

  const { error } = await ctx.supabase
    .from("project_payment_schedule")
    .update({
      description: parsed.data.description,
      amount: parsed.data.amount!,
      due_date: parsed.data.due_date || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id)
    .eq("tenant_id", ctx.tenant_id);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function deleteInstallment(
  projectId: string,
  id: string,
): Promise<{ error?: string }> {
  const ctx = await getTenant();
  if (!ctx) return { error: "לא מחובר" };

  const { error } = await ctx.supabase
    .from("project_payment_schedule")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenant_id);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function markInstallmentPaid(
  projectId: string,
  id: string,
): Promise<{ error?: string }> {
  const ctx = await getTenant();
  if (!ctx) return { error: "לא מחובר" };

  const today = new Date().toISOString().slice(0, 10);

  const { error } = await ctx.supabase
    .from("project_payment_schedule")
    .update({ status: "paid", paid_at: today })
    .eq("id", id)
    .eq("tenant_id", ctx.tenant_id);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function markInstallmentPending(
  projectId: string,
  id: string,
): Promise<{ error?: string }> {
  const ctx = await getTenant();
  if (!ctx) return { error: "לא מחובר" };

  const { error } = await ctx.supabase
    .from("project_payment_schedule")
    .update({ status: "pending", paid_at: null })
    .eq("id", id)
    .eq("tenant_id", ctx.tenant_id);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return {};
}
