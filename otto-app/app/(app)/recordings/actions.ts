"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { submitTranscription } from "@/lib/recordings/transcription";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * מפעיל תמלול בענן להקלטה שזה עתה נשמרה: יוצר URL זמני לאודיו,
 * שולח ל-RunPod עם webhook, ומסמן את ההקלטה כ-"transcribing".
 * נכשל בשקט (ההקלטה נשמרה בכל מקרה, נשארת "uploaded" וניתן לעבד שוב).
 */
async function kickoffTranscription(
  supabase: SupabaseClient,
  recordingId: string,
  storagePath: string,
): Promise<void> {
  const secret = process.env.RECORDINGS_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[recordings] RECORDINGS_WEBHOOK_SECRET missing - skipping transcription");
    return;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://otto-erp.vercel.app";

  try {
    const { data: signed } = await supabase.storage
      .from("recordings")
      .createSignedUrl(storagePath, 7200);
    if (!signed?.signedUrl) throw new Error("could not sign audio url");

    const webhookUrl = `${appUrl}/api/recordings/webhook?rec=${recordingId}&token=${encodeURIComponent(secret)}`;
    await submitTranscription(signed.signedUrl, webhookUrl);

    await supabase.from("recordings").update({ status: "transcribing" }).eq("id", recordingId);
  } catch (e) {
    console.error("[recordings] kickoffTranscription failed", e);
  }
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

export type RecordingActionResult = { ok: true; id: string } | { ok: false; error: string };

const CreateRecordingSchema = z.object({
  title: z.string().min(1, "כותרת חובה").max(300),
  customer_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
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
      lead_id: data.lead_id ?? null,
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

  // מפעיל תמלול בענן (RunPod → webhook → סיכום). לא חוסם את הצלחת השמירה.
  await kickoffTranscription(supabase, recording.id, data.storage_path);

  revalidatePath("/recordings");
  return { ok: true, id: recording.id };
}

export async function deleteRecording(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
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

export async function createLeadFromRecording(
  recordingId: string,
  name: string,
): Promise<{ ok: true; leadId: string } | { ok: false; error: string }> {
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: "שם חובה" };

  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { data: recording } = await supabase
    .from("recordings")
    .select("summary, lead_id")
    .eq("id", recordingId)
    .single();
  if (!recording) return { ok: false, error: "הקלטה לא נמצאה" };
  if (recording.lead_id) return { ok: false, error: "ההקלטה כבר מקושרת לליד" };

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .insert({
      tenant_id: profile.tenant_id,
      name: cleanName,
      status: "new",
      source: "שיחה מוקלטת",
      notes: recording.summary ?? null,
    })
    .select("id")
    .single();
  if (leadErr) return { ok: false, error: leadErr.message };

  const { error: linkErr } = await supabase
    .from("recordings")
    .update({ lead_id: lead.id })
    .eq("id", recordingId);
  if (linkErr) return { ok: false, error: linkErr.message };

  revalidatePath(`/recordings/${recordingId}`);
  revalidatePath("/leads");
  return { ok: true, leadId: lead.id };
}

export async function getRecordingDownloadUrl(storagePath: string): Promise<string | null> {
  const { supabase, profile } = await getTenant();
  if (!profile) return null;

  const { data } = await supabase.storage.from("recordings").createSignedUrl(storagePath, 3600);

  return data?.signedUrl ?? null;
}
