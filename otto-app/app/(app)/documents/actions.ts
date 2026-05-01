"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const DocumentTypeEnum = z.enum(["contract", "spec", "deliverable", "reference", "other"]);

const UploadDocumentSchema = z.object({
  title: z.string().min(1, "כותרת חובה").max(300),
  type: DocumentTypeEnum,
  customer_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  signature_required: z.boolean().default(false),
  visible_to_client: z.boolean().default(false),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).default([]),
  file_path: z.string().min(1, "קובץ חובה"),
  file_url: z.string().url().optional().nullable(),
  file_size_bytes: z.number().optional().nullable(),
  mime_type: z.string().optional().nullable(),
});

export type DocumentActionResult = { ok: true; id: string } | { ok: false; error: string };

async function getTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, id, role")
    .eq("id", user.id)
    .single();
  return { supabase, profile };
}

export async function uploadDocument(
  input: z.infer<typeof UploadDocumentSchema>,
): Promise<DocumentActionResult> {
  const parsed = UploadDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const data = parsed.data;

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      title: data.title,
      type: data.type,
      customer_id: data.customer_id || null,
      project_id: data.project_id || null,
      signature_required: data.signature_required,
      visible_to_client: data.visible_to_client,
      notes: data.notes || null,
      tags: data.tags,
      file_path: data.file_path,
      file_url: data.file_url,
      file_size_bytes: data.file_size_bytes || null,
      mime_type: data.mime_type || null,
      file_source: "storage",
    })
    .select("id")
    .single();

  if (error || !doc) return { ok: false, error: error?.message ?? "שגיאה בשמירת המסמך" };

  revalidatePath("/documents");
  return { ok: true, id: doc.id };
}

const SignDocumentSchema = z.object({
  id: z.string().uuid(),
  signature_data: z.string().min(1),
  signed_by_name: z.string().min(1, "שם חובה").max(200),
  signed_by_email: z.string().email("מייל לא תקין").optional().nullable(),
});

export async function signDocument(
  input: z.infer<typeof SignDocumentSchema>,
): Promise<DocumentActionResult> {
  const parsed = SignDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { error } = await supabase
    .from("documents")
    .update({
      signature_data: parsed.data.signature_data,
      signed_by_name: parsed.data.signed_by_name,
      signed_by_email: parsed.data.signed_by_email || null,
      signed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/documents");
  revalidatePath(`/documents/${parsed.data.id}`);
  return { ok: true, id: parsed.data.id };
}

export async function deleteDocument(id: string): Promise<DocumentActionResult> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { data: doc } = await supabase
    .from("documents")
    .select("id, file_path, signed_at")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!doc) return { ok: false, error: "מסמך לא נמצא" };
  if (doc.signed_at) return { ok: false, error: "לא ניתן למחוק מסמך חתום" };

  if (doc.file_path) {
    await supabase.storage.from("documents").remove([doc.file_path]);
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/documents");
  return { ok: true, id };
}

export async function getDocumentSignedUrl(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { data: doc } = await supabase
    .from("documents")
    .select("file_path")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!doc?.file_path) return { ok: false, error: "קובץ לא נמצא" };

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.file_path, 300); // 5 minutes

  if (error || !data?.signedUrl)
    return { ok: false, error: error?.message ?? "שגיאה ביצירת קישור" };

  return { ok: true, url: data.signedUrl };
}

export async function updateDocumentMeta(
  id: string,
  input: { title?: string; notes?: string; visible_to_client?: boolean; tags?: string[] },
): Promise<DocumentActionResult> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { error } = await supabase
    .from("documents")
    .update(input)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/documents");
  return { ok: true, id };
}
