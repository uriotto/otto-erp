"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

export type RecordingActionResult = { ok: true; id: string } | { ok: false; error: string };

const CreateRecordingSchema = z.object({
  title: z.string().min(1, "כותרת חובה").max(300),
  customer_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  storage_path: z.string().min(1, "נתיב קובץ חובה"),
  duration_seconds: z.number().int().min(0).optional().nullable(),
  file_size: z.number().int().min(0).optional().nullable(),
});

export async function createRecording(
  input: z.infer<typeof CreateRecordingSchema>,
): Promise<RecordingActionResult> {
  const parsed = CreateRecordingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const data = parsed.data;

  const { data: recording, error } = await supabase
    .from("recordings")
    .insert({
      tenant_id: profile.tenant_id,
      title: data.title,
      customer_id: data.customer_id ?? null,
      project_id: data.project_id ?? null,
      storage_path: data.storage_path,
      duration_seconds: data.duration_seconds ?? null,
      file_size: data.file_size ?? null,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/recordings");
  return { ok: true, id: recording.id };
}

export async function deleteRecording(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  // Get storage_path before deleting
  const { data: recording } = await supabase
    .from("recordings")
    .select("storage_path, tenant_id")
    .eq("id", id)
    .single();

  if (!recording) return { ok: false, error: "הקלטה לא נמצאה" };

  // Delete from DB
  const { error } = await supabase.from("recordings").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Delete from Storage if path exists
  if (recording.storage_path) {
    await supabase.storage.from("recordings").remove([recording.storage_path]);
  }

  revalidatePath("/recordings");
  return { ok: true };
}

export async function getRecordingDownloadUrl(storagePath: string): Promise<string | null> {
  const { supabase, profile } = await getTenant();
  if (!profile) return null;

  const { data } = await supabase.storage
    .from("recordings")
    .createSignedUrl(storagePath, 3600);

  return data?.signedUrl ?? null;
}
