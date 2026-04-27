"use server";

import { revalidatePath } from "next/cache";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

export type CredentialField = {
  key: string;
  value: string;
  hidden: boolean;
};

const ALLOWED_CREDENTIAL_TYPES = ["password", "api_key", "oauth", "ssh", "other"] as const;

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
  // L-2 fix: explicit utf8 encoding to avoid Buffer+string concat ambiguity
  return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8");
}

function sanitizeUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return raw;
  } catch {
    return null;
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

  // H-1: verify the customer belongs to this tenant
  const { data: customerCheck } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (!customerCheck) return { error: "לקוח לא נמצא" };

  // H-2: safe JSON.parse
  let fields: CredentialField[] = [];
  try {
    const fieldsJson = formData.get("fields") as string;
    fields = fieldsJson ? JSON.parse(fieldsJson) : [];
  } catch {
    return { error: "נתונים לא תקינים" };
  }

  // M-2: validate credential_type against allowed enum
  const rawType = formData.get("credential_type") as string;
  const credential_type = (ALLOWED_CREDENTIAL_TYPES as readonly string[]).includes(rawType)
    ? rawType
    : "other";

  const secret_encrypted = fields.length > 0 ? encrypt(JSON.stringify(fields)) : null;

  const { error } = await supabase.from("customer_credentials").insert({
    tenant_id: profile.tenant_id,
    customer_id: customerId,
    label: formData.get("label") as string,
    credential_type,
    username: (formData.get("username") as string) || null,
    url: sanitizeUrl(formData.get("url") as string | null), // H-3
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

  // H-2: safe JSON.parse
  let fields: CredentialField[] = [];
  try {
    const fieldsJson = formData.get("fields") as string;
    fields = fieldsJson ? JSON.parse(fieldsJson) : [];
  } catch {
    return { error: "נתונים לא תקינים" };
  }

  // M-2: validate credential_type
  const rawType = formData.get("credential_type") as string;
  const credential_type = (ALLOWED_CREDENTIAL_TYPES as readonly string[]).includes(rawType)
    ? rawType
    : "other";

  const updateData = {
    label: formData.get("label") as string,
    credential_type,
    username: (formData.get("username") as string) || null,
    url: sanitizeUrl(formData.get("url") as string | null), // H-3
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
    // backward compat: old single-secret format
    if (typeof parsed === "string")
      return { fields: [{ key: "secret", value: parsed, hidden: true }] };
    return { fields: parsed as CredentialField[] };
  } catch {
    return { error: "שגיאת פענוח" };
  }
}
