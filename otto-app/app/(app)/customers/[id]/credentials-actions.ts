"use server";

import { revalidatePath } from "next/cache";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

export type CredentialField = {
  key: string;
  value: string;
  hidden: boolean;
};

function getKey(): Buffer {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!hex || hex.length !== 64) throw new Error("CREDENTIALS_ENCRYPTION_KEY חסר או לא תקין");
  return Buffer.from(hex, "hex");
}

function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString("hex") + tag.toString("hex") + encrypted.toString("hex");
}

function decrypt(encoded: string): string {
  const key = getKey();
  const iv = Buffer.from(encoded.slice(0, 24), "hex");
  const tag = Buffer.from(encoded.slice(24, 56), "hex");
  const ciphertext = Buffer.from(encoded.slice(56), "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

async function getTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  return { supabase, profile };
}

export async function addCredential(
  customerId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const fieldsJson = formData.get("fields") as string;
  const fields: CredentialField[] = fieldsJson ? JSON.parse(fieldsJson) : [];
  const secret_encrypted = fields.length > 0 ? encrypt(JSON.stringify(fields)) : null;

  const { error } = await supabase.from("customer_credentials").insert({
    tenant_id: profile.tenant_id,
    customer_id: customerId,
    label: formData.get("label") as string,
    credential_type: (formData.get("credential_type") as string) || "password",
    username: (formData.get("username") as string) || null,
    url: (formData.get("url") as string) || null,
    secret_encrypted,
    notes: (formData.get("notes") as string) || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return {};
}

export async function updateCredential(
  id: string,
  customerId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const fieldsJson = formData.get("fields") as string;
  const fields: CredentialField[] = fieldsJson ? JSON.parse(fieldsJson) : [];

  const updateData = {
    label: formData.get("label") as string,
    credential_type: (formData.get("credential_type") as string) || "password",
    username: (formData.get("username") as string) || null,
    url: (formData.get("url") as string) || null,
    notes: (formData.get("notes") as string) || null,
    ...(fields.length > 0 ? { secret_encrypted: encrypt(JSON.stringify(fields)) } : {}),
  };

  const { error } = await supabase
    .from("customer_credentials")
    .update(updateData)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return {};
}

export async function deleteCredential(
  id: string,
  customerId: string,
): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("customer_credentials")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return {};
}

export async function revealFields(
  id: string,
): Promise<{ fields?: CredentialField[]; error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { data } = await supabase
    .from("customer_credentials")
    .select("secret_encrypted")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!data?.secret_encrypted) return { fields: [] };
  try {
    const raw = decrypt(data.secret_encrypted);
    const parsed = JSON.parse(raw);
    // Support old single-secret format
    if (typeof parsed === "string")
      return { fields: [{ key: "secret", value: parsed, hidden: true }] };
    return { fields: parsed as CredentialField[] };
  } catch {
    return { error: "שגיאת פענוח" };
  }
}
