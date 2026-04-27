"use server";

import { revalidatePath } from "next/cache";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

// AES-256-GCM encryption – key must be 32 bytes (64 hex chars) in env
function getKey(): Buffer {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error("CREDENTIALS_ENCRYPTION_KEY חסר או לא תקין");
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: iv(24 hex) + tag(32 hex) + ciphertext(hex)
  return iv.toString("hex") + tag.toString("hex") + encrypted.toString("hex");
}

export function decryptSecret(encoded: string): string {
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

  const secret = formData.get("secret") as string;
  const secret_encrypted = secret ? encryptSecret(secret) : null;

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

  const secret = formData.get("secret") as string;
  const updateData = {
    label: formData.get("label") as string,
    credential_type: (formData.get("credential_type") as string) || "password",
    username: (formData.get("username") as string) || null,
    url: (formData.get("url") as string) || null,
    notes: (formData.get("notes") as string) || null,
    ...(secret ? { secret_encrypted: encryptSecret(secret) } : {}),
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

export async function revealSecret(id: string): Promise<{ secret?: string; error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { data } = await supabase
    .from("customer_credentials")
    .select("secret_encrypted")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!data?.secret_encrypted) return { secret: "" };
  try {
    return { secret: decryptSecret(data.secret_encrypted) };
  } catch {
    return { error: "שגיאת פענוח" };
  }
}
