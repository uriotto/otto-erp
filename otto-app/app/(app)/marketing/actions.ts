"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const PLATFORMS = [
  "linkedin",
  "instagram",
  "facebook",
  "twitter",
  "blog",
  "email",
  "whatsapp",
  "other",
] as const;

const STATUSES = ["idea", "planned", "in_progress", "published", "cancelled"] as const;

const ContentSchema = z.object({
  title: z.string().min(1, "כותרת חובה"),
  body: z.string().optional(),
  platform: z.enum(PLATFORMS),
  status: z.enum(STATUSES),
  scheduled_date: z.string().optional().nullable(),
  tags: z.string().optional(),
  notes: z.string().optional(),
});

export type ContentFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function createContent(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const raw = {
    title: formData.get("title") as string,
    body: formData.get("body") as string,
    platform: formData.get("platform") as string,
    status: (formData.get("status") as string) || "idea",
    scheduled_date: (formData.get("scheduled_date") as string) || null,
    tags: formData.get("tags") as string,
    notes: formData.get("notes") as string,
  };

  const parsed = ContentSchema.safeParse(raw);
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
    .select("tenant_id, id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "לא מחובר" };

  const tags = parsed.data.tags
    ? parsed.data.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const { error } = await supabase.from("marketing_content").insert({
    tenant_id: profile.tenant_id,
    created_by: profile.id,
    title: parsed.data.title,
    body: parsed.data.body || null,
    platform: parsed.data.platform,
    status: parsed.data.status,
    scheduled_date: parsed.data.scheduled_date || null,
    tags,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return { success: true };
}

export async function updateContentStatus(
  id: string,
  status: (typeof STATUSES)[number],
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "לא מחובר" };

  const extra: Record<string, string> = {};
  if (status === "published") extra.published_at = new Date().toISOString();

  const { error } = await supabase
    .from("marketing_content")
    .update({ status, ...extra })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return {};
}

export async function deleteContent(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("marketing_content")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return {};
}
