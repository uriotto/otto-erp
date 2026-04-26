"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ProfileSchema = z.object({
  full_name: z.string().min(1, "שם חובה").max(120, "שם ארוך מדי"),
});

const TenantSchema = z.object({
  name: z.string().min(1, "שם המותג חובה").max(120, "שם ארוך מדי"),
});

export type SettingsFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function updateProfile(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const raw = {
    full_name: (formData.get("full_name") as string) ?? "",
  };

  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("users")
    .update({ full_name: parsed.data.full_name })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateTenant(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const raw = {
    name: (formData.get("name") as string) ?? "",
  };

  const parsed = TenantSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "פרופיל לא נמצא" };
  if (profile.role !== "admin") return { error: "רק מנהלים יכולים לעדכן את המותג" };

  const { error } = await supabase
    .from("tenants")
    .update({ name: parsed.data.name })
    .eq("id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}
