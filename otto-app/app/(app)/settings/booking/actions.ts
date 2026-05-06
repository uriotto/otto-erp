"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function getCurrentTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return { supabase, tenantId: profile.tenant_id, role: profile.role };
}

const BookingTypeSchema = z.object({
  title: z.string().min(1, "שם חובה").max(120, "שם ארוך מדי"),
  slug: z
    .string()
    .min(1, "מזהה חובה")
    .max(60, "מזהה ארוך מדי")
    .regex(/^[a-z0-9-]+$/, "מזהה יכול להכיל רק אותיות קטנות, מספרים ומקפים"),
  description: z.string().max(500, "תיאור ארוך מדי").optional(),
  duration_minutes: z.coerce.number().int().min(15).max(480),
  color: z.string().min(1),
  is_active: z.boolean().optional().default(true),
});

export async function createBookingType(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCurrentTenant();
  if (!ctx) return { ok: false, error: "לא מחובר" };

  const raw = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    description: (formData.get("description") as string) || undefined,
    duration_minutes: formData.get("duration_minutes"),
    color: (formData.get("color") as string) || "navy",
    is_active: formData.get("is_active") !== "false",
  };

  const parsed = BookingTypeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: Object.values(parsed.error.flatten().fieldErrors).flat().join(", "),
    };
  }

  const { data, error } = await ctx.supabase
    .from("booking_types")
    .insert({ ...parsed.data, tenant_id: ctx.tenantId })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "מזהה כבר בשימוש" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings/booking");
  return { ok: true, data: { id: data.id } };
}

export async function updateBookingType(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getCurrentTenant();
  if (!ctx) return { ok: false, error: "לא מחובר" };

  const raw = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    description: (formData.get("description") as string) || undefined,
    duration_minutes: formData.get("duration_minutes"),
    color: (formData.get("color") as string) || "navy",
    is_active: formData.get("is_active") !== "false",
  };

  const parsed = BookingTypeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: Object.values(parsed.error.flatten().fieldErrors).flat().join(", "),
    };
  }

  const { error } = await ctx.supabase
    .from("booking_types")
    .update(parsed.data)
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "מזהה כבר בשימוש" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings/booking");
  return { ok: true };
}

export async function deleteBookingType(id: string): Promise<ActionResult> {
  const ctx = await getCurrentTenant();
  if (!ctx) return { ok: false, error: "לא מחובר" };

  const { error } = await ctx.supabase
    .from("booking_types")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/booking");
  return { ok: true };
}

export async function getBookingTypes() {
  const ctx = await getCurrentTenant();
  if (!ctx) return { data: null, error: "לא מחובר" };

  const { data, error } = await ctx.supabase
    .from("booking_types")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: true });

  return { data, error: error?.message ?? null };
}
